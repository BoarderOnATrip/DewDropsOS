import { describe, expect, it } from 'vitest'
import { buildDewDropBootstrapPlan, dewDropRouteLabel } from './dewdropBootstrap'
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

describe('dewdropBootstrap', () => {
  it('reports local routes when no host alias is configured', () => {
    expect(dewDropRouteLabel(runtime())).toBe('local')
  })

  it('builds a Hermes bootstrap plan', () => {
    const plan = buildDewDropBootstrapPlan(
      runtime({
        profile: 'hermes',
        command: 'hermes',
      }),
    )

    expect(plan?.title).toBe('Hermes node bootstrap')
    expect(plan?.commands.join('\n')).toContain('hermes setup')
    expect(plan?.routeLabel).toBe('local')
  })

  it('builds a remote browser harness bootstrap plan', () => {
    const plan = buildDewDropBootstrapPlan(
      runtime({
        profile: 'browser-harness',
        command: 'browser-harness',
        workspaceRoot: '/srv/browser',
        vpnAlias: 'builder-01',
      }),
    )

    expect(plan?.title).toBe('Browser worker bootstrap')
    expect(plan?.routeLabel).toBe('vpn-ssh via builder-01')
    expect(plan?.commands.join('\n')).toContain('browser-use/browser-harness')
    expect(plan?.notes.join('\n')).toContain('builder-01')
  })

  it('builds a Playwright bootstrap plan', () => {
    const plan = buildDewDropBootstrapPlan(
      runtime({
        profile: 'playwright',
        command: 'npx playwright test',
        workspaceRoot: '/srv/playwright',
      }),
    )

    expect(plan?.title).toBe('Playwright node bootstrap')
    expect(plan?.commands.join('\n')).toContain('npm install -D @playwright/test')
    expect(plan?.commands.join('\n')).toContain('npx playwright install --with-deps chromium')
    expect(plan?.notes.join('\n')).toContain('PLAYWRIGHT_BROWSERS_PATH')
  })
})
