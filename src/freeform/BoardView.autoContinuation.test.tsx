import { render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { WorkflowCard } from './types'

const butlerMocks = vi.hoisted(() => ({
  createSwarmContract: vi.fn(),
  getButlerBridgeHealth: vi.fn(),
  getSwarmRunReport: vi.fn(),
  launchSwarmContract: vi.fn(),
  listSwarmRuns: vi.fn(),
  pairLocalBridge: vi.fn(),
}))

vi.mock('../lib/butlerBridge', async () => {
  const actual = await vi.importActual<typeof import('../lib/butlerBridge')>('../lib/butlerBridge')
  return {
    ...actual,
    createSwarmContract: butlerMocks.createSwarmContract,
    getButlerBridgeHealth: butlerMocks.getButlerBridgeHealth,
    getSwarmRunReport: butlerMocks.getSwarmRunReport,
    launchSwarmContract: butlerMocks.launchSwarmContract,
    listSwarmRuns: butlerMocks.listSwarmRuns,
    pairLocalBridge: butlerMocks.pairLocalBridge,
  }
})

import BoardView from './BoardView'

function createMemoryStorage(): Storage {
  const data = new Map<string, string>()
  return {
    get length() {
      return data.size
    },
    clear() {
      data.clear()
    },
    getItem(key: string) {
      return data.get(key) ?? null
    },
    key(index: number) {
      return Array.from(data.keys())[index] ?? null
    },
    removeItem(key: string) {
      data.delete(key)
    },
    setItem(key: string, value: string) {
      data.set(key, value)
    },
  } as Storage
}

function problemCard(overrides: Partial<WorkflowCard> = {}): WorkflowCard {
  return {
    id: 'problem-1',
    title: 'Launch room',
    expanded: true,
    color: '#7fd4ff',
    kind: 'problem',
    x: 120,
    y: 120,
    width: 360,
    height: 260,
    autoContinuationEnabled: true,
    butlerRoomId: 'room-1',
    lastSwarmRunId: 'run-1',
    swarmTemplate: 'build',
    briefSpec: {
      id: 'brief-problem-1',
      creative: {
        mission: 'Ship the room.',
        beneficiary: 'Operators',
        references: [],
      },
      execution: {
        task: 'Build the room.',
        acceptanceCriteria: [{ id: 'ac-1', description: 'The room ships.' }],
        scope: { in: ['build'], out: [] },
        antiPatterns: [],
        deliverables: [],
      },
      escalationPolicy: 'outcome-contradiction-only',
      autonomyPolicy: 'full-auto',
    },
    runLedger: [
      {
        runId: 'run-1',
        contractId: 'contract-1',
        roomId: 'room-1',
        title: 'Launch room',
        status: 'completed',
        startedAt: '2026-04-22T12:00:00.000Z',
        completedAt: '2026-04-22T12:05:00.000Z',
        continuationDecision: 'continue',
        selfEvaluation: {
          alignmentSummary: 'The room is live but the last check still needs to run.',
          criteriaChecks: [
            {
              criterionId: 'ac-1',
              met: false,
              evidence: 'UI shipped, verification still pending.',
              confidence: 'medium',
            },
          ],
          allCriteriaMet: false,
          criteriaCovered: [],
          criteriaRemaining: ['ac-1'],
          nextAction: 'Run the final verification sweep.',
          escalationReason: null,
          assumptions: ['No migration required.'],
          handoffNotes: 'Verifier should confirm the acceptance path.',
        },
        artifacts: [],
      },
    ],
    ...overrides,
  }
}

describe('BoardView auto-continuation', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createMemoryStorage())
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    )

    butlerMocks.getButlerBridgeHealth.mockResolvedValue({
      ok: true,
      service: 'butler',
      version: '1.0.0',
    })
    butlerMocks.listSwarmRuns.mockResolvedValue([
      {
        id: 'run-1',
        run_id: 'run-1',
        contract_id: 'contract-1',
        room_id: 'room-1',
        title: 'Launch room',
        status: 'completed',
        created_at: '2026-04-22T12:00:00.000Z',
        launched_at: '2026-04-22T12:01:00.000Z',
        completed_at: '2026-04-22T12:05:00.000Z',
      },
    ])
    butlerMocks.getSwarmRunReport.mockResolvedValue({
      run_id: 'run-1',
      report_path: '/tmp/run-1.md',
      exists: true,
      content: '# Report',
      continuationDecision: 'continue',
    })
    butlerMocks.pairLocalBridge.mockResolvedValue({
      url: 'http://127.0.0.1:8765',
      token: 'local-token',
    })
    butlerMocks.createSwarmContract.mockResolvedValue({
      id: 'contract-2',
      contract_id: 'contract-2',
      room_id: 'room-1',
      title: 'Launch room',
      objective: 'continuation objective',
    })
    butlerMocks.launchSwarmContract.mockResolvedValue({
      ok: true,
      run: {
        id: 'run-2',
        run_id: 'run-2',
      },
    })
  })

  it('auto-launches a new Butler run when the latest room run returns continue', async () => {
    render(
      <BoardView
        bootId="board-auto-continue"
        bootState={{
          camera: { x: 0, y: 0, zoom: 0.9 },
          cards: [problemCard()],
          wires: [],
        }}
        focusedProblemId="problem-1"
      />,
    )

    await waitFor(() => expect(butlerMocks.createSwarmContract).toHaveBeenCalledTimes(1))
    expect(butlerMocks.launchSwarmContract).toHaveBeenCalledWith(
      expect.objectContaining({ token: 'local-token' }),
      'contract-2',
    )

    const payload = butlerMocks.createSwarmContract.mock.calls[0]?.[1]
    expect(payload?.metadata?.auto_continuation_source_run_id).toBe('run-1')
    expect(payload?.objective).toContain('Continuation loop:')
    expect(payload?.objective).toContain('Next action: Run the final verification sweep.')
  })
})
