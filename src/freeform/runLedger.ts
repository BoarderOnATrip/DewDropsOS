import type { ButlerSwarmRun, ButlerSwarmRunReport } from '../lib/butlerBridge'
import type { RuntimeSessionArtifact } from '../lib/runtimeSessionTypes'
import type { BriefPacket } from './briefSpec'
import { evaluateContinuation } from './continuationPolicy'
import type { ArtifactStatus, RunArtifact, RunLedgerEntry, SelfEvaluation, WorkflowCard } from './types'

function reportArtifactId(runId: string): string {
  return `${runId}-report`
}

function summaryArtifactId(runId: string): string {
  return `${runId}-summary`
}

function agentArtifactId(runId: string, agentId: string, index: number): string {
  return `${runId}-agent-${agentId || index}`
}

function dewdropSummaryArtifactId(runId: string): string {
  return `${runId}-dewdrop-summary`
}

function dewdropTranscriptArtifactId(runId: string): string {
  return `${runId}-dewdrop-transcript`
}

function isoNow(): string {
  return new Date().toISOString()
}

function reportSelfEvaluation(report: ButlerSwarmRunReport | undefined): SelfEvaluation | undefined {
  return report?.selfEvaluation ?? report?.self_evaluation
}

function reportBriefVersion(report: ButlerSwarmRunReport | undefined): number | undefined {
  return report?.briefVersion ?? report?.brief_version
}

function reportBriefHash(report: ButlerSwarmRunReport | undefined): string | undefined {
  return report?.briefHash ?? report?.brief_hash
}

function reportContinuationDecision(
  report: ButlerSwarmRunReport | undefined,
): RunLedgerEntry['continuationDecision'] | undefined {
  return report?.continuationDecision ?? report?.continuation_decision
}

function truncateTranscript(content: string, limit = 12_000): { body: string; truncated: boolean } {
  if (content.length <= limit) {
    return { body: content, truncated: false }
  }
  return {
    body: content.slice(content.length - limit),
    truncated: true,
  }
}

function dewdropRuntimeLabel(agent: WorkflowCard): string {
  const profile = agent.agentRuntime?.profile
  if (!profile || profile === 'custom') return 'shell'
  return profile
}

function dewdropRunId(agent: WorkflowCard): string {
  const sessionId = agent.agentRuntime?.sessionState?.sessionId?.trim()
  return sessionId ? `dewdrop-${sessionId}` : `dewdrop-${agent.id}`
}

function dewdropArtifactId(runId: string, artifactId: string): string {
  return `${runId}-${artifactId}`
}

function dewdropSummary(agent: WorkflowCard, runtimeArtifacts: readonly RuntimeSessionArtifact[]): string {
  const runtime = agent.agentRuntime
  const logTail = runtime?.sessionState?.logTail ?? []
  const lastSignal = [...logTail].reverse().find((line) => line.trim()) ?? runtime?.sessionState?.currentTask ?? 'No output yet.'
  const status = runtime?.sessionState?.status ?? 'idle'
  const artifactSummary =
    runtimeArtifacts.length > 0
      ? `${runtimeArtifacts.length} artifact${runtimeArtifacts.length === 1 ? '' : 's'} returned. `
      : ''
  return `${agent.title} returned from ${dewdropRuntimeLabel(agent)} with status ${status}. ${artifactSummary}${lastSignal}`
}

function dewdropTranscript(agent: WorkflowCard): string {
  const runtime = agent.agentRuntime
  const sessionState = runtime?.sessionState
  const rawTranscript = sessionState?.terminalBuffer?.trim() || (sessionState?.logTail ?? []).join('\n').trim()
  const transcript = rawTranscript || 'No terminal transcript was captured.'
  const trimmed = truncateTranscript(transcript)
  const route = runtime?.vpnAlias?.trim() ? `vpn-ssh via ${runtime.vpnAlias.trim()}` : 'local'
  const header = [
    `# ${agent.title} return`,
    '',
    `Runtime: ${dewdropRuntimeLabel(agent)}`,
    `Command: ${runtime?.command?.trim() || 'zsh -i -f'}`,
    `Root: ${runtime?.workspaceRoot?.trim() || '.'}`,
    `Route: ${route}`,
    `Status: ${sessionState?.status ?? 'idle'}`,
    trimmed.truncated ? 'Transcript: truncated to the latest 12000 characters.' : 'Transcript: full captured tail.',
    '',
    '## Transcript',
    trimmed.body,
  ]
  return header.join('\n')
}

function mergeArtifactStatuses(
  artifacts: RunArtifact[],
  existingEntry: RunLedgerEntry | undefined,
): RunArtifact[] {
  if (!existingEntry) return artifacts
  const nextById = new Map<string, RunArtifact>()
  for (const artifact of artifacts) {
    const previous = existingEntry.artifacts.find((existingArtifact) => existingArtifact.id === artifact.id)
    nextById.set(artifact.id, {
      ...artifact,
      status: previous?.status ?? artifact.status,
    })
  }
  for (const artifact of existingEntry.artifacts) {
    if (!nextById.has(artifact.id)) {
      nextById.set(artifact.id, artifact)
    }
  }
  return [...nextById.values()]
}

function runArtifactFromRuntimeArtifact(
  runId: string,
  returnedAt: string,
  artifact: RuntimeSessionArtifact,
): RunArtifact {
  return {
    id: dewdropArtifactId(runId, artifact.id),
    runId,
    kind: artifact.kind,
    title: artifact.title,
    summary: artifact.summary,
    createdAt: returnedAt,
    path: artifact.path,
    mimeType: artifact.mimeType,
    sizeBytes: artifact.sizeBytes,
    status: 'provisional',
  }
}

export function buildRunLedgerEntry(
  run: ButlerSwarmRun,
  options?: {
    report?: ButlerSwarmRunReport
    briefPacket?: BriefPacket
    briefSpecId?: string
    capabilityProfileId?: string
    swarmRecipeId?: string
    existingEntry?: RunLedgerEntry
  },
): RunLedgerEntry {
  const artifacts: RunArtifact[] = []
  const selfEvaluation = reportSelfEvaluation(options?.report) ?? options?.existingEntry?.selfEvaluation
  const briefVersion =
    reportBriefVersion(options?.report) ?? options?.briefPacket?.briefVersion ?? options?.existingEntry?.briefVersion
  const briefHash =
    reportBriefHash(options?.report) ?? options?.briefPacket?.briefHash ?? options?.existingEntry?.briefHash
  const continuationDecision =
    reportContinuationDecision(options?.report) ??
    (selfEvaluation && options?.briefPacket
      ? evaluateContinuation(selfEvaluation, options.briefPacket).decision
      : options?.existingEntry?.continuationDecision)

  if (options?.report?.content) {
    artifacts.push({
      id: reportArtifactId(run.run_id),
      runId: run.run_id,
      kind: 'report',
      title: `${run.title} report`,
      summary: run.summary ?? `Run report for ${run.title}.`,
      content: options.report.content,
      createdAt: run.completed_at ?? run.created_at ?? isoNow(),
      status: 'provisional',
    })
  } else if (run.summary) {
    artifacts.push({
      id: summaryArtifactId(run.run_id),
      runId: run.run_id,
      kind: 'note',
      title: `${run.title} summary`,
      summary: run.summary,
      createdAt: run.completed_at ?? run.created_at ?? isoNow(),
      status: 'provisional',
    })
  }

  if (run.agent_states) {
    for (const [index, agent] of run.agent_states.entries()) {
      if (agent.result_summary) {
        artifacts.push({
          id: agentArtifactId(run.run_id, agent.agent_id, index),
          runId: run.run_id,
          kind: 'note',
          title: `${agent.title} result`,
          summary: agent.result_summary,
          createdAt: run.completed_at ?? run.created_at ?? isoNow(),
          status: 'provisional',
        })
      }
    }
  }

  return {
    runId: run.run_id,
    contractId: run.contract_id,
    roomId: run.room_id,
    title: run.title,
    status: run.status ?? 'unknown',
    capabilityProfileId: options?.capabilityProfileId,
    swarmRecipeId: options?.swarmRecipeId,
    startedAt: run.launched_at ?? run.created_at ?? isoNow(),
    completedAt: run.completed_at ?? undefined,
    artifacts: mergeArtifactStatuses(artifacts, options?.existingEntry),
    briefSpecId: options?.briefSpecId ?? options?.existingEntry?.briefSpecId,
    briefVersion,
    briefHash,
    selfEvaluation,
    continuationDecision,
  }
}

export function buildDewDropRunLedgerEntry(
  agent: WorkflowCard,
  options: {
    roomId: string
    existingEntry?: RunLedgerEntry
    returnedAt?: string
    runtimeArtifacts?: RuntimeSessionArtifact[]
  },
): RunLedgerEntry {
  const runId = dewdropRunId(agent)
  const runtimeArtifacts = options.runtimeArtifacts ?? []
  const returnedAt =
    options.returnedAt ??
    agent.agentRuntime?.sessionState?.lastHeartbeatAt ??
    agent.agentRuntime?.sessionState?.startedAt ??
    isoNow()
  const summary = dewdropSummary(agent, runtimeArtifacts)
  const transcript = dewdropTranscript(agent)
  const status = agent.agentRuntime?.sessionState?.status ?? 'running'
  const summaryKind: RunArtifact['kind'] =
    status === 'failed' || status === 'killed' ? 'error' : 'note'

  const artifacts = mergeArtifactStatuses(
    [
      {
        id: dewdropSummaryArtifactId(runId),
        runId,
        kind: summaryKind,
        title: `${agent.title} return summary`,
        summary,
        createdAt: returnedAt,
        status: 'provisional',
      },
      {
        id: dewdropTranscriptArtifactId(runId),
        runId,
        kind: 'report',
        title: `${agent.title} transcript`,
        summary: `Terminal transcript returned from ${agent.title}.`,
        content: transcript,
        createdAt: returnedAt,
        status: 'provisional',
      },
      ...runtimeArtifacts.map((artifact) => runArtifactFromRuntimeArtifact(runId, returnedAt, artifact)),
    ],
    options.existingEntry,
  )

  return {
    runId,
    contractId: `dewdrop:${agent.id}`,
    roomId: options.roomId,
    title: `${agent.title} return`,
    status,
    startedAt: agent.agentRuntime?.sessionState?.startedAt ?? returnedAt,
    completedAt: ['done', 'failed', 'killed'].includes(status) ? returnedAt : undefined,
    artifacts,
  }
}

export function upsertRunLedgerEntry(
  ledger: RunLedgerEntry[] | undefined,
  entry: RunLedgerEntry,
): RunLedgerEntry[] {
  const existing = ledger ?? []
  const index = existing.findIndex((item) => item.runId === entry.runId)
  if (index >= 0) {
    const next = [...existing]
    next[index] = entry
    return next
  }
  return [entry, ...existing]
}

function artifactsEqual(left: readonly RunArtifact[], right: readonly RunArtifact[]): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

export function setRunArtifactStatus(
  ledger: RunLedgerEntry[] | undefined,
  runId: string,
  artifactId: string,
  status: ArtifactStatus,
): RunLedgerEntry[] {
  const existing = ledger ?? []
  let changed = false

  const next = existing.map((entry) => {
    if (entry.runId !== runId) return entry

    const nextArtifacts = entry.artifacts.map((artifact) => {
      if (artifact.id !== artifactId) return artifact
      if ((artifact.status ?? 'provisional') === status) return artifact
      changed = true
      return {
        ...artifact,
        status,
      }
    })

    if (!artifactsEqual(entry.artifacts, nextArtifacts)) {
      return {
        ...entry,
        artifacts: nextArtifacts,
      }
    }
    return entry
  })

  return changed ? next : existing
}

export function setRunPendingArtifactsStatus(
  ledger: RunLedgerEntry[] | undefined,
  runId: string,
  status: Exclude<ArtifactStatus, 'provisional'>,
): RunLedgerEntry[] {
  const existing = ledger ?? []
  let changed = false

  const next = existing.map((entry) => {
    if (entry.runId !== runId) return entry

    const nextArtifacts = entry.artifacts.map((artifact) => {
      if ((artifact.status ?? 'provisional') !== 'provisional') return artifact
      changed = true
      return {
        ...artifact,
        status,
      }
    })

    if (!artifactsEqual(entry.artifacts, nextArtifacts)) {
      return {
        ...entry,
        artifacts: nextArtifacts,
      }
    }
    return entry
  })

  return changed ? next : existing
}

export function updateRunArtifactStatus(
  ledger: RunLedgerEntry[] | undefined,
  runId: string,
  artifactId: string,
  status: ArtifactStatus,
): RunLedgerEntry[] {
  return setRunArtifactStatus(ledger, runId, artifactId, status)
}
