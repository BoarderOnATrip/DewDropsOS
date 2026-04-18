import { describe, expect, it } from 'vitest'
import { buildProblemSessionBlueprint } from './sessionBlueprint'
import { buildProblemSessionReadiness } from './sessionReadiness'
import type { WorkflowCard } from './types'

function problem(overrides: Partial<WorkflowCard> = {}): WorkflowCard {
  return {
    id: 'p1',
    title: 'Phone Butler MVP',
    expanded: true,
    color: '#fff',
    kind: 'problem',
    x: 0,
    y: 0,
    width: 280,
    height: 180,
    ...overrides,
  }
}

describe('buildProblemSessionReadiness', () => {
  it('marks a fully prepared hybrid room as launch ready', () => {
    const card = problem({
      preferredLaunchSurface: 'hybrid',
      butlerRoomId: 'room-123',
      memoryWing: 'butler',
      memoryRoom: 'phone-relay',
      memoryContextSummary: 'Cross-device operating context.',
      memoryAnchors: ['drawer/phone', 'entity/butler'],
      phoneRelayBrief: 'Escalate urgent approvals only.',
      desktopSessionBrief: 'Use the desktop session for deep implementation.',
    })
    const blueprint = buildProblemSessionBlueprint(card, 'desktop')
    const readiness = buildProblemSessionReadiness(card, {
      workspaceMode: 'desktop',
      agentCount: 5,
      bridgeHealth: { ok: true },
      blueprint,
    })

    expect(readiness.tone).toBe('ready')
    expect(readiness.label).toBe('Launch ready')
    expect(readiness.summary).toContain('6 ready')
  })

  it('flags missing bridge, staffing, and phone brief setup', () => {
    const card = problem({
      preferredLaunchSurface: 'phone',
    })
    const blueprint = buildProblemSessionBlueprint(card, 'phone')
    const readiness = buildProblemSessionReadiness(card, {
      workspaceMode: 'phone',
      agentCount: 0,
      bridgeHealth: null,
      blueprint,
    })

    expect(readiness.tone).toBe('missing')
    expect(readiness.label).toBe('Needs setup')
    expect(readiness.items.find((item) => item.id === 'bridge')?.tone).toBe('missing')
    expect(readiness.items.find((item) => item.id === 'swarm')?.tone).toBe('missing')
    expect(readiness.items.find((item) => item.id === 'device')?.tone).toBe('missing')
    expect(readiness.items.find((item) => item.id === 'memory')?.tone).toBe('attention')
  })
})
