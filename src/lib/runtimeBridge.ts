import type { IncomingMessage, ServerResponse } from 'node:http'
import { spawn } from 'node:child_process'
import path from 'node:path'
import type { Plugin, PreviewServer, ViteDevServer } from 'vite'
import { RuntimeSessionStore } from './runtimeSessionStore'
import type {
  CreateRuntimeSessionInput,
  ResizeRuntimeSessionInput,
  RuntimeSessionArtifact,
  RuntimeBridgeHealth,
  RuntimeHostCheck,
  RuntimeSessionRecord,
  WriteRuntimeSessionInput,
} from './runtimeSessionTypes'

const BASE_PATH = '/api/runtime'
const store = new RuntimeSessionStore()

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_PATH}${path}`, {
    cache: 'no-store',
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
    },
  })
  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || `Runtime bridge error ${response.status}`)
  }
  return response.json() as Promise<T>
}

export function getRuntimeBridgeHealth(): Promise<RuntimeBridgeHealth> {
  return requestJson<RuntimeBridgeHealth>('/health')
}

export function listRuntimeSessions(filters?: {
  workspaceId?: string
  problemId?: string
  agentId?: string
}): Promise<RuntimeSessionRecord[]> {
  const search = new URLSearchParams()
  if (filters?.workspaceId) search.set('workspaceId', filters.workspaceId)
  if (filters?.problemId) search.set('problemId', filters.problemId)
  if (filters?.agentId) search.set('agentId', filters.agentId)
  const query = search.toString()
  return requestJson<RuntimeSessionRecord[]>(query ? `/sessions?${query}` : '/sessions')
}

export function getRuntimeSession(sessionId: string): Promise<RuntimeSessionRecord> {
  return requestJson<RuntimeSessionRecord>(`/sessions/${encodeURIComponent(sessionId)}`)
}

export function listRuntimeSessionArtifacts(sessionId: string): Promise<RuntimeSessionArtifact[]> {
  return requestJson<RuntimeSessionArtifact[]>(`/sessions/${encodeURIComponent(sessionId)}/artifacts`)
}

export function createRuntimeSession(input: CreateRuntimeSessionInput): Promise<RuntimeSessionRecord> {
  return requestJson<RuntimeSessionRecord>('/sessions', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function killRuntimeSession(sessionId: string): Promise<RuntimeSessionRecord> {
  return requestJson<RuntimeSessionRecord>(`/sessions/${encodeURIComponent(sessionId)}/kill`, {
    method: 'POST',
  })
}

export function resizeRuntimeSession(
  sessionId: string,
  input: ResizeRuntimeSessionInput,
): Promise<RuntimeSessionRecord> {
  return requestJson<RuntimeSessionRecord>(`/sessions/${encodeURIComponent(sessionId)}/resize`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function writeRuntimeSessionInput(
  sessionId: string,
  input: WriteRuntimeSessionInput,
): Promise<RuntimeSessionRecord> {
  return requestJson<RuntimeSessionRecord>(`/sessions/${encodeURIComponent(sessionId)}/input`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

function normalizeJson(value: unknown): string {
  return JSON.stringify(value, null, 2)
}

function sendJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  const body = normalizeJson(payload)
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Content-Length', Buffer.byteLength(body))
  res.end(body)
}

function sendText(res: ServerResponse, statusCode: number, body: string): void {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'text/plain; charset=utf-8')
  res.setHeader('Content-Length', Buffer.byteLength(body))
  res.end(body)
}

function matchPath(urlPath: string, prefix: string): string | null {
  if (!urlPath.startsWith(prefix)) return null
  const remainder = urlPath.slice(prefix.length)
  return remainder.startsWith('/') ? remainder.slice(1) : remainder
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }
  if (chunks.length === 0) return undefined
  const text = Buffer.concat(chunks).toString('utf8').trim()
  if (!text) return undefined
  return JSON.parse(text) as unknown
}

function resolveCommandRoot(rootDir: string, cwd?: string): string {
  return cwd && cwd.trim() ? path.resolve(rootDir, cwd.trim()) : rootDir
}

function isInsideRoot(candidate: string, rootDir: string): boolean {
  const relative = path.relative(rootDir, candidate)
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}

function resolveAllowedCommandRoot(
  rootDir: string,
  cwd: string | undefined,
  writableRoots: readonly string[] | undefined,
): string {
  const resolved = resolveCommandRoot(rootDir, cwd)
  const allowedRoots = [rootDir, ...(writableRoots ?? []).map((entry) => path.resolve(rootDir, entry))]
  if (!allowedRoots.some((allowedRoot) => isInsideRoot(resolved, allowedRoot))) {
    throw new Error(`Workspace root "${cwd ?? '.'}" is outside the allowed DewDrop runtime roots.`)
  }
  return resolved
}

function toStringRecord(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== 'object') return undefined
  const entries = Object.entries(value as Record<string, unknown>).flatMap(([key, next]) =>
    typeof next === 'string' ? [[key, next]] : [],
  )
  if (entries.length === 0) return undefined
  return Object.fromEntries(entries)
}

function isoNow(): string {
  return new Date().toISOString()
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

async function probeRuntimeHost(alias: string): Promise<RuntimeHostCheck> {
  const normalized = alias.trim()
  const startedAt = Date.now()

  if (!normalized || normalized === 'local' || normalized === 'localhost') {
    return {
      alias: normalized || 'local',
      route: 'local',
      ok: true,
      checkedAt: isoNow(),
      latencyMs: 0,
      detail: 'Local machine available through the current DewDrops runtime.',
    }
  }

  return new Promise<RuntimeHostCheck>((resolve) => {
    let stdout = ''
    let stderr = ''
    let settled = false
    const finish = (ok: boolean, detail: string) => {
      if (settled) return
      settled = true
      clearTimeout(timeoutHandle)
      resolve({
        alias: normalized,
        route: 'vpn-ssh',
        ok,
        checkedAt: isoNow(),
        latencyMs: Date.now() - startedAt,
        detail,
      })
    }

    const child = spawn(
      'ssh',
      [
        '-o',
        'BatchMode=yes',
        '-o',
        'ConnectTimeout=4',
        '-o',
        'StrictHostKeyChecking=accept-new',
        normalized,
        'printf __DEWDROPS_HOST_OK__',
      ],
      {
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    )

    const timeoutHandle = setTimeout(() => {
      child.kill('SIGKILL')
      finish(false, 'Host check timed out before SSH completed.')
    }, 5000)

    child.stdout.on('data', (chunk: Buffer | string) => {
      stdout += chunk.toString()
    })
    child.stderr.on('data', (chunk: Buffer | string) => {
      stderr += chunk.toString()
    })
    child.on('error', (error) => {
      finish(false, error.message)
    })
    child.on('exit', (code) => {
      const markerSeen = stdout.includes('__DEWDROPS_HOST_OK__')
      const stderrText = collapseWhitespace(stderr)
      if (code === 0 && markerSeen) {
        finish(true, 'SSH reached the host and the DewDrop route is available.')
        return
      }
      finish(false, stderrText || `SSH exited with code ${code ?? 'unknown'}.`)
    })
  })
}

function createRuntimeBridgeHandler(rootDir: string) {
  return async (req: IncomingMessage, res: ServerResponse, next: () => void): Promise<void> => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    if (!url.pathname.startsWith('/api/runtime')) {
      next()
      return
    }

    if (req.method === 'GET' && url.pathname === '/api/runtime/health') {
      sendJson(res, 200, store.health())
      return
    }

    if (req.method === 'GET' && url.pathname === '/api/runtime/sessions') {
      sendJson(
        res,
        200,
        store.listSessions({
          workspaceId: url.searchParams.get('workspaceId') ?? undefined,
          problemId: url.searchParams.get('problemId') ?? undefined,
          agentId: url.searchParams.get('agentId') ?? undefined,
        }),
      )
      return
    }

    if (req.method === 'POST' && url.pathname === '/api/runtime/sessions') {
      try {
        const body = (await readJsonBody(req)) as Partial<CreateRuntimeSessionInput> | undefined
        if (!body || typeof body !== 'object') {
          sendJson(res, 400, { ok: false, error: 'Missing JSON body.' })
          return
        }
        if (typeof body.command !== 'string' || !body.command.trim()) {
          sendJson(res, 400, { ok: false, error: 'A session command is required.' })
          return
        }
        const created = store.createSession({
          label: typeof body.label === 'string' ? body.label : body.command,
          command: body.command,
          launchFile: typeof body.launchFile === 'string' ? body.launchFile : undefined,
          launchArgs:
            Array.isArray(body.launchArgs) && body.launchArgs.every((entry) => typeof entry === 'string')
              ? (body.launchArgs as string[])
              : undefined,
          cwd: resolveAllowedCommandRoot(
            rootDir,
            body.cwd,
            Array.isArray(body.sessionPolicy?.writableRoots)
              ? body.sessionPolicy.writableRoots.filter((entry): entry is string => typeof entry === 'string')
              : undefined,
          ),
          workspaceId: typeof body.workspaceId === 'string' ? body.workspaceId : undefined,
          problemId: typeof body.problemId === 'string' ? body.problemId : undefined,
          agentId: typeof body.agentId === 'string' ? body.agentId : undefined,
          env: toStringRecord(body.env),
          logTailLimit:
            typeof body.logTailLimit === 'number' && Number.isFinite(body.logTailLimit)
              ? body.logTailLimit
              : undefined,
          sessionPolicy: body.sessionPolicy,
        })
        sendJson(res, 201, created)
      } catch (error) {
        sendJson(res, 500, {
          ok: false,
          error: error instanceof Error ? error.message : 'Could not create runtime session.',
        })
      }
      return
    }

    const hostPath = matchPath(url.pathname, '/api/runtime/hosts')
    if (req.method === 'GET' && hostPath) {
      const [encodedAlias, action] = hostPath.split('/').filter(Boolean)
      if (encodedAlias && action === 'check') {
        try {
          const alias = decodeURIComponent(encodedAlias)
          sendJson(res, 200, await probeRuntimeHost(alias))
        } catch (error) {
          sendJson(res, 500, {
            ok: false,
            error: error instanceof Error ? error.message : 'Could not check the requested host.',
          })
        }
        return
      }
    }

    const sessionPath = matchPath(url.pathname, '/api/runtime/sessions')
    if (!sessionPath) {
      sendText(res, 404, 'Not found')
      return
    }
    const [sessionId, action] = sessionPath.split('/').filter(Boolean)
    if (!sessionId) {
      sendText(res, 404, 'Not found')
      return
    }

    if (req.method === 'GET' && !action) {
      const session = store.getSession(sessionId)
      if (!session) {
        sendJson(res, 404, { ok: false, error: 'Session not found.' })
        return
      }
      sendJson(res, 200, session)
      return
    }

    if (req.method === 'GET' && action === 'artifacts') {
      try {
        const artifacts = await store.listSessionArtifacts(sessionId)
        sendJson(res, 200, artifacts)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not list runtime artifacts.'
        if (message === 'Session not found.') {
          sendJson(res, 404, { ok: false, error: message })
          return
        }
        sendJson(res, 500, { ok: false, error: message })
      }
      return
    }

    if (req.method === 'POST' && action === 'kill') {
      const session = store.killSession(sessionId)
      if (!session) {
        sendJson(res, 404, { ok: false, error: 'Session not found.' })
        return
      }
      sendJson(res, 200, session)
      return
    }

    if (req.method === 'POST' && action === 'resize') {
      try {
        const body = (await readJsonBody(req)) as Partial<ResizeRuntimeSessionInput> | undefined
        if (
          !body ||
          typeof body.cols !== 'number' ||
          !Number.isFinite(body.cols) ||
          typeof body.rows !== 'number' ||
          !Number.isFinite(body.rows)
        ) {
          sendJson(res, 400, { ok: false, error: 'Terminal resize dimensions are required.' })
          return
        }
        const session = store.resizeSession(sessionId, body.cols, body.rows)
        sendJson(res, 200, session)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not resize runtime session.'
        if (message === 'Session not found.') {
          sendJson(res, 404, { ok: false, error: message })
          return
        }
        sendJson(res, 409, { ok: false, error: message })
      }
      return
    }

    if (req.method === 'POST' && action === 'input') {
      try {
        const body = (await readJsonBody(req)) as Partial<WriteRuntimeSessionInput> | undefined
        if (!body || typeof body.input !== 'string') {
          sendJson(res, 400, { ok: false, error: 'A runtime input payload is required.' })
          return
        }
        const session = store.writeSessionInput(sessionId, body.input)
        sendJson(res, 200, session)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not send runtime input.'
        if (message === 'Session not found.') {
          sendJson(res, 404, { ok: false, error: message })
          return
        }
        sendJson(res, 409, { ok: false, error: message })
      }
      return
    }

    sendText(res, 404, 'Not found')
  }
}

function installRuntimeBridge(server: ViteDevServer | PreviewServer, rootDir: string): void {
  server.middlewares.use(createRuntimeBridgeHandler(rootDir))
}

export function runtimeBridgePlugin(rootDir = process.cwd()): Plugin {
  return {
    name: 'dewdrops-runtime-bridge',
    configureServer(server) {
      installRuntimeBridge(server, rootDir)
    },
    configurePreviewServer(server) {
      installRuntimeBridge(server, rootDir)
    },
  }
}
