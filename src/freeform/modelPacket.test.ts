import { describe, expect, it } from 'vitest'
import type { BoardWire, WorkflowCard } from './types'
import { buildProblemModelPacket, buildProblemModelRoute } from './modelPacket'

const wires: BoardWire[] = []

function problem(overrides: Partial<WorkflowCard> = {}): WorkflowCard {
  return {
    id: 'problem-1',
    title: 'Launch room',
    mission: 'Ship the launch loop.',
    expanded: true,
    color: '#fff',
    kind: 'problem',
    x: 0,
    y: 0,
    width: 320,
    height: 220,
    ...overrides,
  }
}

describe('buildProblemModelRoute', () => {
  it('keeps compact rooms on the local-first lane', () => {
    const room = problem({
      briefSpec: {
        id: 'brief-1',
        creative: {
          mission: 'Triage the room.',
          beneficiary: 'Operator',
          references: [],
        },
        execution: {
          task: 'Classify the next moves.',
          acceptanceCriteria: [],
          scope: { in: ['Triage'], out: [] },
          antiPatterns: [],
          deliverables: ['Short triage note'],
        },
        escalationPolicy: 'outcome-contradiction-only',
        autonomyPolicy: 'full-auto',
      },
    })

    const route = buildProblemModelRoute(room, [room], wires)
    expect(route.strategy).toBe('local_first')
    expect(route.primary).toBe('ollama')
  })

  it('routes publish-gated rooms through the frontier lane first', () => {
    const room = problem({
      memoryAnchors: ['social/instagram-reels'],
      swarmRecipeId: 'build-review-ship',
      briefSpec: {
        id: 'brief-1',
        creative: {
          mission: 'Ship the cut.',
          beneficiary: 'Creator',
          references: [],
        },
        execution: {
          task: 'Prepare a publish-ready packet.',
          acceptanceCriteria: [
            { id: 'approval-gate', description: 'A human review gate exists before publish.' },
          ],
          scope: { in: ['Publish packet'], out: [] },
          antiPatterns: [],
          deliverables: ['Approval packet'],
        },
        escalationPolicy: 'outcome-contradiction-only',
        autonomyPolicy: 'milestone-checkpoint',
      },
    })

    const route = buildProblemModelRoute(room, [room], wires)
    expect(route.strategy).toBe('frontier_first')
    expect(route.primary).toBe('frontier')
  })
})

describe('buildProblemModelPacket', () => {
  it('builds a compact packet and objective from room state', () => {
    const room = problem({
      openQuestions: ['API key?'],
      briefSpec: {
        id: 'brief-1',
        creative: {
          mission: 'Ship the launch loop.',
          beneficiary: 'Operator',
          references: [],
        },
        execution: {
          task: 'Prepare the launch-ready packet.',
          acceptanceCriteria: [{ id: 'ac-1', description: 'Packet is compact.' }],
          scope: { in: ['Packet'], out: [] },
          antiPatterns: [],
          deliverables: ['Compact packet', 'Launch note'],
        },
        escalationPolicy: 'outcome-contradiction-only',
        autonomyPolicy: 'full-auto',
      },
      runLedger: [
        {
          runId: 'run-1',
          contractId: 'contract-1',
          roomId: 'problem-1',
          title: 'Earlier pass',
          status: 'complete',
          startedAt: '2026-04-22T01:00:00.000Z',
          artifacts: [
            {
              id: 'artifact-1',
              runId: 'run-1',
              kind: 'note',
              title: 'Launch note',
              summary: 'A compact launch note.',
              createdAt: '2026-04-22T01:10:00.000Z',
            },
          ],
        },
      ],
    })
    const worker: WorkflowCard = {
      id: 'agent-1',
      title: 'Planner',
      expanded: true,
      color: '#fff',
      kind: 'agent',
      x: 420,
      y: 0,
      width: 160,
      height: 100,
      assignedToProblemId: room.id,
      parentAgentId: null,
    }

    const packet = buildProblemModelPacket(room, [room, worker], wires, 'desktop', {
      template: 'planning',
    })

    expect(packet.objectiveText).toContain('Task: Prepare the launch-ready packet.')
    expect(packet.objectiveText).toContain('Resolve: API key?')
    expect(packet.objectiveText).toContain('Workers: Planner(shell)')
    expect(packet.packetText).toContain('ddpk:v1')
    expect(packet.packetText).toContain('route:')
    expect(packet.packetText).toContain('artifacts:Launch note')
    expect(packet.packetText).toContain('context:attached briefPacket + rtk_basis + handoff_packet + source_refs')
    expect(packet.stats.lineCount).toBeGreaterThan(4)
  })
})
