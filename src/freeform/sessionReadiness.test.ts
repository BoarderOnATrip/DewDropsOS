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

function agent(overrides: Partial<WorkflowCard> = {}): WorkflowCard {
  return {
    id: 'agent-1',
    title: 'Builder',
    expanded: true,
    color: '#0f0',
    kind: 'agent',
    x: 0,
    y: 0,
    width: 120,
    height: 44,
    assignedToProblemId: 'p1',
    parentAgentId: null,
    ...overrides,
  }
}

function assignedAgents(count: number): WorkflowCard[] {
  return Array.from({ length: count }, (_, index) =>
    agent({
      id: `agent-${index + 1}`,
      title: `Agent ${index + 1}`,
    }),
  )
}

describe('buildProblemSessionReadiness', () => {
  it('marks a fully prepared hybrid room as launch ready', () => {
    const card = problem({
      preferredLaunchSurface: 'hybrid',
      butlerRoomId: 'room-123',
      memoryWing: 'butler',
      memoryRoom: 'phone-relay',
      memoryContextSummary: 'Cross-device operating context.',
      memoryAnchors: ['compartment/phone', 'entity/butler'],
      phoneRelayBrief: 'Escalate urgent approvals only.',
      desktopSessionBrief: 'Use the desktop session for deep implementation.',
      capabilityProfileId: 'build-local',
      swarmRecipeId: 'build-review-ship',
    })
    const blueprint = buildProblemSessionBlueprint(card, 'desktop')
    const readiness = buildProblemSessionReadiness(card, {
      workspaceMode: 'desktop',
      agentCount: 5,
      agentCards: assignedAgents(5),
      bridgeHealth: { ok: true },
      blueprint,
    })

    expect(readiness.tone).toBe('ready')
    expect(readiness.label).toBe('Launch ready')
    expect(readiness.summary).toContain('9 ready')
  })

  it('marks capability_profile as ready when a valid id is present in catalog', () => {
    const card = problem({ capabilityProfileId: 'build-local' })
    const blueprint = buildProblemSessionBlueprint(card, 'desktop')
    const readiness = buildProblemSessionReadiness(card, {
      workspaceMode: 'desktop',
      agentCount: 1,
      agentCards: assignedAgents(1),
      bridgeHealth: { ok: true },
      blueprint,
    })
    const cpItem = readiness.items.find((i) => i.id === 'capability_profile')
    expect(cpItem?.tone).toBe('ready')
  })

  it('marks capability_profile as attention when id is present but not in catalog', () => {
    const card = problem({ capabilityProfileId: 'unknown-profile-xyz' })
    const blueprint = buildProblemSessionBlueprint(card, 'desktop')
    const readiness = buildProblemSessionReadiness(card, {
      workspaceMode: 'desktop',
      agentCount: 1,
      agentCards: assignedAgents(1),
      bridgeHealth: { ok: true },
      blueprint,
    })
    const cpItem = readiness.items.find((i) => i.id === 'capability_profile')
    expect(cpItem?.tone).toBe('attention')
    expect(cpItem?.detail).toContain('not found in the catalog')
  })

  it('marks capability_profile as attention when id is missing', () => {
    const card = problem()
    const blueprint = buildProblemSessionBlueprint(card, 'desktop')
    const readiness = buildProblemSessionReadiness(card, {
      workspaceMode: 'desktop',
      agentCount: 1,
      agentCards: assignedAgents(1),
      bridgeHealth: { ok: true },
      blueprint,
    })
    const cpItem = readiness.items.find((i) => i.id === 'capability_profile')
    expect(cpItem?.tone).toBe('attention')
  })

  it('marks swarm_recipe as ready when a valid id is present in catalog', () => {
    const card = problem({ swarmRecipeId: 'build-review-ship' })
    const blueprint = buildProblemSessionBlueprint(card, 'desktop')
    const readiness = buildProblemSessionReadiness(card, {
      workspaceMode: 'desktop',
      agentCount: 1,
      agentCards: assignedAgents(1),
      bridgeHealth: { ok: true },
      blueprint,
    })
    const srItem = readiness.items.find((i) => i.id === 'swarm_recipe')
    expect(srItem?.tone).toBe('ready')
  })

  it('marks swarm_recipe as attention when id is present but not in catalog', () => {
    const card = problem({ swarmRecipeId: 'unknown-recipe-xyz' })
    const blueprint = buildProblemSessionBlueprint(card, 'desktop')
    const readiness = buildProblemSessionReadiness(card, {
      workspaceMode: 'desktop',
      agentCount: 1,
      agentCards: assignedAgents(1),
      bridgeHealth: { ok: true },
      blueprint,
    })
    const srItem = readiness.items.find((i) => i.id === 'swarm_recipe')
    expect(srItem?.tone).toBe('attention')
    expect(srItem?.detail).toContain('not found in the catalog')
  })

  it('marks swarm_recipe as attention when id is missing', () => {
    const card = problem()
    const blueprint = buildProblemSessionBlueprint(card, 'desktop')
    const readiness = buildProblemSessionReadiness(card, {
      workspaceMode: 'desktop',
      agentCount: 1,
      agentCards: assignedAgents(1),
      bridgeHealth: { ok: true },
      blueprint,
    })
    const srItem = readiness.items.find((i) => i.id === 'swarm_recipe')
    expect(srItem?.tone).toBe('attention')
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
    expect(readiness.items.find((item) => item.id === 'runtime')?.tone).toBe('missing')
    expect(readiness.items.find((item) => item.id === 'device')?.tone).toBe('missing')
    expect(readiness.items.find((item) => item.id === 'memory')?.tone).toBe('attention')
  })

  it('flags runtime setup when assigned workers are not bound to terminal envelopes', () => {
    const card = problem()
    const blueprint = buildProblemSessionBlueprint(card, 'desktop')
    const readiness = buildProblemSessionReadiness(card, {
      workspaceMode: 'desktop',
      agentCount: 1,
      agentCards: [
        agent({
          agentRuntime: {
            kind: 'service',
            profile: 'paperclip',
            transport: 'api',
            instanceLabel: 'paperclip-remote',
          },
        }),
      ],
      bridgeHealth: { ok: true },
      blueprint,
    })

    expect(readiness.items.find((item) => item.id === 'runtime')?.tone).toBe('missing')
  })

  it('adds a ready publish approval gate when the room encodes reviewed social release hooks', () => {
    const card = problem({
      preferredLaunchSurface: 'hybrid',
      butlerRoomId: 'room-diymovie-publish',
      phoneRelayBrief: 'Escalate only contradictions before publish.',
      desktopSessionBrief: 'Prepare the approval packet and stop before posting.',
      memoryWing: 'diymovie',
      memoryRoom: 'story-forge',
      memoryContextSummary: 'Story, capture, edit, and publish stay in one room.',
      memoryAnchors: [
        'artifact/diymovie/publish-approval-packet',
        'social/instagram-reels',
        'social/tiktok',
      ],
      capabilityProfileId: 'build-local',
      swarmRecipeId: 'build-review-ship',
      memoryPalaceLoci: [
        {
          id: 'publish-gate',
          title: 'Publish Gate',
          kind: 'checkpoint',
          detail: 'Final human review before release.',
        },
      ],
      briefSpec: {
        id: 'brief-1',
        creative: {
          mission: 'Ship the movie room.',
          beneficiary: 'Creator',
          references: [],
        },
        execution: {
          task: 'Prepare the publish approval packet.',
          acceptanceCriteria: [
            {
              id: 'approval-gate',
              description: 'A human review gate exists before publishing any social cutdown.',
            },
          ],
          scope: { in: ['Publish packet'], out: ['Autonomous posting'] },
          antiPatterns: ['Publishing without approval'],
          deliverables: ['Publish approval packet'],
        },
        escalationPolicy: 'outcome-contradiction-only',
        autonomyPolicy: 'milestone-checkpoint',
        projectId: 'diy-movie',
      },
    })
    const blueprint = buildProblemSessionBlueprint(card, 'desktop')
    const readiness = buildProblemSessionReadiness(card, {
      workspaceMode: 'desktop',
      agentCount: 2,
      agentCards: assignedAgents(2),
      bridgeHealth: { ok: true },
      blueprint,
    })

    const approvalItem = readiness.items.find((item) => item.id === 'approval_gate')
    expect(approvalItem?.tone).toBe('ready')
    expect(approvalItem?.detail).toContain('Instagram Reels')
    expect(readiness.label).toBe('Launch ready')
  })
})
