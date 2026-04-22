import { describe, expect, it } from 'vitest'
import { buildWorkerTerminalLaunchPlan } from './workerTerminalLaunch'

describe('buildWorkerTerminalLaunchPlan', () => {
  it('builds a local launch plan for normal DewDrops', () => {
    const plan = buildWorkerTerminalLaunchPlan({
      agentId: 'agent-1',
      title: 'Builder',
      runtime: {
        kind: 'terminal',
        profile: 'browser-harness',
        transport: 'cli',
        instanceLabel: 'builder',
        command: 'browser-harness',
        workspaceRoot: './workspace',
      },
      workspaceId: 'workspace-1',
      problemId: 'problem-1',
    })

    expect(plan.route).toBe('local')
    expect(plan.command).toBe('browser-harness')
    expect(plan.cwd).toBe('./workspace')
    expect(plan.env).toMatchObject({
      DEWDROPS_RUNTIME_PROFILE: 'browser-harness',
      DEWDROPS_RUNTIME_ROUTE: 'local',
      DEWDROPS_ARTIFACT_DIR: '.dewdrops-artifacts/agent-1',
    })
    expect(plan.launchFile).toBeUndefined()
  })

  it('builds an ssh launch plan when a VPN host is set', () => {
    const plan = buildWorkerTerminalLaunchPlan({
      agentId: 'agent-2',
      title: 'Browser worker',
      runtime: {
        kind: 'terminal',
        profile: 'browser-harness',
        transport: 'cli',
        instanceLabel: 'browser-worker',
        command: 'browser-harness',
        workspaceRoot: '/srv/browser',
        vpnAlias: 'builder-01',
      },
      workspaceId: 'workspace-1',
      problemId: 'problem-1',
    })

    expect(plan.route).toBe('vpn-ssh')
    expect(plan.command).toBe('ssh builder-01 :: browser-harness')
    expect(plan.launchFile).toBe('ssh')
    expect(plan.launchArgs).toEqual([
      '-tt',
      '-o',
      'BatchMode=yes',
      '-o',
      'StrictHostKeyChecking=accept-new',
      'builder-01',
      "cd '/srv/browser' && exec browser-harness",
    ])
    expect(plan.cwd).toBeUndefined()
    expect(plan.env).toMatchObject({
      DEWDROPS_RUNTIME_VPN_ALIAS: 'builder-01',
      DEWDROPS_RUNTIME_ROUTE: 'vpn-ssh',
    })
  })

  it('uses Hermes defaults when a DewDrop is configured as a Hermes node', () => {
    const plan = buildWorkerTerminalLaunchPlan({
      agentId: 'agent-3',
      title: 'Hermes node',
      runtime: {
        kind: 'terminal',
        profile: 'hermes',
        transport: 'cli',
        instanceLabel: 'hermes-node',
      },
    })

    expect(plan.route).toBe('local')
    expect(plan.command).toBe('hermes')
    expect(plan.env).toMatchObject({
      DEWDROPS_RUNTIME_PROFILE: 'hermes',
      DEWDROPS_RUNTIME_ROUTE: 'local',
    })
  })

  it('adds DewDrops-managed output routing for Playwright nodes', () => {
    const plan = buildWorkerTerminalLaunchPlan({
      agentId: 'agent-4',
      title: 'Playwright node',
      runtime: {
        kind: 'terminal',
        profile: 'playwright',
        transport: 'cli',
        instanceLabel: 'playwright-node',
        command: 'npx playwright test',
        workspaceRoot: '.',
      },
    })

    expect(plan.route).toBe('local')
    expect(plan.command).toContain('--output .dewdrops-artifacts/agent-4/test-results')
    expect(plan.command).toContain('--reporter=line,html,junit')
    expect(plan.command).toContain('--trace=retain-on-failure')
    expect(plan.env).toMatchObject({
      DEWDROPS_RUNTIME_PROFILE: 'playwright',
      DEWDROPS_ARTIFACT_DIR: '.dewdrops-artifacts/agent-4',
      DEWDROPS_PLAYWRIGHT_OUTPUT_DIR: '.dewdrops-artifacts/agent-4/test-results',
      PLAYWRIGHT_HTML_OUTPUT_DIR: '.dewdrops-artifacts/agent-4/playwright-report',
      PLAYWRIGHT_JUNIT_OUTPUT_FILE: '.dewdrops-artifacts/agent-4/playwright-junit.xml',
    })
  })
})
