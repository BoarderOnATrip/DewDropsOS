import { describe, expect, it } from 'vitest'
import type { WorkflowCard } from './types'
import { problemOverlapEjectDelta } from './problemOverlapEjection'

function agent(
  overrides: Partial<WorkflowCard> & Pick<WorkflowCard, 'x' | 'y' | 'width' | 'height'>,
): WorkflowCard {
  return {
    id: 'mover',
    title: 'mover',
    expanded: true,
    color: '#fff',
    kind: 'agent',
    ...overrides,
  }
}

describe('problemOverlapEjectDelta', () => {
  it('returns zero when there is no overlap', () => {
    const mover = agent({ x: 0, y: 0, width: 50, height: 50 })
    const fixed = { l: 100, t: 0, r: 200, b: 100 }
    expect(problemOverlapEjectDelta(mover, mover.x, mover.y, fixed, 48)).toEqual({
      dx: 0,
      dy: 0,
    })
  })

  it('pushes horizontally when side bias favors the shorter x overlap', () => {
    const mover = agent({ x: 90, y: 10, width: 40, height: 40 })
    const fixed = { l: 0, t: 0, r: 100, b: 200 }
    const d = problemOverlapEjectDelta(mover, mover.x, mover.y, fixed, 100)
    expect(d.dy).toBe(0)
    expect(d.dx).not.toBe(0)
  })
})
