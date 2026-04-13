import { describe, expect, it } from 'vitest'
import type { WorkflowCard } from './types'
import {
  cardDisplayHeight,
  distributeKanbanCellWidths,
  kanbanInnerTrackWidth,
  kanbanMaxAgentsPerRow,
  layoutKanbanStrip,
} from './kanbanGeometry'

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

describe('distributeKanbanCellWidths', () => {
  it('returns empty for n=0', () => {
    expect(distributeKanbanCellWidths(0, 100, 10)).toEqual([])
  })

  it('splits width evenly with remainder to first cells', () => {
    expect(distributeKanbanCellWidths(3, 100, 14)).toEqual([24, 24, 24])
    const four = distributeKanbanCellWidths(4, 100, 10)
    expect(four.reduce((a, b) => a + b, 0)).toBe(70)
    expect(four.length).toBe(4)
  })
})

describe('kanbanMaxAgentsPerRow', () => {
  it('returns at least 1', () => {
    expect(kanbanMaxAgentsPerRow(0, 14, 120)).toBe(1)
  })
})

describe('kanbanInnerTrackWidth', () => {
  it('matches inset 0', () => {
    expect(kanbanInnerTrackWidth(200)).toBe(200)
  })
})

describe('layoutKanbanStrip', () => {
  it('places two agents in one row under anchor', () => {
    const hubBottom = 120
    const a1 = agent('a1', { x: 0, y: 200, width: 120, height: 80 })
    const a2 = agent('a2', { x: 0, y: 200, width: 120, height: 80 })
    const map = layoutKanbanStrip([a1, a2], 0, 260, hubBottom)
    expect(map.size).toBe(2)
    const p1 = map.get('a1')!
    const p2 = map.get('a2')!
    expect(p1.y).toBe(p2.y)
    expect(p1.width + p2.width).toBeLessThanOrEqual(kanbanInnerTrackWidth(260))
  })
})

describe('cardDisplayHeight', () => {
  it('uses collapsed strip height', () => {
    const c = agent('c', { x: 0, y: 0, width: 100, height: 200, expanded: false })
    expect(cardDisplayHeight(c)).toBe(44)
  })
})
