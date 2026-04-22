import { describe, expect, it } from 'vitest'
import {
  DEFAULT_OLLAMA_MODEL_TAG,
  defaultTerminalRuntime,
  defaultRuntimeForProfile,
  defaultCommandForRuntimeProfile,
  defaultModelTagForRuntimeProfile,
  normalizeAgentRuntime,
  pickerRuntimeProfile,
} from './agentRuntime'

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

  it('provides browser worker defaults for browser harness profiles', () => {
    expect(defaultCommandForRuntimeProfile('hermes')).toBe('hermes')
    expect(defaultCommandForRuntimeProfile('ollama')).toBe(`ollama run ${DEFAULT_OLLAMA_MODEL_TAG}`)
    expect(defaultCommandForRuntimeProfile('ollama', { modelTag: 'my-model:latest' })).toBe('ollama run my-model:latest')
    expect(defaultCommandForRuntimeProfile('browser-harness')).toBe('browser-harness')
    expect(defaultCommandForRuntimeProfile('browser-harness-js')).toBe('browser-harness-js')
    expect(defaultCommandForRuntimeProfile('playwright')).toBe('npx playwright test')
  })

  it('preserves browser worker profiles instead of collapsing them back to a plain shell', () => {
    const runtime = normalizeAgentRuntime(
      {
        kind: 'terminal',
        profile: 'browser-harness',
        transport: 'cli',
        instanceLabel: 'browser-1',
        command: 'browser-harness',
      },
      { cardId: 'agent-1', title: 'Browser worker' },
    )

    expect(runtime.profile).toBe('browser-harness')
    expect(runtime.command).toBe('browser-harness')
  })

  it('maps legacy runtime profiles back to the shell picker', () => {
    expect(pickerRuntimeProfile('openclaw')).toBe('custom')
    expect(pickerRuntimeProfile('paperclip')).toBe('custom')
    expect(pickerRuntimeProfile('hermes')).toBe('hermes')
    expect(pickerRuntimeProfile('ollama')).toBe('ollama')
    expect(defaultModelTagForRuntimeProfile('ollama')).toBe(DEFAULT_OLLAMA_MODEL_TAG)
  })

  it('defaults new DewDrops to local shells without an implicit host alias', () => {
    const runtime = defaultTerminalRuntime('agent-1', 'Worker 1')

    expect(runtime.profile).toBe('custom')
    expect(runtime.command).toBe('zsh -i -f')
    expect(runtime.vpnAlias).toBeUndefined()
  })

  it('builds profile-specific defaults for Hermes nodes', () => {
    const runtime = defaultRuntimeForProfile('agent-1', 'Hermes 1', 'hermes')

    expect(runtime.profile).toBe('hermes')
    expect(runtime.command).toBe('hermes')
    expect(runtime.workspaceRoot).toBe('.')
    expect(runtime.vpnAlias).toBeUndefined()
  })

  it('builds profile-specific defaults for local model nodes', () => {
    const runtime = defaultRuntimeForProfile('agent-1', 'Local model 1', 'ollama')

    expect(runtime.profile).toBe('ollama')
    expect(runtime.modelTag).toBe(DEFAULT_OLLAMA_MODEL_TAG)
    expect(runtime.command).toBe(`ollama run ${DEFAULT_OLLAMA_MODEL_TAG}`)
    expect(runtime.workspaceRoot).toBe('.')
    expect(runtime.vpnAlias).toBeUndefined()
  })

  it('infers the Ollama model tag from legacy commands when the structured field is missing', () => {
    const runtime = normalizeAgentRuntime(
      {
        kind: 'terminal',
        profile: 'ollama',
        transport: 'cli',
        instanceLabel: 'model-1',
        command: 'ollama run llama3.1:8b',
      },
      { cardId: 'agent-1', title: 'Model worker' },
    )

    expect(runtime.modelTag).toBe('llama3.1:8b')
    expect(runtime.command).toBe('ollama run llama3.1:8b')
  })

  it('builds profile-specific defaults for Playwright nodes', () => {
    const runtime = defaultRuntimeForProfile('agent-1', 'Playwright 1', 'playwright')

    expect(runtime.profile).toBe('playwright')
    expect(runtime.command).toBe('npx playwright test')
    expect(runtime.workspaceRoot).toBe('.')
    expect(runtime.vpnAlias).toBeUndefined()
  })
})
