import type { ButlerBridgeHealth } from '../lib/butlerBridge'
import { agentRunsInCliTerminal, normalizeAgentRuntime, runtimeProfileLabel } from './agentRuntime'
import { getCapabilityProfile } from './capabilityProfiles'
import { summarizeDewDropHostBindings } from './dewdropHosts'
import { buildProblemApprovalHooks, formatSocialTargetLabel } from './launchMetadata'
import type { ProblemSessionBlueprint } from './sessionBlueprint'
import { getSwarmRecipe } from './swarmRecipes'
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

function agentRuntimeItem(agentCards: readonly WorkflowCard[]): SessionReadinessItem {
  if (agentCards.length === 0) {
    return item(
      'runtime',
      'Worker terminals',
      'missing',
      'No agents are assigned yet, so no worker terminals are bound to this room.',
    )
  }

  const terminalCount = agentCards.filter((card) => agentRunsInCliTerminal(card)).length
  const profileSummary = [...agentCards
    .reduce((counts, card) => {
      const runtime = normalizeAgentRuntime(card.agentRuntime, { cardId: card.id, title: card.title })
      const label = runtimeProfileLabel(runtime.profile)
      counts.set(label, (counts.get(label) ?? 0) + 1)
      return counts
    }, new Map<string, number>())
    .entries()]
    .map(([label, count]) => `${count} ${label.toLowerCase()}`)
    .join(', ')

  if (terminalCount === agentCards.length) {
    return item(
      'runtime',
      'Live terminals',
      'ready',
      `${terminalCount} of ${agentCards.length} assigned DewDrop${agentCards.length === 1 ? '' : 's'} are ready as terminal sessions${profileSummary ? ` (${profileSummary})` : ''}.`,
    )
  }

  if (terminalCount === 0) {
    return item(
      'runtime',
      'Live terminals',
      'missing',
      'Assigned DewDrops are not yet bound to live terminals.',
    )
  }

  return item(
    'runtime',
    'Live terminals',
    'attention',
    `${terminalCount} of ${agentCards.length} assigned DewDrops are live terminals. Bring the rest online before launch.`,
  )
}

function hostBindingItem(agentCards: readonly WorkflowCard[]): SessionReadinessItem {
  if (agentCards.length === 0) {
    return item(
      'hosts',
      'Worker hosts',
      'attention',
      'No worker hosts are bound yet because no DewDrops are assigned.',
    )
  }

  const runtimes = agentCards.map((card) =>
    normalizeAgentRuntime(card.agentRuntime, { cardId: card.id, title: card.title }),
  )
  const hostSummary = summarizeDewDropHostBindings(runtimes)
  return item(
    'hosts',
    'Worker hosts',
    hostSummary.tone,
    hostSummary.detail,
  )
}

export function buildProblemSessionReadiness(
  problem: WorkflowCard,
  options: {
    workspaceMode: DewDropsWorkspaceMode
    agentCount: number
    agentCards?: readonly WorkflowCard[]
    bridgeHealth: ButlerBridgeHealth | null
    blueprint: ProblemSessionBlueprint
  },
): ProblemSessionReadiness {
  const { agentCount, agentCards = [], bridgeHealth, blueprint, workspaceMode } = options
  const approvalHooks = buildProblemApprovalHooks(problem)
  const hasExplicitMemory =
    !!problem.memoryWing?.trim() && !!problem.memoryRoom?.trim() && !!problem.memoryContextSummary?.trim()
  const anchorCount = blueprint.anchors.length

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
    agentRuntimeItem(agentCards),
    hostBindingItem(agentCards),
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
        : 'No anchors pinned yet. Add compartments, entities, or room refs to improve continuity across sessions.',
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
    (() => {
      if (!problem.capabilityProfileId) {
        return item(
          'capability_profile',
          'Capability profile',
          'attention',
          'No capability profile selected. Butler will use its default model and tool access for this job.',
        )
      }
      const profile = getCapabilityProfile(problem.capabilityProfileId)
      if (!profile) {
        return item(
          'capability_profile',
          'Capability profile',
          'attention',
          `Profile "${problem.capabilityProfileId}" was not found in the catalog. Select a valid profile or clear this field.`,
        )
      }
      return item(
        'capability_profile',
        'Capability profile',
        'ready',
        `Profile ${problem.capabilityProfileId} selected — Butler will apply its model and tool constraints.`,
      )
    })(),
    (() => {
      if (!problem.swarmRecipeId) {
        return item(
          'swarm_recipe',
          'Swarm recipe',
          'attention',
          'No swarm recipe selected. Butler will compose the team from assigned agents without a role spec.',
        )
      }
      const recipe = getSwarmRecipe(problem.swarmRecipeId)
      if (!recipe) {
        return item(
          'swarm_recipe',
          'Swarm recipe',
          'attention',
          `Recipe "${problem.swarmRecipeId}" was not found in the catalog. Select a valid recipe or clear this field.`,
        )
      }
      return item(
        'swarm_recipe',
        'Swarm recipe',
        'ready',
        `Recipe ${problem.swarmRecipeId} selected — team composition and role objectives are set.`,
      )
    })(),
  ]

  if (approvalHooks.approvalRequired) {
    const targetLabels = approvalHooks.socialTargets.map(formatSocialTargetLabel)
    const releaseLabel =
      targetLabels.length > 0
        ? targetLabels.join(', ')
        : approvalHooks.publishCheckpoint ?? 'the publish checkpoint'

    items.push(
      item(
        'approval_gate',
        'Publish approval gate',
        approvalHooks.configured ? 'ready' : 'attention',
        approvalHooks.configured
          ? `Human review stays in the loop before sending work toward ${releaseLabel}.`
          : 'This room has publish targets or a release checkpoint, but the brief does not yet encode a clear review gate.',
      ),
    )
  }

  const tone = maxTone(items)
  return {
    tone,
    label: overallLabel(tone),
    summary: summaryText(items),
    items,
  }
}
