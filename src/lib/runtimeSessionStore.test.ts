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
})
