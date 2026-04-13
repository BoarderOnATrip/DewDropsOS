import { describe, expect, it } from 'vitest'
import { shouldDraggedAgentStayAttached } from './dragDetach'
import type { BoardWire, WorkflowCard } from './types'

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

describe('shouldDraggedAgentStayAttached', () => {
  it('keeps a root agent attached while it stays inside the stationary room envelope', () => {
    const cards: WorkflowCard[] = [
      problem('p1', { x: 0, y: 0, width: 240, height: 160 }),
      agent('a1', {
        x: 20,
        y: 190,
        width: 120,
        height: 90,
        assignedToProblemId: 'p1',
        parentAgentId: null,
      }),
      agent('a2', {
        x: 150,
        y: 190,
        width: 120,
        height: 90,
        assignedToProblemId: 'p1',
        parentAgentId: null,
      }),
    ]
    expect(
      shouldDraggedAgentStayAttached(
        cards[1],
        36,
        198,
        cards,
        wires,
        new Set([cards[1].id]),
      ),
    ).toBe(true)
  })

  it('detaches a root agent once it leaves the stationary room envelope', () => {
    const cards: WorkflowCard[] = [
      problem('p1', { x: 0, y: 0, width: 240, height: 160 }),
      agent('a1', {
        x: 20,
        y: 190,
        width: 120,
        height: 90,
        assignedToProblemId: 'p1',
        parentAgentId: null,
      }),
    ]
    expect(
      shouldDraggedAgentStayAttached(
        cards[1],
        360,
        260,
        cards,
        wires,
        new Set([cards[1].id]),
      ),
    ).toBe(false)
  })

  it('detaches a nested subagent once it leaves the parent branch envelope', () => {
    const cards: WorkflowCard[] = [
      problem('p1', { x: 0, y: 0, width: 240, height: 160 }),
      agent('lead', {
        x: 20,
        y: 190,
        width: 120,
        height: 90,
        assignedToProblemId: 'p1',
        parentAgentId: null,
      }),
      agent('child', {
        x: 20,
        y: 294,
        width: 120,
        height: 90,
        assignedToProblemId: 'p1',
        parentAgentId: 'lead',
      }),
    ]
    expect(
      shouldDraggedAgentStayAttached(
        cards[2],
        320,
        320,
        cards,
        wires,
        new Set([cards[2].id]),
      ),
    ).toBe(false)
  })
})
