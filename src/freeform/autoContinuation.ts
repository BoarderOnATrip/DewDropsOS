import type { ButlerSwarmRun, ButlerSwarmTemplate } from '../lib/butlerBridge'
import { buildProblemSwarmObjective } from './boardObjective'
import { swarmRunIsActive } from './runFormat'
import type { BoardWire, DewDropsWorkspaceMode, RunLedgerEntry, WorkflowCard } from './types'

export type AutoContinuationPlan = {
  sourceRunId: string
  template: ButlerSwarmTemplate
  objective: string
  reason: string
}

function matchedLatestRun(problem: WorkflowCard, runs: readonly ButlerSwarmRun[]): ButlerSwarmRun | null {
  if (problem.butlerRoomId) {
    const roomRun = runs.find((run) => run.room_id === problem.butlerRoomId)
    if (roomRun) return roomRun
  }
  if (problem.lastSwarmRunId) {
    return (
      runs.find((run) => run.run_id === problem.lastSwarmRunId || run.id === problem.lastSwarmRunId) ?? null
    )
  }
  return null
}

function matchedLedgerEntry(problem: WorkflowCard, run: ButlerSwarmRun): RunLedgerEntry | null {
  return (
    problem.runLedger?.find((entry) => entry.runId === run.run_id || entry.runId === run.id) ?? null
  )
}

function compactHandoffNotes(notes: string | undefined, limit = 280): string {
  const normalized = (notes ?? '').replace(/\s+/g, ' ').trim()
  if (!normalized) return ''
  return normalized.length > limit ? `${normalized.slice(0, limit)}…` : normalized
}

export function buildAutoContinuationObjective(
  problem: WorkflowCard,
  cards: readonly WorkflowCard[],
  wires: readonly BoardWire[],
  workspaceMode: DewDropsWorkspaceMode,
  entry: RunLedgerEntry,
): string {
  const baseObjective = buildProblemSwarmObjective(problem, [...cards], [...wires], workspaceMode).trim()
  const nextAction = entry.selfEvaluation?.nextAction?.trim()
  const handoffNotes = compactHandoffNotes(entry.selfEvaluation?.handoffNotes)
  const remaining = entry.selfEvaluation?.criteriaRemaining ?? []
  const continuationLines = [
    'Continuation loop:',
    `Continue from Butler run ${entry.runId}.`,
    nextAction ? `Next action: ${nextAction}` : 'Next action: Continue the next unresolved slice.',
    remaining.length > 0
      ? `Criteria remaining: ${remaining.join(', ')}`
      : 'Criteria remaining: No explicit criteria ids were returned, so continue from the handoff notes.',
    handoffNotes ? `Handoff notes: ${handoffNotes}` : '',
  ].filter(Boolean)
  return `${baseObjective}\n\n${continuationLines.join('\n')}`.trim()
}

export function planProblemAutoContinuation(
  problem: WorkflowCard,
  cards: readonly WorkflowCard[],
  wires: readonly BoardWire[],
  runs: readonly ButlerSwarmRun[],
  workspaceMode: DewDropsWorkspaceMode,
): AutoContinuationPlan | null {
  if (!problem.autoContinuationEnabled) return null
  const latestRun = matchedLatestRun(problem, runs)
  if (!latestRun || swarmRunIsActive(latestRun.status)) return null
  const entry = matchedLedgerEntry(problem, latestRun)
  if (!entry || entry.continuationDecision !== 'continue') return null
  const sourceRunId = latestRun.run_id || latestRun.id || entry.runId
  if (!sourceRunId || problem.lastAutoContinuationSourceRunId === sourceRunId) return null
  const template = (problem.swarmTemplate as ButlerSwarmTemplate | undefined) ?? 'planning'
  const reason =
    entry.selfEvaluation?.nextAction?.trim() ||
    entry.selfEvaluation?.handoffNotes?.trim() ||
    'Continue the next unresolved slice from the latest Butler self-evaluation.'

  return {
    sourceRunId,
    template,
    objective: buildAutoContinuationObjective(problem, cards, wires, workspaceMode, entry),
    reason,
  }
}
