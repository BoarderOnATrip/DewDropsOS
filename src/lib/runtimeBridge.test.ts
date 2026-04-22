import { type IncomingMessage, type ServerResponse } from 'node:http'
import { mkdtempSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { describe, expect, it } from 'vitest'
import { runtimeBridgePlugin } from './runtimeBridge'

type Middleware = (req: IncomingMessage, res: ServerResponse, next: () => void) => unknown

function installMiddleware(rootDir: string): Middleware {
  const plugin = runtimeBridgePlugin(rootDir)
  let middleware: Middleware | null = null
  const configureServer = plugin.configureServer as unknown as
    | ((server: { middlewares: { use: (middleware: Middleware) => void } }) => void)
    | undefined
  configureServer?.({
    middlewares: {
      use(fn: Middleware) {
        middleware = fn
      },
    },
  })
  if (!middleware) {
    throw new Error('Runtime bridge middleware was not installed.')
  }
  return middleware
}

function makeRequest(path: string, method: string, body?: string): IncomingMessage & AsyncIterable<Buffer | string> {
  return {
    url: path,
    method,
    headers: body ? { 'content-type': 'application/json' } : {},
    async *[Symbol.asyncIterator]() {
      if (body) {
        yield Buffer.from(body)
      }
    },
  } as IncomingMessage & AsyncIterable<Buffer | string>
}

function makeResponse() {
  const chunks: string[] = []
  const headers: Record<string, unknown> = {}
  let statusCode = 200
  const response = {
    get statusCode() {
      return statusCode
    },
    set statusCode(value: number) {
      statusCode = value
    },
    setHeader(name: string, value: string | number | readonly string[]) {
      headers[name] = value
    },
    end(chunk?: string | Buffer) {
      if (typeof chunk === 'string') {
        chunks.push(chunk)
      } else if (chunk) {
        chunks.push(chunk.toString('utf8'))
      }
    },
  } as unknown as ServerResponse
  return { response, chunks, headers, get statusCode() { return statusCode } }
}

async function invoke(
  middleware: Middleware,
  path: string,
  method: string,
  body?: string,
): Promise<{ status: number; body: unknown; nextCalled: boolean }> {
  const request = makeRequest(path, method, body)
  const state = makeResponse()
  let nextCalled = false
  await middleware(request, state.response, () => {
    nextCalled = true
  })
  const text = state.chunks.join('')
  const contentType = String(state.headers['Content-Type'] ?? state.headers['content-type'] ?? '')
  return {
    status: state.statusCode,
    body: text ? (contentType.includes('application/json') ? JSON.parse(text) : text) : undefined,
    nextCalled,
  }
}

describe('runtimeBridgePlugin', () => {
  it('serves health and session lifecycle endpoints from the same-origin middleware', async () => {
    const rootDir = mkdtempSync(join(tmpdir(), 'dewdrops-runtime-'))
    const middleware = installMiddleware(rootDir)

    const health = await invoke(middleware, '/api/runtime/health', 'GET')
    expect(health.status).toBe(200)
    expect(health.body).toMatchObject({
      ok: true,
      service: 'dewdrops-runtime',
      activeSessions: 0,
    })

    const command =
      `${JSON.stringify(process.execPath)} -e ` +
      `"process.stdin.setEncoding('utf8'); process.stdin.on('data', (chunk) => { console.log('bridge:' + chunk.trim()) }); console.log('bridge ok'); setTimeout(() => {}, 5000)"`
    const created = await invoke(
      middleware,
      '/api/runtime/sessions',
      'POST',
      JSON.stringify({
        label: 'worker-1',
        command,
        agentId: 'agent-1',
        workspaceId: 'workspace-1',
        problemId: 'problem-1',
        env: { DEWDROPS_TEST_FLAG: '1' },
        logTailLimit: 20,
      }),
    )
    expect(created.status).toBe(201)
    expect(created.body).toMatchObject({
      label: 'worker-1',
      command,
      workspaceId: 'workspace-1',
      problemId: 'problem-1',
      agentId: 'agent-1',
      status: 'running',
    })

    const sessionId = (created.body as { id: string }).id

    await delay(450)

    const listed = await invoke(middleware, '/api/runtime/sessions?workspaceId=workspace-1', 'GET')
    expect(listed.status).toBe(200)
    expect(listed.body).toEqual([
      expect.objectContaining({
        id: sessionId,
        status: 'running',
      }),
    ])

    const fetched = await invoke(middleware, `/api/runtime/sessions/${encodeURIComponent(sessionId)}`, 'GET')
    expect(fetched.status).toBe(200)
    expect(fetched.body).toMatchObject({
      id: sessionId,
      status: 'running',
    })
    expect((fetched.body as { logTail: string[] }).logTail.join('\n')).toContain('bridge ok')

    const written = await invoke(
      middleware,
      `/api/runtime/sessions/${encodeURIComponent(sessionId)}/input`,
      'POST',
      JSON.stringify({ input: 'status\\n' }),
    )
    expect(written.status).toBe(200)

    await delay(450)

    const afterInput = await invoke(middleware, `/api/runtime/sessions/${encodeURIComponent(sessionId)}`, 'GET')
    expect(afterInput.status).toBe(200)
    expect((afterInput.body as { logTail: string[] }).logTail.join('\n')).toContain('[stdin] status')
    expect((afterInput.body as { logTail: string[] }).logTail.join('\n')).toContain('bridge:status')

    const killed = await invoke(middleware, `/api/runtime/sessions/${encodeURIComponent(sessionId)}/kill`, 'POST')
    expect(killed.status).toBe(200)
    expect(killed.body).toMatchObject({
      id: sessionId,
      status: 'killed',
    })
  })

  it('serves host checks from the same-origin middleware', async () => {
    const rootDir = mkdtempSync(join(tmpdir(), 'dewdrops-runtime-'))
    const middleware = installMiddleware(rootDir)

    const localHost = await invoke(middleware, '/api/runtime/hosts/local/check', 'GET')
    expect(localHost.status).toBe(200)
    expect(localHost.body).toMatchObject({
      alias: 'local',
      route: 'local',
      ok: true,
    })
  })

  it('lists discovered session artifacts from the runtime middleware', async () => {
    const rootDir = mkdtempSync(join(tmpdir(), 'dewdrops-runtime-'))
    await mkdir(join(rootDir, '.dewdrops-artifacts', 'agent-1', 'playwright-report'), { recursive: true })
    await writeFile(
      join(rootDir, '.dewdrops-artifacts', 'agent-1', 'playwright-report', 'index.html'),
      '<html>report</html>',
      'utf8',
    )
    const middleware = installMiddleware(rootDir)

    const command = `${JSON.stringify(process.execPath)} -e "setTimeout(() => {}, 5000)"`
    const created = await invoke(
      middleware,
      '/api/runtime/sessions',
      'POST',
      JSON.stringify({
        label: 'playwright-worker',
        command,
        agentId: 'agent-1',
        cwd: rootDir,
        env: {
          DEWDROPS_RUNTIME_PROFILE: 'playwright',
          DEWDROPS_RUNTIME_ROUTE: 'local',
          DEWDROPS_ARTIFACT_DIR: '.dewdrops-artifacts/agent-1',
          PLAYWRIGHT_HTML_OUTPUT_DIR: '.dewdrops-artifacts/agent-1/playwright-report',
        },
      }),
    )
    expect(created.status).toBe(201)
    const sessionId = (created.body as { id: string }).id

    const artifacts = await invoke(
      middleware,
      `/api/runtime/sessions/${encodeURIComponent(sessionId)}/artifacts`,
      'GET',
    )
    expect(artifacts.status).toBe(200)
    expect(artifacts.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'report',
          title: 'Playwright HTML report',
          path: '.dewdrops-artifacts/agent-1/playwright-report/index.html',
        }),
      ]),
    )

    const artifactFile = await invoke(
      middleware,
      `/api/runtime/sessions/${encodeURIComponent(sessionId)}/artifacts/${encodeURIComponent(
        'dewdrops-artifacts-agent-1-playwright-report-index-html',
      )}/file`,
      'GET',
    )
    expect(artifactFile.status).toBe(200)
    expect(artifactFile.nextCalled).toBe(false)

    await invoke(middleware, `/api/runtime/sessions/${encodeURIComponent(sessionId)}/kill`, 'POST')
  })
})
