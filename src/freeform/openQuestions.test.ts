import { describe, expect, it } from 'vitest'
import type { BoardWire, WorkflowCard } from './types'
import { descendantHasOpenQuestions, openQuestionsForCard } from './openQuestions'

const wires: BoardWire[] = []

function problem(
  id: string,
  overrides: Partial<WorkflowCard> & Pick<WorkflowCard, 'x' | 'y' | 'width' | 'height'>,
): WorkflowCard {
  return {
    id,
    title: id,
    expanded: true,
    color: '#fff',
    kind: 'problem',
    ...overrides,
  }
}

function agent(
  id: string,
  overrides: Partial<WorkflowCard> & Pick<WorkflowCard, 'x' | 'y' | 'width' | 'height'>,
): WorkflowCard {
  return {
    id,
    title: id,
    expanded: true,
    color: '#fff',
    kind: 'agent',
    ...overrides,
  }
}

describe('openQuestionsForCard', () => {
  it('adds structural question when problem has no swarm', () => {
    const p = problem('p1', { x: 0, y: 0, width: 100, height: 80 })
    const qs = openQuestionsForCard(p, [p], wires)
    expect(qs).toHaveLength(1)
    expect(qs[0]).toContain('No specialists combined')
  })

  it('does not add structural when swarm exists', () => {
    const pid = 'p1'
    const p = problem(pid, { x: 0, y: 0, width: 100, height: 80 })
    const a = agent('a1', {
      x: 0,
      y: 0,
      width: 50,
      height: 40,
      assignedToProblemId: pid,
      parentAgentId: null,
    })
    expect(openQuestionsForCard(p, [p, a], wires)).toEqual([])
  })

  it('merges explicit openQuestions with structural', () => {
    const p = problem('p1', {
      x: 0,
      y: 0,
      width: 100,
      height: 80,
      openQuestions: ['  Ship v1?  '],
    })
    const qs = openQuestionsForCard(p, [p], wires)
    expect(qs[0]).toBe('Ship v1?')
    expect(qs.some((s) => s.includes('No specialists'))).toBe(true)
  })
})

describe('descendantHasOpenQuestions', () => {
  it('is true when a subagent has open questions', () => {
    const cards: WorkflowCard[] = [
      agent('root', { x: 0, y: 0, width: 50, height: 50, parentAgentId: null }),
      agent('sub', {
        x: 0,
        y: 0,
        width: 50,
        height: 50,
        parentAgentId: 'root',
        openQuestions: ['Blocked'],
      }),
    ]
    expect(descendantHasOpenQuestions('root', cards, wires)).toBe(true)
  })
})
