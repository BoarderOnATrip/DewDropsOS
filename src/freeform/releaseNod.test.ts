import { describe, expect, it } from 'vitest'
import type { WorkflowCard } from './types'
import { applyReleaseNod } from './releaseNod'

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

describe('applyReleaseNod', () => {
  it('toggles specialist nod only until both nods', () => {
    const pid = 'p1'
    const list: WorkflowCard[] = [
      problem(pid, { x: 0, y: 0, width: 100, height: 80 }),
      agent('a1', {
        x: 0,
        y: 0,
        width: 50,
        height: 50,
        assignedToProblemId: pid,
        parentAgentId: null,
      }),
    ]
    const s1 = applyReleaseNod(list, 'a1', 'specialist')
    expect(s1.wireRemove).toBeUndefined()
    const a = s1.next.find((c) => c.id === 'a1') as WorkflowCard
    expect(a.releaseNodFromSpecialist).toBe(true)

    const s2 = applyReleaseNod(s1.next, 'a1', 'lead')
    expect(s2.wireRemove).toEqual({ from: pid, to: 'a1' })
    const released = s2.next.find((c) => c.id === 'a1') as WorkflowCard
    expect(released.assignedToProblemId).toBeNull()
    expect(released.lastProjectRecall).toContain('Marble in the pool')
  })

  it('no-op when agent not on a problem', () => {
    const list: WorkflowCard[] = [
      agent('a1', { x: 0, y: 0, width: 50, height: 50, parentAgentId: null }),
    ]
    expect(applyReleaseNod(list, 'a1', 'specialist').next).toBe(list)
  })
})
