import { describe, expect, it } from 'vitest'
import type { WorkflowCard } from './types'
import { reflowHubKanbanLayout, reflowSubagentLayout } from './kanbanReflow'

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

describe('reflowHubKanbanLayout', () => {
  it('returns unchanged when problem missing', () => {
    const cards: WorkflowCard[] = []
    expect(reflowHubKanbanLayout(cards, 'x')).toBe(cards)
  })

  it('packs assigned root agents under hub', () => {
    const pid = 'hub'
    const cards: WorkflowCard[] = [
      problem(pid, { x: 0, y: 0, width: 260, height: 60 }),
      agent('a1', {
        x: 999,
        y: 999,
        width: 100,
        height: 40,
        assignedToProblemId: pid,
        parentAgentId: null,
      }),
      agent('a2', {
        x: 998,
        y: 998,
        width: 100,
        height: 40,
        assignedToProblemId: pid,
        parentAgentId: null,
      }),
    ]
    const next = reflowHubKanbanLayout(cards, pid)
    const p1 = next.find((c) => c.id === 'a1')!
    const p2 = next.find((c) => c.id === 'a2')!
    expect(p1.x).toBeGreaterThanOrEqual(0)
    expect(p2.x).toBeGreaterThanOrEqual(0)
    expect(p1.y).toBe(p2.y)
    expect(p1.width + p2.width).toBeLessThanOrEqual(260)
  })
})

describe('reflowSubagentLayout', () => {
  it('lays out subagents under parent agent', () => {
    const cards: WorkflowCard[] = [
      agent('parent', { x: 50, y: 50, width: 300, height: 44, parentAgentId: null }),
      agent('sub', {
        x: 500,
        y: 500,
        width: 120,
        height: 40,
        parentAgentId: 'parent',
        assignedToProblemId: null,
      }),
    ]
    const next = reflowSubagentLayout(cards, 'parent')
    const sub = next.find((c) => c.id === 'sub')!
    expect(sub.x).toBe(50)
    expect(sub.y).toBeGreaterThan(50)
  })
})
