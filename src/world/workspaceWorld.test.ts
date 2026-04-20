import { describe, expect, it } from 'vitest'
import { diyMoviePreset } from '../freeform/presets/diyMovie'
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
    expect(graph.actors.find((actor) => actor.kind === 'agent')).toEqual(
      expect.objectContaining({ provider: 'custom' }),
    )
    expect(graph.loci.length).toBeGreaterThan(0)
    expect(graph.artifacts.length).toBeGreaterThan(0)
    expect(graph.tunnels[0]).toEqual(
      expect.objectContaining({
        label: 'context tunnel',
      }),
    )
  })

  it('projects run ledger entries as artifacts in the world graph', () => {
    const graph = buildWorkspaceWorldGraph(
      'Primary workspace',
      [
        problem({
          runLedger: [
            {
              runId: 'run-abc',
              contractId: 'contract-1',
              roomId: 'room-1',
              title: 'Research sweep',
              status: 'completed',
              startedAt: '2026-01-01T00:00:00.000Z',
              completedAt: '2026-01-01T00:05:00.000Z',
              artifacts: [
                {
                  id: 'run-abc-artifact-0',
                  runId: 'run-abc',
                  kind: 'note',
                  title: 'Research sweep summary',
                  summary: 'Found 3 relevant papers.',
                  createdAt: '2026-01-01T00:05:00.000Z',
                },
              ],
            },
          ],
        }),
      ],
    )

    const room = graph.rooms.find((r) => r.id === 'room-1')
    expect(room).toBeDefined()

    const runArtifact = graph.artifacts.find((a) => a.id === 'room-1-run-run-abc')
    expect(runArtifact).toBeDefined()
    expect(runArtifact?.roomId).toBe('room-1')
    expect(runArtifact?.tags).toContain('run')
    expect(runArtifact?.tags).toContain('latest-run')
    expect(runArtifact?.tags).toContain('completed')
    expect(room?.artifactIds).toContain('room-1-run-run-abc')
  })

  it('projects indexed room compartment assets as room artifacts', () => {
    const graph = buildWorkspaceWorldGraph(
      'Primary workspace',
      [
        problem({
          memoryPalaceLoci: [
            {
              id: 'script-table',
              title: 'Script Table',
              kind: 'artifact',
              detail: 'Drafts and captions live here.',
            },
          ],
          briefCompartmentAssets: [
            {
              id: 'compartment-1',
              name: 'hook-script.md',
              mimeType: 'text/markdown',
              sizeBytes: 1024,
              addedAt: '2026-04-19T10:00:00.000Z',
              compartmentId: 'system:script',
              compartmentLabel: 'Script Table',
              compartmentKind: 'script',
              anchorRef: 'compartment/script-table',
              extension: 'md',
              organizeStatus: 'sorted',
              organizeReason: 'Sorted into Script Table because script keywords matched.',
              matchedLocusId: 'script-table',
            },
          ],
        }),
      ],
    )

    const room = graph.rooms.find((entry) => entry.id === 'room-1')
    const asset = graph.artifacts.find((entry) => entry.id === 'room-1-compartment-compartment-1')

    expect(asset).toBeDefined()
    expect(asset?.title).toBe('hook-script.md')
    expect(asset?.roomId).toBe('room-1')
    expect(asset?.tags).toContain('compartment-asset')
    expect(room?.artifactIds).toContain('room-1-compartment-compartment-1')
  })

  it('preserves explicit DIYMovie loci inside the world graph room projection', () => {
    const preset = diyMoviePreset()
    const graph = buildWorkspaceWorldGraph('DIYMovie workspace', preset.cards, preset.wires)
    const room = graph.rooms.find((entry) => entry.id === 'diy-movie-room')
    const roomLoci = graph.loci.filter((entry) => entry.roomId === 'diy-movie-room')

    expect(room).toBeDefined()
    expect(roomLoci.map((entry) => entry.title)).toEqual([
      'Idea Wall',
      'Script Table',
      'Shotlist Rail',
      'Capture Bay',
      'Edit Desk',
      'Publish Gate',
    ])
    expect(room?.artifactIds).toContain('diy-movie-room-run-diy-movie-run-approval-pass')
  })
})

function roomToneFor(overrides: Partial<WorkflowCard> = {}): string {
  const graph = buildWorkspaceWorldGraph('Test', [problem(overrides)])
  const room = graph.rooms.find((r) => r.id === 'room-1')
  if (!room) throw new Error('room not found')
  return room.tone
}

describe('roomTone', () => {
  it('returns attention when the latest run has continuationDecision escalate', () => {
    expect(
      roomToneFor({
        runLedger: [
          {
            runId: 'r1',
            contractId: 'c1',
            roomId: 'room-1',
            title: 'Run',
            status: 'completed',
            startedAt: '2026-01-01T00:00:00.000Z',
            artifacts: [],
            continuationDecision: 'escalate',
          },
        ],
      }),
    ).toBe('attention')
  })

  it('returns attention when the latest run has selfEvaluation.escalationReason set', () => {
    expect(
      roomToneFor({
        runLedger: [
          {
            runId: 'r1',
            contractId: 'c1',
            roomId: 'room-1',
            title: 'Run',
            status: 'completed',
            startedAt: '2026-01-01T00:00:00.000Z',
            artifacts: [],
            selfEvaluation: {
              alignmentSummary: 'done',
              criteriaChecks: [],
              allCriteriaMet: false,
              criteriaCovered: [],
              criteriaRemaining: [],
              nextAction: null,
              escalationReason: 'Contradictory requirement found.',
              assumptions: [],
              handoffNotes: '',
            },
          },
        ],
      }),
    ).toBe('attention')
  })

  it('returns attention when there are open questions (existing behavior preserved)', () => {
    expect(roomToneFor({ openQuestions: ['What does done look like?'] })).toBe('attention')
  })

  it('returns ready when the latest run has continuationDecision continue', () => {
    expect(
      roomToneFor({
        runLedger: [
          {
            runId: 'r1',
            contractId: 'c1',
            roomId: 'room-1',
            title: 'Run',
            status: 'running',
            startedAt: '2026-01-01T00:00:00.000Z',
            artifacts: [],
            continuationDecision: 'continue',
          },
        ],
      }),
    ).toBe('ready')
  })

  it('returns attention when the latest run is complete with provisional artifacts', () => {
    expect(
      roomToneFor({
        runLedger: [
          {
            runId: 'r1',
            contractId: 'c1',
            roomId: 'room-1',
            title: 'Run',
            status: 'completed',
            startedAt: '2026-01-01T00:00:00.000Z',
            artifacts: [
              {
                id: 'a1',
                runId: 'r1',
                kind: 'report',
                title: 'Draft report',
                summary: 'Needs review.',
                createdAt: '2026-01-01T00:05:00.000Z',
                status: 'provisional',
              },
            ],
            continuationDecision: 'complete',
          },
        ],
      }),
    ).toBe('attention')
  })

  it('returns ready when the latest run is complete with no provisional artifacts', () => {
    expect(
      roomToneFor({
        runLedger: [
          {
            runId: 'r1',
            contractId: 'c1',
            roomId: 'room-1',
            title: 'Run',
            status: 'completed',
            startedAt: '2026-01-01T00:00:00.000Z',
            artifacts: [
              {
                id: 'a1',
                runId: 'r1',
                kind: 'report',
                title: 'Accepted report',
                summary: 'Merged.',
                createdAt: '2026-01-01T00:05:00.000Z',
                status: 'accepted',
              },
            ],
            continuationDecision: 'complete',
          },
        ],
      }),
    ).toBe('ready')
  })

  it('returns calm when there are no runs and no signals', () => {
    expect(roomToneFor()).toBe('calm')
  })
})
