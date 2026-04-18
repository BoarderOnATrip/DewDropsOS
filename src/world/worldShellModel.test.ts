import { describe, expect, it } from 'vitest'
import type { BoardWire, WorkflowCard } from '../freeform/types'
import { buildWorldShellData } from './worldShellModel'
import { buildWorkspaceWorldGraph } from './workspaceWorld'

function problem(overrides: Partial<WorkflowCard> = {}): WorkflowCard {
  return {
    id: 'problem-1',
    title: 'Launch Garden',
    expanded: true,
    color: '#fff',
    kind: 'problem',
    x: 0,
    y: 0,
    width: 280,
    height: 180,
    mission: 'Ship the next DewDrops slice.',
    memoryContextSummary: 'Keep launch context and operator intent visible.',
    preferredLaunchSurface: 'hybrid',
    openQuestions: [],
    ...overrides,
  }
}

function agent(overrides: Partial<WorkflowCard> = {}): WorkflowCard {
  return {
    id: 'agent-1',
    title: 'Agent',
    expanded: true,
    color: '#0f0',
    kind: 'agent',
    x: 0,
    y: 0,
    width: 120,
    height: 44,
    assignedToProblemId: 'problem-2',
    parentAgentId: null,
    ...overrides,
  }
}

describe('buildWorldShellData', () => {
  it('maps the generated workspace world graph into room cards and detail', () => {
    const wires: BoardWire[] = [{ id: 'wire-1', fromCardId: 'problem-1', toCardId: 'problem-2' }]
    const graph = buildWorkspaceWorldGraph(
      'Primary workspace',
      [
        problem(),
        problem({
          id: 'problem-2',
          title: 'Phone Relay',
          phoneRelayBrief: 'Keep phone approvals tight.',
          openQuestions: ['Need iPhone shell.'],
        }),
        agent(),
      ],
      wires,
    )

    const data = buildWorldShellData(graph, {
      workspaceName: 'Primary workspace',
      cards: [
        problem(),
        problem({
          id: 'problem-2',
          title: 'Phone Relay',
          phoneRelayBrief: 'Keep phone approvals tight.',
          openQuestions: ['Need iPhone shell.'],
        }),
        agent(),
      ],
      focusedProblemId: 'problem-2',
      selectedProjectionId: 'packet',
      selectedFocusRef: {
        kind: 'locus',
        id: 'problem-2-locus-phone-checkpoint',
      },
    })

    expect(data.title).toBe('Primary workspace')
    expect(data.hierarchy.earth).toBe('Planet Earth')
    expect(data.hierarchy.wing).toBe('Primary workspace')
    expect(data.hierarchy.room).toBe('Phone Relay')
    expect(data.selectedRoomId).toBe('problem-2')
    expect(data.projectionChips).toHaveLength(6)
    expect(data.selectedDrillStageId).toBe('locus')
    expect(data.selectedLocusId).toBe('problem-2-locus-phone-checkpoint')
    expect(data.drillStages.map((stage) => stage.label)).toEqual(['Earth', 'Wing', 'Room', 'Locus'])
    expect(data.selectedClosetId).toBe('projection-packet')
    expect(data.closetCards.map((closet) => closet.title)).toEqual(
      expect.arrayContaining(['Packet closet', 'Brief closet', 'Anchor closet']),
    )
    expect(data.activeProjection.id).toBe('packet')
    expect(data.activeProjection.modeLabel).toBe('Packet')
    expect(data.activeProjection.breadcrumb).toEqual([
      'Primary workspace',
      'Primary workspace',
      'Phone Relay',
      'Phone relay checkpoint',
    ])
    expect(data.activeProjection.breadcrumbItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'Planet Earth',
          drillStageId: 'earth',
        }),
        expect.objectContaining({
          label: 'Phone Relay',
          focusRef: { kind: 'room', id: 'problem-2' },
        }),
        expect.objectContaining({
          label: 'Phone relay checkpoint',
          focusRef: { kind: 'locus', id: 'problem-2-locus-phone-checkpoint' },
        }),
      ]),
    )
    expect(data.activeProjection.returnVectors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'Planet Earth',
          drillStageId: 'earth',
        }),
        expect.objectContaining({
          label: 'Phone Relay',
          focusRef: { kind: 'room', id: 'problem-2' },
        }),
        expect.objectContaining({
          label: 'Phone relay checkpoint',
          focusRef: { kind: 'locus', id: 'problem-2-locus-phone-checkpoint' },
        }),
      ]),
    )
    expect(
      data.activeProjection.detailSections?.find((section) => section.title === 'Relay packet')?.items,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: expect.stringContaining('focus_locus: Phone relay checkpoint'),
          focusRef: { kind: 'locus', id: 'problem-2-locus-phone-checkpoint' },
        }),
        expect.objectContaining({
          label: expect.stringContaining('launch_surface: Hybrid'),
        }),
      ]),
    )
    expect(
      data.activeProjection.detailSections?.find((section) => section.title === 'Source refs')?.items,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'problem-2',
          focusRef: { kind: 'room', id: 'problem-2' },
        }),
        expect.objectContaining({
          label: expect.stringContaining('phone-relay'),
          focusRef: { kind: 'wing', id: 'wing-primary-workspace' },
        }),
      ]),
    )
    expect(data.roomCards?.[1]).toEqual(
      expect.objectContaining({
        id: 'problem-2',
        tone: 'attention',
        meta: expect.arrayContaining(['Hybrid', '1 actors']),
      }),
    )
    expect(data.roomPreview).toEqual(
      expect.objectContaining({
        title: 'Phone Relay',
        surfaceLabel: 'Hybrid',
        openQuestionLabels: ['Need iPhone shell.'],
        tunnelLabels: expect.arrayContaining(['context tunnel']),
        actorItems: expect.arrayContaining([
          expect.objectContaining({
            label: 'Agent',
            focusRef: { kind: 'agent', id: 'agent-1' },
          }),
        ]),
        tunnelItems: expect.arrayContaining([
          expect.objectContaining({
            label: 'context tunnel -> Launch Garden',
            focusRef: { kind: 'room', id: 'problem-1' },
          }),
        ]),
      }),
    )
    expect(data.locusPreview).toEqual(
      expect.objectContaining({
        title: 'Phone relay checkpoint',
        kindLabel: 'Console',
        actorItems: expect.arrayContaining([
          expect.objectContaining({
            label: 'Agent',
            focusRef: { kind: 'agent', id: 'agent-1' },
          }),
        ]),
      }),
    )
  })
})
