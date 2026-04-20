import { describe, expect, it } from 'vitest'
import type { BoardWire, WorkflowCard } from './types'
import { buildProblemSwarmObjective } from './boardObjective'

const wires: BoardWire[] = []

describe('buildProblemSwarmObjective', () => {
  it('includes title, mission, open questions, and swarm titles', () => {
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
    expect(text).toContain('Ship the board.')
    expect(text).toContain('API key?')
    expect(text).toContain('Worker')
    expect(text).toContain('Worker terminals')
    expect(text).toContain('terminal in .')
    expect(text).toContain('Memory palace context')
    expect(text).toContain('launch-wing')
    expect(text).toContain('Visual loci')
    expect(text).toContain('North Star (north_star)')
    expect(text).toContain('Device handoff packet')
    expect(text).toContain('Phone relay')
    expect(text).toContain('Paperclip routing')
    expect(text).toContain('company-1')
    expect(text).toContain('agent-review')
    expect(text).toContain('active execution control plane')
  })
})
