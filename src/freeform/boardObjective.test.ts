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
    const text = buildProblemSwarmObjective(problem, cards, wires)
    expect(text).toContain('Launch')
    expect(text).toContain('Ship the board.')
    expect(text).toContain('API key?')
    expect(text).toContain('Worker')
    expect(text).toContain('DewDrops problem room')
  })
})
