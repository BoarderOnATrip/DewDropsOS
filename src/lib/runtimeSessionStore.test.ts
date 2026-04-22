import { mkdir, writeFile } from 'node:fs/promises'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { describe, expect, it } from 'vitest'
import { RuntimeSessionStore } from './runtimeSessionStore'

describe('RuntimeSessionStore', () => {
  it('starts, logs, and kills a real shell session', async () => {
    const store = new RuntimeSessionStore()
    const command = `${JSON.stringify(process.execPath)} -e "console.log('hello from dew'); setTimeout(() => {}, 5000)"`

    const session = store.createSession({
      label: 'worker-1',
      command,
      agentId: 'agent-1',
    })

    try {
      expect(session.status).toBe('running')
      expect(session.command).toBe(command)

      await delay(450)

      const running = store.getSession(session.id)
      expect(running).not.toBeNull()
      expect(running?.logTail.join('\n')).toContain('hello from dew')
    } finally {
      const killed = store.killSession(session.id)
      expect(killed).not.toBeNull()
      expect(killed?.status).toBe('killed')
    }
  })

  it('accepts stdin for a running session', async () => {
    const store = new RuntimeSessionStore()
    const command =
      `${JSON.stringify(process.execPath)} -e ` +
      `"process.stdin.setEncoding('utf8'); process.stdin.on('data', (chunk) => { console.log('echo:' + chunk.trim()) }); setTimeout(() => {}, 5000)"`

    const session = store.createSession({
      label: 'worker-stdin',
      command,
      agentId: 'agent-stdin',
    })

    try {
      expect(session.status).toBe('running')
      store.writeSessionInput(session.id, 'status\\n')
      await delay(450)

      const running = store.getSession(session.id)
      expect(running).not.toBeNull()
      expect(running?.logTail.join('\n')).toContain('[stdin] status')
      expect(running?.logTail.join('\n')).toContain('echo:status')
    } finally {
      store.killSession(session.id)
    }
  })

  it('discovers DewDrops-managed Playwright artifacts for a local session', async () => {
    const store = new RuntimeSessionStore()
    const rootDir = mkdtempSync(join(tmpdir(), 'dewdrops-artifacts-'))
    const artifactDir = join(rootDir, '.dewdrops-artifacts', 'agent-1')
    await mkdir(join(artifactDir, 'playwright-report'), { recursive: true })
    await mkdir(join(artifactDir, 'test-results'), { recursive: true })
    await writeFile(join(artifactDir, 'playwright-report', 'index.html'), '<html>report</html>', 'utf8')
    await writeFile(join(artifactDir, 'test-results', 'failure.png'), 'png-data', 'utf8')
    await writeFile(join(artifactDir, 'playwright-junit.xml'), '<testsuite></testsuite>', 'utf8')

    const command = `${JSON.stringify(process.execPath)} -e "setTimeout(() => {}, 5000)"`
    const session = store.createSession({
      label: 'playwright-worker',
      command,
      cwd: rootDir,
      agentId: 'agent-1',
      env: {
        DEWDROPS_RUNTIME_PROFILE: 'playwright',
        DEWDROPS_RUNTIME_ROUTE: 'local',
        DEWDROPS_ARTIFACT_DIR: '.dewdrops-artifacts/agent-1',
        DEWDROPS_PLAYWRIGHT_OUTPUT_DIR: '.dewdrops-artifacts/agent-1/test-results',
        PLAYWRIGHT_HTML_OUTPUT_DIR: '.dewdrops-artifacts/agent-1/playwright-report',
        PLAYWRIGHT_JUNIT_OUTPUT_FILE: '.dewdrops-artifacts/agent-1/playwright-junit.xml',
      },
    })

    try {
      const artifacts = await store.listSessionArtifacts(session.id)
      expect(artifacts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: 'report',
            title: 'Playwright HTML report',
            path: '.dewdrops-artifacts/agent-1/playwright-report/index.html',
          }),
          expect.objectContaining({
            kind: 'image',
            path: '.dewdrops-artifacts/agent-1/test-results/failure.png',
          }),
          expect.objectContaining({
            kind: 'report',
            title: 'Playwright JUnit report',
            path: '.dewdrops-artifacts/agent-1/playwright-junit.xml',
          }),
        ]),
      )
    } finally {
      store.killSession(session.id)
    }
  })
})
