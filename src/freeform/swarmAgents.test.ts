import { describe, expect, it } from 'vitest'
import type { BoardWire, WorkflowCard } from './types'
import {
  agentsInProblemSwarm,
  expandBounds,
  normalizeProblemFootprint,
  pointInBounds,
  swarmMassForProblem,
  swarmUnionBounds,
} from './swarmAgents'

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

describe('agentsInProblemSwarm', () => {
  it('includes root-assigned agents and nested subagents', () => {
    const pid = 'p1'
    const cards: WorkflowCard[] = [
      problem(pid, { x: 0, y: 0, width: 200, height: 100 }),
      agent('a1', {
        x: 0,
        y: 0,
        width: 100,
        height: 50,
        assignedToProblemId: pid,
        parentAgentId: null,
      }),
      agent('a2', {
        x: 0,
        y: 0,
        width: 100,
        height: 50,
        assignedToProblemId: null,
        parentAgentId: 'a1',
      }),
    ]
    const swarm = agentsInProblemSwarm(pid, cards, wires)
    expect(swarm.map((c) => c.id).sort()).toEqual(['a1', 'a2'])
  })

  it('excludes agents assigned to other problems', () => {
    const cards: WorkflowCard[] = [
      problem('p1', { x: 0, y: 0, width: 100, height: 80 }),
      agent('a1', {
        x: 0,
        y: 0,
        width: 100,
        height: 50,
        assignedToProblemId: 'p2',
        parentAgentId: null,
      }),
    ]
    expect(agentsInProblemSwarm('p1', cards, wires)).toHaveLength(0)
  })
})

describe('swarmMassForProblem', () => {
  it('matches swarm length', () => {
    const pid = 'p1'
    const cards: WorkflowCard[] = [
      problem(pid, { x: 0, y: 0, width: 200, height: 100 }),
      agent('a1', {
        x: 0,
        y: 0,
        width: 100,
        height: 50,
        assignedToProblemId: pid,
        parentAgentId: null,
      }),
    ]
    expect(swarmMassForProblem(pid, cards, wires)).toBe(1)
  })
})

describe('swarmUnionBounds', () => {
  it('returns null when problem is missing', () => {
    expect(swarmUnionBounds('missing', [], wires)).toBeNull()
  })

  it('includes hub and swarm agent rectangles', () => {
    const pid = 'p1'
    const cards: WorkflowCard[] = [
      problem(pid, { x: 100, y: 50, width: 200, height: 80 }),
      agent('a1', {
        x: 0,
        y: 0,
        width: 120,
        height: 40,
        assignedToProblemId: pid,
        parentAgentId: null,
      }),
    ]
    const u = swarmUnionBounds(pid, cards, wires)!
    expect(u.minX).toBe(0)
    expect(u.minY).toBe(0)
    expect(u.maxX).toBe(300)
    expect(u.maxY).toBe(130)
  })
})

describe('expandBounds and pointInBounds', () => {
  it('expands uniformly and detects interior points', () => {
    const b = { minX: 0, minY: 0, maxX: 10, maxY: 10 }
    const e = expandBounds(b, 5)
    expect(pointInBounds(0, 0, e)).toBe(true)
    expect(pointInBounds(-5, -5, e)).toBe(true)
    expect(pointInBounds(-6, 0, e)).toBe(false)
  })
})

describe('normalizeProblemFootprint', () => {
  it('shrinks width by swarm mass when bases are inferred', () => {
    const pid = 'p1'
    const cards: WorkflowCard[] = [
      {
        ...problem(pid, { x: 0, y: 0, width: 200, height: 100 }),
        problemBaseWidth: undefined,
        problemBaseHeight: undefined,
      },
      agent('a1', {
        x: 0,
        y: 0,
        width: 100,
        height: 50,
        assignedToProblemId: pid,
        parentAgentId: null,
      }),
    ]
    const next = normalizeProblemFootprint(cards, wires)
    const p = next.find((c) => c.id === pid)!
    expect(p.width).toBe(178)
    expect(p.height).toBe(86)
    expect(p.problemBaseWidth).toBe(178)
    expect(p.problemBaseHeight).toBe(86)
  })

  it('returns same array reference when nothing changes', () => {
    const pid = 'p1'
    const cards: WorkflowCard[] = [
      {
        ...problem(pid, { x: 0, y: 0, width: 120, height: 80 }),
        problemBaseWidth: 120,
        problemBaseHeight: 80,
      },
    ]
    expect(normalizeProblemFootprint(cards, wires)).toBe(cards)
  })
})
