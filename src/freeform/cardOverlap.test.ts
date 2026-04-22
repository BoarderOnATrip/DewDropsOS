import { describe, expect, it } from 'vitest'
import type { WorkflowCard } from './types'
import {
  agentSubUnionBounds,
  bestGroupProblemTarget,
  bestParentAgentTarget,
  bestProblemOverlap,
  countSubagents,
  isDescendantAgent,
  rectIntersectionArea,
  wouldCreateParentCycle,
} from './cardOverlap'

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

describe('rectIntersectionArea', () => {
  it('returns 0 when disjoint', () => {
    expect(rectIntersectionArea(0, 0, 10, 10, 20, 0, 10, 10)).toBe(0)
  })

  it('returns product for full overlap', () => {
    expect(rectIntersectionArea(0, 0, 10, 10, 5, 5, 10, 10)).toBe(25)
  })
})

describe('bestProblemOverlap', () => {
  it('picks largest overlapping problem', () => {
    const a = agent('a', { x: 0, y: 0, width: 50, height: 50 })
    const p1 = problem('p1', { x: 0, y: 0, width: 10, height: 10 })
    const p2 = problem('p2', { x: 0, y: 0, width: 30, height: 30 })
    expect(bestProblemOverlap(a, [p1, p2])?.id).toBe('p2')
  })
})

describe('bestGroupProblemTarget', () => {
  it('keeps a shared problem target even when only part of the dragged group overlaps it', () => {
    const cards: WorkflowCard[] = [
      problem('p1', { x: 100, y: 100, width: 260, height: 180 }),
      agent('a1', { x: 130, y: 130, width: 120, height: 80 }),
      agent('a2', { x: 390, y: 130, width: 120, height: 80 }),
    ]
    expect(bestGroupProblemTarget(new Set(['a1', 'a2']), cards)?.id).toBe('p1')
  })

  it('picks the dominant problem across the dragged group', () => {
    const cards: WorkflowCard[] = [
      problem('p1', { x: 0, y: 0, width: 140, height: 120 }),
      problem('p2', { x: 220, y: 0, width: 260, height: 220 }),
      agent('a1', { x: 20, y: 20, width: 120, height: 80 }),
      agent('a2', { x: 250, y: 30, width: 140, height: 100 }),
      agent('a3', { x: 280, y: 100, width: 120, height: 80 }),
    ]
    expect(bestGroupProblemTarget(new Set(['a1', 'a2', 'a3']), cards)?.id).toBe('p2')
  })
})

describe('parent cycle and descendants', () => {
  it('detects descendant chain', () => {
    const cards: WorkflowCard[] = [
      agent('root', { x: 0, y: 0, width: 10, height: 10, parentAgentId: null }),
      agent('child', {
        x: 0,
        y: 0,
        width: 10,
        height: 10,
        parentAgentId: 'root',
        assignedToProblemId: null,
      }),
    ]
    expect(isDescendantAgent('child', 'root', cards)).toBe(true)
    expect(wouldCreateParentCycle('root', 'child', cards)).toBe(true)
  })
})

describe('bestParentAgentTarget', () => {
  it('skips targets that would create a cycle', () => {
    const cards: WorkflowCard[] = [
      agent('a', { x: 0, y: 0, width: 100, height: 50, parentAgentId: null }),
      agent('b', { x: 10, y: 10, width: 100, height: 50, parentAgentId: 'a' }),
    ]
    expect(bestParentAgentTarget(cards[0], cards)).toBeNull()
  })
})

describe('agentSubUnionBounds', () => {
  it('includes parent and direct subagents', () => {
    const cards: WorkflowCard[] = [
      agent('p', { x: 100, y: 100, width: 200, height: 40, parentAgentId: null }),
      agent('s', { x: 0, y: 0, width: 50, height: 50, parentAgentId: 'p' }),
    ]
    const u = agentSubUnionBounds('p', cards)!
    expect(u.minX).toBe(0)
    expect(u.minY).toBe(0)
    expect(u.maxX).toBe(300)
  })
})

describe('countSubagents', () => {
  it('counts direct children only', () => {
    const cards: WorkflowCard[] = [
      agent('p', { x: 0, y: 0, width: 10, height: 10, parentAgentId: null }),
      agent('c1', { x: 0, y: 0, width: 10, height: 10, parentAgentId: 'p' }),
      agent('c2', { x: 0, y: 0, width: 10, height: 10, parentAgentId: 'p' }),
    ]
    expect(countSubagents('p', cards)).toBe(2)
  })
})
