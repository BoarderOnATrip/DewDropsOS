import type { ButlerBridgeHealth } from '../lib/butlerBridge'
import type { ProblemSessionBlueprint } from './sessionBlueprint'
import type { DewDropsWorkspaceMode, WorkflowCard } from './types'

export type SessionReadinessTone = 'ready' | 'attention' | 'missing'

export type SessionReadinessItem = {
  id: string
  label: string
  tone: SessionReadinessTone
  statusLabel: string
  detail: string
}

export type ProblemSessionReadiness = {
  tone: SessionReadinessTone
  label: string
  summary: string
  items: SessionReadinessItem[]
}

const TONE_SCORE: Record<SessionReadinessTone, number> = {
  ready: 0,
  attention: 1,
  missing: 2,
}

function readinessStatusLabel(tone: SessionReadinessTone): string {
  if (tone === 'ready') return 'Ready'
  if (tone === 'attention') return 'Tighten'
  return 'Missing'
}

function item(
  id: string,
  label: string,
  tone: SessionReadinessTone,
  detail: string,
): SessionReadinessItem {
  return {
    id,
    label,
    tone,
    statusLabel: readinessStatusLabel(tone),
    detail,
  }
}

function maxTone(items: readonly SessionReadinessItem[]): SessionReadinessTone {
  return items.reduce<SessionReadinessTone>((current, next) => {
    return TONE_SCORE[next.tone] > TONE_SCORE[current] ? next.tone : current
  }, 'ready')
}

function overallLabel(tone: SessionReadinessTone): string {
  if (tone === 'ready') return 'Launch ready'
  if (tone === 'attention') return 'Ready with notes'
  return 'Needs setup'
}

function summaryText(items: readonly SessionReadinessItem[]): string {
  const readyCount = items.filter((entry) => entry.tone === 'ready').length
  const attentionCount = items.filter((entry) => entry.tone === 'attention').length
  const missingCount = items.filter((entry) => entry.tone === 'missing').length

  return [
    `${readyCount} ready`,
    attentionCount > 0 ? `${attentionCount} attention` : null,
    missingCount > 0 ? `${missingCount} missing` : null,
  ]
    .filter(Boolean)
    .join(' • ')
}

function deviceBriefItem(
  problem: WorkflowCard,
  blueprint: ProblemSessionBlueprint,
): SessionReadinessItem {
  const hasPhoneBrief = !!problem.phoneRelayBrief?.trim()
  const hasDesktopBrief = !!problem.desktopSessionBrief?.trim()

  if (blueprint.launchSurface === 'phone') {
    return item(
      'device',
      'Phone relay brief',
      hasPhoneBrief ? 'ready' : 'missing',
      hasPhoneBrief
        ? 'Phone relay instructions are pinned for mobile execution.'
        : 'Add a phone relay brief before using a phone-first Butler flow.',
    )
  }

  if (blueprint.launchSurface === 'hybrid') {
    if (hasPhoneBrief && hasDesktopBrief) {
      return item(
        'device',
        'Cross-device handoff',
        'ready',
        'Phone relay and desktop execution briefs are both pinned into the packet.',
      )
    }
    if (hasPhoneBrief || hasDesktopBrief) {
      return item(
        'device',
        'Cross-device handoff',
        'attention',
        'Hybrid launch has one side defined. Add both phone and desktop briefs for a cleaner handoff.',
      )
    }
    return item(
      'device',
      'Cross-device handoff',
      'missing',
      'Hybrid launch needs both a phone relay brief and a desktop execution brief.',
    )
  }

  return item(
    'device',
    'Desktop execution brief',
    hasDesktopBrief ? 'ready' : 'attention',
    hasDesktopBrief
      ? 'Desktop execution instructions are present for deeper work loops.'
      : 'Desktop launches can use the fallback objective, but a dedicated desktop brief will make sessions tighter.',
  )
}

export function buildProblemSessionReadiness(
  problem: WorkflowCard,
  options: {
    workspaceMode: DewDropsWorkspaceMode
    agentCount: number
    bridgeHealth: ButlerBridgeHealth | null
    blueprint: ProblemSessionBlueprint
  },
): ProblemSessionReadiness {
  const { agentCount, bridgeHealth, blueprint, workspaceMode } = options
  const hasExplicitMemory =
    !!problem.memoryWing?.trim() && !!problem.memoryRoom?.trim() && !!problem.memoryContextSummary?.trim()
  const anchorCount = problem.memoryAnchors?.filter((anchor) => anchor.trim()).length ?? 0

  const items: SessionReadinessItem[] = [
    item(
      'bridge',
      'Butler bridge',
      bridgeHealth?.ok ? 'ready' : 'missing',
      bridgeHealth?.ok
        ? 'Bridge is online and ready to accept launches.'
        : 'Bridge is offline. Pair or refresh Butler before launching this room.',
    ),
    item(
      'swarm',
      'Swarm staffing',
      agentCount > 0 ? 'ready' : 'missing',
      agentCount > 0
        ? `${agentCount} agent${agentCount === 1 ? '' : 's'} assigned to this problem room.`
        : 'No agents are assigned yet. Pull a team into the problem room before launch.',
    ),
    item(
      'memory',
      'Memory palace binding',
      hasExplicitMemory ? 'ready' : workspaceMode === 'palace' ? 'missing' : 'attention',
      hasExplicitMemory
        ? `Explicit room mapped to ${blueprint.memoryWing}/${blueprint.memoryRoom}.`
        : `Using fallback room ${blueprint.memoryWing}/${blueprint.memoryRoom}. Set wing, room, and summary for stable recall.`,
    ),
    item(
      'anchors',
      'Anchor refs',
      anchorCount > 0 ? 'ready' : 'attention',
      anchorCount > 0
        ? `${anchorCount} anchor ref${anchorCount === 1 ? '' : 's'} pinned into the handoff packet.`
        : 'No anchors pinned yet. Add drawers, entities, or room refs to improve continuity across sessions.',
    ),
    deviceBriefItem(problem, blueprint),
    item(
      'room',
      'Room continuity',
      problem.butlerRoomId ? 'ready' : 'attention',
      problem.butlerRoomId
        ? `Bound to Butler room ${problem.butlerRoomId}.`
        : 'This room will get a Butler room id on first launch so future resumes stay attached.',
    ),
  ]

  const tone = maxTone(items)
  return {
    tone,
    label: overallLabel(tone),
    summary: summaryText(items),
    items,
  }
}
