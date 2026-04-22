import { describe, expect, it } from 'vitest'
import type { ButlerSwarmRun } from '../lib/butlerBridge'
import type { RunLedgerEntry, WorkflowCard } from './types'
import { buildAutoContinuationObjective, planProblemAutoContinuation } from './autoContinuation'

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
    swarmTemplate: 'build',
    butlerRoomId: 'room-1',
    lastSwarmRunId: 'run-1',
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
        deliverables: ['room'],
      },
      escalationPolicy: 'outcome-contradiction-only',
      autonomyPolicy: 'full-auto',
    },
    runLedger: [runLedgerEntry()],
    ...overrides,
  }
}

function runLedgerEntry(overrides: Partial<RunLedgerEntry> = {}): RunLedgerEntry {
  return {
    runId: 'run-1',
    contractId: 'contract-1',
    roomId: 'room-1',
    title: 'Launch room',
    status: 'completed',
    startedAt: '2026-04-22T12:00:00.000Z',
    completedAt: '2026-04-22T12:05:00.000Z',
    continuationDecision: 'continue',
    selfEvaluation: {
      alignmentSummary: 'Shipped the first slice and left the remaining check.',
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
      assumptions: ['No backend migration needed.'],
      handoffNotes: 'Verifier should confirm acceptance criteria and return screenshots.',
    },
    artifacts: [],
    ...overrides,
  }
}

function run(overrides: Partial<ButlerSwarmRun> = {}): ButlerSwarmRun {
  return {
    id: 'run-1',
    run_id: 'run-1',
    contract_id: 'contract-1',
    room_id: 'room-1',
    title: 'Launch room',
    status: 'completed',
    created_at: '2026-04-22T12:00:00.000Z',
    launched_at: '2026-04-22T12:01:00.000Z',
    completed_at: '2026-04-22T12:05:00.000Z',
    ...overrides,
  }
}

describe('planProblemAutoContinuation', () => {
  it('returns a continuation plan for a completed run that asked to continue', () => {
    const problem = problemCard()

    const plan = planProblemAutoContinuation(problem, [problem], [], [run()], 'desktop')

    expect(plan).toEqual(
      expect.objectContaining({
        sourceRunId: 'run-1',
        template: 'build',
        reason: 'Run the final verification sweep.',
      }),
    )
    expect(plan?.objective).toContain('Continuation loop:')
    expect(plan?.objective).toContain('Continue from Butler run run-1.')
    expect(plan?.objective).toContain('Next action: Run the final verification sweep.')
  })

  it('does not re-plan a run that already triggered auto-continuation', () => {
    const problem = problemCard({
      lastAutoContinuationSourceRunId: 'run-1',
    })

    const plan = planProblemAutoContinuation(problem, [problem], [], [run()], 'desktop')

    expect(plan).toBeNull()
  })

  it('does not auto-continue while the latest run is still active', () => {
    const problem = problemCard()

    const plan = planProblemAutoContinuation(problem, [problem], [], [run({ status: 'running' })], 'desktop')

    expect(plan).toBeNull()
  })

  it('does not auto-continue when the latest ledger entry is complete', () => {
    const problem = problemCard({
      runLedger: [runLedgerEntry({ continuationDecision: 'complete' })],
    })

    const plan = planProblemAutoContinuation(problem, [problem], [], [run()], 'desktop')

    expect(plan).toBeNull()
  })
})

describe('buildAutoContinuationObjective', () => {
  it('appends the continuation envelope onto the deterministic objective', () => {
    const problem = problemCard()
    const entry = problem.runLedger?.[0]
    expect(entry).toBeTruthy()

    const objective = buildAutoContinuationObjective(problem, [problem], [], 'desktop', entry!)

    expect(objective).toContain('Continuation loop:')
    expect(objective).toContain('Criteria remaining: ac-1')
    expect(objective).toContain('Handoff notes: Verifier should confirm acceptance criteria and return screenshots.')
  })
})
