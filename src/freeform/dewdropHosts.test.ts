import { describe, expect, it } from 'vitest'
import {
  describeDewDropHostStatus,
  getDewDropHost,
  listDewDropHostSuggestions,
  summarizeDewDropHostBindings,
} from './dewdropHosts'
import type { AgentRuntimeBinding } from './types'

function runtime(overrides: Partial<AgentRuntimeBinding> = {}): AgentRuntimeBinding {
  return {
    kind: 'terminal',
    profile: 'custom',
    transport: 'cli',
    instanceLabel: 'node-1',
    command: 'zsh -i -f',
    workspaceRoot: '.',
    ...overrides,
  }
}

describe('dewdropHosts', () => {
  it('returns known host records by alias', () => {
    const host = getDewDropHost('builder-01')
    expect(host?.label).toBe('Builder 01')
    expect(host?.route).toBe('vpn-ssh')
  })

  it('describes unknown hosts clearly', () => {
    const status = describeDewDropHostStatus(runtime({ vpnAlias: 'mystery-box' }))
    expect(status.tone).toBe('missing')
    expect(status.label).toBe('Unknown host')
  })

  it('filters host suggestions by runtime profile', () => {
    const suggestions = listDewDropHostSuggestions(runtime({ profile: 'browser-harness' }))
    expect(suggestions.map((host) => host.value)).toContain('browser-01')
    expect(suggestions.map((host) => host.value)).not.toContain('gpu-01')
  })

  it('offers builder and browser hosts for Playwright nodes', () => {
    const suggestions = listDewDropHostSuggestions(runtime({ profile: 'playwright' }))
    expect(suggestions.map((host) => host.value)).toContain('builder-01')
    expect(suggestions.map((host) => host.value)).toContain('browser-01')
    expect(suggestions.map((host) => host.value)).not.toContain('gpu-01')
  })

  it('treats unchecked remote hosts as attention', () => {
    const summary = summarizeDewDropHostBindings([
      runtime(),
      runtime({ vpnAlias: 'builder-01' }),
    ])

    expect(summary.tone).toBe('attention')
    expect(summary.detail).toContain('1 local')
    expect(summary.detail).toContain('pending check')
  })

  it('summarizes known and local host bindings with live reachability', () => {
    const summary = summarizeDewDropHostBindings(
      [
        runtime(),
        runtime({ vpnAlias: 'builder-01' }),
      ],
      {
        'builder-01': {
          tone: 'ready',
          label: 'Builder 01 reachable',
          detail: 'SSH reached the host and the DewDrop route is available.',
        },
      },
    )

    expect(summary.tone).toBe('ready')
    expect(summary.detail).toContain('1 local')
    expect(summary.detail).toContain('1 on Builder 01 reachable')
  })
})
