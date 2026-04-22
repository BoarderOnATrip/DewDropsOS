import { describe, expect, it } from 'vitest'
import type { BoardWire, WorkflowCard } from './types'
import { buildProblemSwarmObjective } from './boardObjective'

const wires: BoardWire[] = []

describe('buildProblemSwarmObjective', () => {
  it('builds a compact objective that points the model at attached structured context', () => {
    const pid = 'p1'
    const problem: WorkflowCard = {
      id: pid,
      title: 'Launch',
      mission: 'Ship the board.',
      expanded: true,
      color: '#fff',
      kind: 'problem',
      x: 0,
      y: 0,
      width: 100,
      height: 80,
      openQuestions: ['API key?'],
      memoryWing: 'launch-wing',
      memoryRoom: 'operator-brief',
      memoryContextSummary: 'Carry the current launch context across surfaces.',
      memoryAnchors: ['compartment/launch'],
      memoryPalaceLoci: [
        {
          id: 'north-star',
          title: 'North Star',
          kind: 'north_star',
          detail: 'Keep the launch north star visible.',
        },
      ],
      phoneRelayBrief: 'Only escalate blockers from the field.',
      paperclipCompanyId: 'company-1',
      paperclipProjectId: 'project-1',
      paperclipLeadAgentId: 'agent-lead',
      paperclipAgentIds: ['agent-lead', 'agent-review'],
    }
    const cards: WorkflowCard[] = [
      problem,
      {
        id: 'ag',
        title: 'Worker',
        expanded: true,
        color: '#fff',
        kind: 'agent',
        x: 0,
        y: 0,
        width: 50,
        height: 40,
        assignedToProblemId: pid,
        parentAgentId: null,
      },
    ]
    const text = buildProblemSwarmObjective(problem, cards, wires, 'phone')
    expect(text).toContain('Launch')
    expect(text).toContain('Task: Ship the board.')
    expect(text).toContain('Resolve: API key?')
    expect(text).toContain('Workers: Worker(shell)')
    expect(text).toContain('Context: use attached BriefPacket, RTK basis, handoff packet, and source refs.')
  })
})
