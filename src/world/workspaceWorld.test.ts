import { describe, expect, it } from 'vitest'
import type { BoardWire, WorkflowCard } from '../freeform/types'
import { buildWorkspaceWorldGraph } from './workspaceWorld'

function problem(overrides: Partial<WorkflowCard> = {}): WorkflowCard {
  return {
    id: 'room-1',
    title: 'Launch Garden',
    expanded: true,
    color: '#fff',
    kind: 'problem',
    x: 20,
    y: 30,
    width: 280,
    height: 180,
    mission: 'Ship the next slice.',
    memoryContextSummary: 'Keep the current room state coherent.',
    preferredLaunchSurface: 'hybrid',
    ...overrides,
  }
}

function agent(overrides: Partial<WorkflowCard> = {}): WorkflowCard {
  return {
    id: 'agent-1',
    title: 'Builder',
    expanded: true,
    color: '#0f0',
    kind: 'agent',
    x: 0,
    y: 0,
    width: 120,
    height: 44,
    assignedToProblemId: 'room-1',
    parentAgentId: null,
    ...overrides,
  }
}

describe('buildWorkspaceWorldGraph', () => {
  it('converts board rooms and agents into a world graph', () => {
    const wires: BoardWire[] = [{ id: 'wire-1', fromCardId: 'room-1', toCardId: 'room-2' }]
    const graph = buildWorkspaceWorldGraph(
      'Primary workspace',
      [
        problem(),
        problem({
          id: 'room-2',
          title: 'Phone Relay',
          phoneRelayBrief: 'Keep approvals tight.',
        }),
        agent(),
      ],
      wires,
    )

    expect(graph.wings[0]?.title).toBe('Primary workspace')
    expect(graph.rooms).toHaveLength(2)
    expect(graph.actors.map((actor) => actor.kind)).toEqual(
      expect.arrayContaining(['person', 'agent']),
    )
    expect(graph.loci.length).toBeGreaterThan(0)
    expect(graph.artifacts.length).toBeGreaterThan(0)
    expect(graph.tunnels[0]).toEqual(
      expect.objectContaining({
        label: 'context tunnel',
      }),
    )
  })
})
