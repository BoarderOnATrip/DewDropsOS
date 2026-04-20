import type { ButlerBridgeHealth, ButlerSwarmRun } from '../lib/butlerBridge'
import { buildMediaRuntimeBlueprint } from '../lib/mediaRuntime'
import { formatRunStatus, swarmRunIsActive } from '../freeform/runFormat'
import { buildProblemSessionBlueprint, type ProblemSessionBlueprint } from '../freeform/sessionBlueprint'
import {
  buildProblemSessionReadiness,
  type ProblemSessionReadiness,
} from '../freeform/sessionReadiness'
import { parseHandoffNotes } from '../freeform/rtk'
import type {
  ArtifactStatus,
  DewDropsWorkspaceMode,
  MemoryPalaceLocus,
  RunArtifact,
  RunLedgerEntry,
  WorkflowCard,
} from '../freeform/types'
import { buildRoomPalaceMapping } from '../world/roomPalace'
import { buildSpatialRoomScene, type SpatialRoomScene } from '../spatial/spatialRoom'

export type PhoneRelayWorkspaceSnapshot = {
  workspaceId?: string
  workspaceName?: string
  workspaceSubtitle?: string
  workspaceMode?: DewDropsWorkspaceMode
  bridgeHealth?: ButlerBridgeHealth | null
  cards?: WorkflowCard[]
  problems?: WorkflowCard[]
  selectedProblemId?: string | null
  latestRun?: ButlerSwarmRun | null
  runs?: ButlerSwarmRun[]
}

export type PhoneRelayProblemCard = {
  id: string
  title: string
  mission?: string
  surfaceLabel?: string
  roomLabel?: string
  projectionLabel?: string
  agentCount?: number
  readinessLabel?: string
  readinessTone?: ProblemSessionReadiness['tone']
  latestRunLabel?: string
  latestRunSummary?: string
  decisionLabel?: string
  decisionTone?: ProblemSessionReadiness['tone']
  pendingArtifactCount?: number
  criteriaRemainingCount?: number
}

export type PhoneRelayDecisionReasoning = {
  dec: string
  why: string
  rej?: string
  watch?: string
}

export type PhoneRelayDecisionInbox = {
  label: string
  tone: ProblemSessionReadiness['tone']
  summary: string
  escalationReason?: string
  nextAction?: string
  pendingArtifactCount: number
  pendingArtifactLabels: string[]
  criteriaRemaining: string[]
  reasoning?: PhoneRelayDecisionReasoning
}

export type PhoneRelayCurrentProblem = PhoneRelayProblemCard & {
  brief?: string
  roomSummary?: string
  anchorLabels?: string[]
  memoryPalaceLoci?: MemoryPalaceLocus[]
  spatialRoomScene?: SpatialRoomScene
  decisionInbox?: PhoneRelayDecisionInbox
}

export type PhoneRelayShellData = {
  workspaceId?: string
  workspaceName: string
  workspaceSubtitle: string
  workspaceMode: DewDropsWorkspaceMode
  workspaceProjectionLabel: string
  bridgeStatusLabel?: string
  bridgeTone?: ProblemSessionReadiness['tone']
  problemList: PhoneRelayProblemCard[]
  selectedProblemId?: string | null
  currentProblem: PhoneRelayCurrentProblem | null
  readinessText: string
  packetText: string
}

export type PhoneRelayProblemView = {
  problem: WorkflowCard
  agentCount: number
  blueprint: ProblemSessionBlueprint
  readiness: ProblemSessionReadiness
  latestRun: ButlerSwarmRun | null
  roomLabel: string
  projectionLabel: string
  packetLines: string[]
  packetText: string
  phoneBrief: string
  desktopBrief: string
  roomSummary: string
  anchorLabels: string[]
  memoryPalaceLoci: MemoryPalaceLocus[]
  spatialRoomScene: SpatialRoomScene
  decisionInbox: PhoneRelayDecisionInbox | null
}

export type PhoneRelayWorkspaceView = {
  workspaceName: string
  workspaceSubtitle: string
  workspaceMode: DewDropsWorkspaceMode
  workspaceProjectionLabel: string
  bridgeHealth: ButlerBridgeHealth | null
  problems: PhoneRelayProblemView[]
  selectedProblemId: string | null
  selectedProblem: PhoneRelayProblemView | null
  problemCount: number
  assignedAgentCount: number
  activeRunCount: number
  latestRun: ButlerSwarmRun | null
}

function isProblem(card: WorkflowCard): boolean {
  return card.kind === 'problem'
}

function runTimestamp(run: ButlerSwarmRun): number {
  const raw = run.updated_at ?? run.created_at ?? run.launched_at ?? ''
  const parsed = Date.parse(raw)
  return Number.isFinite(parsed) ? parsed : 0
}

function runLedgerTimestamp(entry: RunLedgerEntry): number {
  const raw = entry.completedAt ?? entry.startedAt
  const parsed = Date.parse(raw)
  return Number.isFinite(parsed) ? parsed : 0
}

function pickMostRecentRun(runs: readonly ButlerSwarmRun[]): ButlerSwarmRun | null {
  if (runs.length === 0) return null
  return [...runs].sort((left, right) => runTimestamp(right) - runTimestamp(left))[0] ?? null
}

function pickMostRecentRunLedgerEntry(entries: readonly RunLedgerEntry[] | undefined): RunLedgerEntry | null {
  if (!entries || entries.length === 0) return null
  return [...entries].sort((left, right) => runLedgerTimestamp(right) - runLedgerTimestamp(left))[0] ?? null
}

function artifactStatus(artifact: RunArtifact): ArtifactStatus {
  return artifact.status ?? 'provisional'
}

function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`
}

function buildDecisionInbox(problem: WorkflowCard): PhoneRelayDecisionInbox | null {
  const latestEntry = pickMostRecentRunLedgerEntry(problem.runLedger)
  if (!latestEntry) return null

  const selfEvaluation = latestEntry.selfEvaluation
  const pendingArtifacts = latestEntry.artifacts.filter((artifact) => artifactStatus(artifact) === 'provisional')
  const criteriaRemaining = selfEvaluation?.criteriaRemaining ?? []
  const nextAction = selfEvaluation?.nextAction?.trim() || undefined
  const escalationReason = selfEvaluation?.escalationReason?.trim() || undefined
  const parsedReasoning = selfEvaluation?.handoffNotes
    ? parseHandoffNotes(selfEvaluation.handoffNotes)
    : null

  let label: string
  let tone: ProblemSessionReadiness['tone']
  let summary: string

  if (escalationReason || latestEntry.continuationDecision === 'escalate') {
    label = 'Needs attention'
    tone = 'attention'
    summary = escalationReason ?? 'Outcome-level contradiction detected in the brief.'
  } else if (pendingArtifacts.length > 0) {
    label = 'Awaiting acceptance'
    tone = 'attention'
    summary = `${pluralize(pendingArtifacts.length, 'provisional artifact')} waiting for review.`
  } else if (nextAction || criteriaRemaining.length > 0 || latestEntry.continuationDecision === 'continue') {
    label = 'Next move queued'
    tone = 'ready'
    summary =
      nextAction ??
      `${pluralize(criteriaRemaining.length, 'acceptance criterion', 'acceptance criteria')} still open.`
  } else if (latestEntry.continuationDecision === 'complete') {
    label = 'Ready to close'
    tone = 'ready'
    summary = 'All criteria are marked complete and no provisional artifacts remain.'
  } else if (selfEvaluation?.alignmentSummary?.trim()) {
    label = 'Aligned'
    tone = 'ready'
    summary = selfEvaluation.alignmentSummary.trim()
  } else {
    return null
  }

  return {
    label,
    tone,
    summary,
    escalationReason,
    nextAction,
    pendingArtifactCount: pendingArtifacts.length,
    pendingArtifactLabels: pendingArtifacts.map((artifact) => `${artifact.kind}: ${artifact.title}`),
    criteriaRemaining,
    reasoning: parsedReasoning ?? undefined,
  }
}

function matchesProblemRun(run: ButlerSwarmRun, problem: WorkflowCard): boolean {
  const runId = run.id || run.run_id
  return (
    runId === problem.lastSwarmRunId ||
    run.run_id === problem.lastSwarmRunId ||
    run.contract_id === problem.lastSwarmContractId
  )
}

function countProblemAgents(problemId: string, cards: readonly WorkflowCard[]): number {
  return cards.filter((card) => card.kind === 'agent' && card.assignedToProblemId === problemId).length
}

function buildPacketLines(
  problem: WorkflowCard,
  blueprint: ProblemSessionBlueprint,
  readiness: ProblemSessionReadiness,
  agentCount: number,
  latestRun: ButlerSwarmRun | null,
): string[] {
  const lines = [...blueprint.handoffLines]

  lines.push(`readiness: ${readiness.label} (${readiness.summary})`)
  lines.push(`agent_count: ${agentCount}`)

  if (problem.lastSwarmContractId) {
    lines.push(`contract_id: ${problem.lastSwarmContractId}`)
  }
  if (problem.lastSwarmRunId) {
    lines.push(`last_run_id: ${problem.lastSwarmRunId}`)
  }
  if (latestRun) {
    lines.push(`latest_run: ${latestRun.title} (${formatRunStatus(latestRun.status)})`)
  }

  return lines
}

function buildRoomLabel(blueprint: ProblemSessionBlueprint): string {
  return `${blueprint.memoryWing}/${blueprint.memoryRoom}`
}

function buildProjectionLabel(workspaceMode: DewDropsWorkspaceMode, launchSurfaceLabel: string): string {
  if (workspaceMode === 'phone') return 'Pocket projection'
  if (workspaceMode === 'palace') return 'Memory projection'
  if (launchSurfaceLabel === 'Hybrid') return 'Hybrid projection'
  return 'Desktop projection'
}

function chooseSelectedProblemId(snapshot: PhoneRelayWorkspaceSnapshot, fallbackId: string | null): string | null {
  if (snapshot.selectedProblemId !== undefined) {
    return snapshot.selectedProblemId
  }
  return fallbackId
}

export function collectPhoneRelayProblems(snapshot: PhoneRelayWorkspaceSnapshot): WorkflowCard[] {
  const cards = snapshot.problems ?? snapshot.cards ?? []
  return cards.filter(isProblem)
}

export function buildPhoneRelayWorkspaceView(
  snapshot: PhoneRelayWorkspaceSnapshot,
): PhoneRelayWorkspaceView {
  const workspaceMode = snapshot.workspaceMode ?? 'phone'
  const allCards = snapshot.cards ?? snapshot.problems ?? []
  const problems = collectPhoneRelayProblems(snapshot)
  const bridgeHealth = snapshot.bridgeHealth ?? null
  const latestRun = snapshot.latestRun ?? pickMostRecentRun(snapshot.runs ?? [])

  const problemViews = problems.map((problem) => {
    const agentCount = countProblemAgents(problem.id, allCards)
    const blueprint = buildProblemSessionBlueprint(problem, workspaceMode)
    const readiness = buildProblemSessionReadiness(problem, {
      workspaceMode,
      agentCount,
      agentCards: allCards.filter(
        (card) => card.kind === 'agent' && card.assignedToProblemId === problem.id,
      ),
      bridgeHealth,
      blueprint,
    })
    const matchingRun =
      (snapshot.runs ?? []).find((run) => matchesProblemRun(run, problem)) ?? null
    const problemLatestRun = matchingRun ?? latestRun
    const packetLines = buildPacketLines(problem, blueprint, readiness, agentCount, problemLatestRun)
    const roomLabel = buildRoomLabel(blueprint)
    const projectionLabel = buildProjectionLabel(workspaceMode, blueprint.launchSurfaceLabel)
    const decisionInbox = buildDecisionInbox(problem)
    const roomPalace = buildRoomPalaceMapping({
      title: roomLabel,
      summary: blueprint.contextSummary,
      actors:
        agentCount > 0
          ? Array.from({ length: Math.min(agentCount, 4) }, (_, index) =>
              index === 0 ? 'Lead operator' : `Agent ${index + 1}`,
            )
          : [],
      loci: blueprint.visualLoci.map((locus) => locus.title),
      artifacts: blueprint.anchors,
      tunnels: blueprint.visualLoci
        .filter((locus) => locus.kind === 'portal')
        .map((locus) => locus.title),
      anchors: blueprint.anchors,
      briefs: [problem.phoneRelayBrief?.trim(), problem.desktopSessionBrief?.trim()].filter(
        (value): value is string => Boolean(value),
      ),
      openQuestions: problem.openQuestions ?? [],
      latestRun: problemLatestRun ? formatRunStatus(problemLatestRun.status) : '',
    })
    const mediaRuntime = buildMediaRuntimeBlueprint({
      roomTitle: roomLabel,
      surfaceLabel: blueprint.launchSurfaceLabel,
      hasPhoneBrief: !!problem.phoneRelayBrief?.trim(),
      hasDesktopBrief: !!problem.desktopSessionBrief?.trim(),
      hasLoci: blueprint.visualLoci.length > 0,
    })
    const spatialRoomScene = buildSpatialRoomScene({
      palace: roomPalace,
      surfaceLabel: blueprint.launchSurfaceLabel,
      memoryLabel: roomLabel,
      phoneBrief: problem.phoneRelayBrief?.trim(),
      desktopBrief: problem.desktopSessionBrief?.trim(),
      mediaRuntime,
    })

    return {
      problem,
      agentCount,
      blueprint,
      readiness,
      latestRun: problemLatestRun,
      roomLabel,
      projectionLabel,
      packetLines,
      packetText: packetLines.join('\n'),
      phoneBrief: problem.phoneRelayBrief?.trim() || '',
      desktopBrief: problem.desktopSessionBrief?.trim() || '',
      roomSummary: blueprint.contextSummary,
      anchorLabels: blueprint.anchors,
      memoryPalaceLoci: blueprint.visualLoci,
      spatialRoomScene,
      decisionInbox,
    }
  })

  const selectedId = chooseSelectedProblemId(snapshot, problemViews[0]?.problem.id ?? null)
  const selectedProblem =
    selectedId == null
      ? null
      : problemViews.find((entry) => entry.problem.id === selectedId) ?? problemViews[0] ?? null

  const assignedAgentCount = allCards.filter(
    (card) => card.kind === 'agent' && card.assignedToProblemId,
  ).length
  const activeRunCount = (snapshot.runs ?? []).filter((run) => swarmRunIsActive(run.status)).length

  return {
    workspaceName: snapshot.workspaceName?.trim() || 'DewDrops',
    workspaceSubtitle: snapshot.workspaceSubtitle?.trim() || 'Phone relay workspace snapshot',
    workspaceMode,
    workspaceProjectionLabel:
      workspaceMode === 'phone'
        ? 'Pocket projection'
        : workspaceMode === 'palace'
          ? 'Memory projection'
          : 'Desktop projection',
    bridgeHealth,
    problems: problemViews,
    selectedProblemId: selectedProblem?.problem.id ?? null,
    selectedProblem,
    problemCount: problemViews.length,
    assignedAgentCount,
    activeRunCount,
    latestRun,
  }
}

export function buildPhoneRelayShellData(snapshot: PhoneRelayWorkspaceSnapshot): PhoneRelayShellData {
  const workspaceView = buildPhoneRelayWorkspaceView(snapshot)
  const selected = workspaceView.selectedProblem

  return {
    workspaceId: snapshot.workspaceId?.trim() || undefined,
    workspaceName: workspaceView.workspaceName,
    workspaceSubtitle: workspaceView.workspaceSubtitle,
    workspaceMode: workspaceView.workspaceMode,
    workspaceProjectionLabel: workspaceView.workspaceProjectionLabel,
    bridgeStatusLabel: workspaceView.bridgeHealth?.ok ? 'Bridge online' : 'Bridge offline',
    bridgeTone: workspaceView.bridgeHealth?.ok ? 'ready' : 'missing',
    problemList: workspaceView.problems.map((entry) => ({
      id: entry.problem.id,
      title: entry.problem.title,
      mission: entry.problem.mission?.trim() || undefined,
      surfaceLabel: entry.blueprint.launchSurfaceLabel,
      roomLabel: entry.roomLabel,
      projectionLabel: entry.projectionLabel,
      agentCount: entry.agentCount,
      readinessLabel: entry.readiness.label,
      readinessTone: entry.readiness.tone,
      latestRunLabel: entry.latestRun ? formatRunStatus(entry.latestRun.status) : 'No run yet',
      latestRunSummary: entry.latestRun?.summary?.trim() || undefined,
      decisionLabel: entry.decisionInbox?.label,
      decisionTone: entry.decisionInbox?.tone,
      pendingArtifactCount: entry.decisionInbox?.pendingArtifactCount,
      criteriaRemainingCount: entry.decisionInbox?.criteriaRemaining.length,
    })),
    selectedProblemId: selected?.problem.id ?? null,
    currentProblem: selected
      ? {
          id: selected.problem.id,
          title: selected.problem.title,
          mission: selected.problem.mission?.trim() || undefined,
          surfaceLabel: selected.blueprint.launchSurfaceLabel,
          roomLabel: selected.roomLabel,
          projectionLabel: selected.projectionLabel,
          agentCount: selected.agentCount,
          readinessLabel: selected.readiness.label,
          readinessTone: selected.readiness.tone,
          latestRunLabel: selected.latestRun ? formatRunStatus(selected.latestRun.status) : 'No run yet',
          latestRunSummary: selected.latestRun?.summary?.trim() || undefined,
          brief:
            selected.phoneBrief ||
            selected.desktopBrief ||
            selected.problem.memoryContextSummary?.trim() ||
            undefined,
          roomSummary: selected.roomSummary,
          anchorLabels: selected.anchorLabels,
          memoryPalaceLoci: selected.memoryPalaceLoci,
          spatialRoomScene: selected.spatialRoomScene,
          decisionLabel: selected.decisionInbox?.label,
          decisionTone: selected.decisionInbox?.tone,
          pendingArtifactCount: selected.decisionInbox?.pendingArtifactCount,
          criteriaRemainingCount: selected.decisionInbox?.criteriaRemaining.length,
          decisionInbox: selected.decisionInbox ?? undefined,
        }
      : null,
    readinessText: selected?.readiness.summary ?? 'Select a problem to inspect readiness.',
    packetText: selected?.packetText ?? 'Packet will appear when a problem is selected.',
  }
}
