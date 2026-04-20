import { describe, expect, it } from 'vitest'
import { normalizeAgentRuntime } from './agentRuntime'

describe('normalizeAgentRuntime', () => {
  it('migrates legacy provider-shaped DewDrops back to a plain shell terminal', () => {
    const runtime = normalizeAgentRuntime(
      {
        kind: 'terminal',
        profile: 'openclaw',
        transport: 'cli',
        instanceLabel: 'writer-1',
        command: 'openclaw',
      },
      { cardId: 'agent-1', title: 'Writer' },
    )

    expect(runtime.profile).toBe('custom')
    expect(runtime.command).toBe('zsh -i -f')
  })

  it('preserves a user-authored terminal command on custom DewDrops', () => {
    const runtime = normalizeAgentRuntime(
      {
        kind: 'terminal',
        profile: 'custom',
        transport: 'cli',
        instanceLabel: 'writer-1',
        command: 'codex',
      },
      { cardId: 'agent-1', title: 'Writer' },
    )

    expect(runtime.profile).toBe('custom')
    expect(runtime.command).toBe('codex')
  })
})
