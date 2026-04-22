import type { ButlerSwarmTemplate } from '../lib/butlerBridge'
import { normalizeBriefSpec } from './briefSpec'
import { normalizeAgentRuntime, runtimeProfileLabel } from './agentRuntime'
import { buildProblemLaunchMetadata } from './launchMetadata'
import { openQuestionsForCard } from './openQuestions'
import { buildProblemSessionBlueprint } from './sessionBlueprint'
import { getSwarmRecipe } from './swarmRecipes'
import { agentsInProblemSwarm } from './swarmAgents'
import type { BoardWire, DewDropsWorkspaceMode, WorkflowCard } from './types'

export type ProblemModelLane = 'ollama' | 'frontier'
export type ProblemModelRouteStrategy = 'local_first' | 'frontier_first'

export type ProblemModelRoute = {
  strategy: ProblemModelRouteStrategy
  primary: ProblemModelLane
  fallback: ProblemModelLane
  reason: string
}

export type ProblemModelPacket = {
  version: 1
  route: ProblemModelRoute
  objectiveText: string
  packetLines: string[]
  packetText: string
  stats: {
    lineCount: number
    charCount: number
    agentCount: number
    sourceCount: number
    artifactCount: number
    openQuestionCount: number
  }
}

function clean(value: string | undefined): string {
  return value?.replace(/\s+/g, ' ').trim() ?? ''
}

function compactList(values: readonly string[] | undefined, limit: number): string[] {
  return [...new Set((values ?? []).map((value) => clean(value)).filter(Boolean))].slice(0, limit)
}

function compactArtifacts(problem: WorkflowCard, limit: number): string[] {
  return compactList(problem.runLedger?.[0]?.artifacts.map((artifact) => artifact.title || artifact.summary), limit)
}

function compactWorkers(problem: WorkflowCard, cards: WorkflowCard[], wires: BoardWire[], limit: number): string[] {
  return agentsInProblemSwarm(problem.id, cards, wires)
    .slice(0, limit)
    .map((agent) => {
      const runtime = normalizeAgentRuntime(agent.agentRuntime, { cardId: agent.id, title: agent.title })
      const label = runtimeProfileLabel(runtime.profile).toLowerCase()
      return `${clean(agent.title) || agent.id}(${label})`
    })
}

export function buildProblemModelRoute(
  problem: WorkflowCard,
  cards: WorkflowCard[],
  wires: BoardWire[],
): ProblemModelRoute {
  const launchMetadata = buildProblemLaunchMetadata(problem)
  const recipe = problem.swarmRecipeId ? getSwarmRecipe(problem.swarmRecipeId) : undefined
  const assignedAgents = agentsInProblemSwarm(problem.id, cards, wires)
  const hasBrowserWorker = assignedAgents.some((agent) => {
    const profile = normalizeAgentRuntime(agent.agentRuntime, { cardId: agent.id, title: agent.title }).profile
    return profile === 'browser-harness' || profile === 'browser-harness-js' || profile === 'playwright'
  })
  const briefSpec = problem.briefSpec ? normalizeBriefSpec(problem.briefSpec, `brief-${problem.id}`) : null
  const projectStructureCount = briefSpec?.execution.projectStructure?.length ?? 0
  const deliverableCount = briefSpec?.execution.deliverables?.length ?? 0
  const openQuestionCount = openQuestionsForCard(problem, cards, wires).length

  if (launchMetadata.approvalHooks.approvalRequired) {
    return {
      strategy: 'frontier_first',
      primary: 'frontier',
      fallback: 'ollama',
      reason: 'Publish or approval hooks are present, so human-review-sensitive work should route through the stronger lane first.',
    }
  }

  if (hasBrowserWorker) {
    return {
      strategy: 'frontier_first',
      primary: 'frontier',
      fallback: 'ollama',
      reason: 'Browser-facing execution is attached to this room, so planning and synthesis should stay on the frontier lane first.',
    }
  }

  if (
    recipe?.kind === 'build' ||
    recipe?.kind === 'ship' ||
    assignedAgents.length >= 3 ||
    projectStructureCount >= 4 ||
    deliverableCount >= 4 ||
    openQuestionCount >= 3
  ) {
    return {
      strategy: 'frontier_first',
      primary: 'frontier',
      fallback: 'ollama',
      reason: 'This room has higher coordination or implementation complexity, so the frontier lane should take the first pass.',
    }
  }

  return {
    strategy: 'local_first',
    primary: 'ollama',
    fallback: 'frontier',
    reason: 'This room is compact enough for cheap local triage and packet shaping before escalating.',
  }
}

export function buildProblemModelPacket(
  problem: WorkflowCard,
  cards: WorkflowCard[],
  wires: BoardWire[],
  workspaceMode: DewDropsWorkspaceMode,
  options?: { template?: ButlerSwarmTemplate },
): ProblemModelPacket {
  const route = buildProblemModelRoute(problem, cards, wires)
  const blueprint = buildProblemSessionBlueprint(problem, workspaceMode)
  const briefSpec = problem.briefSpec ? normalizeBriefSpec(problem.briefSpec, `brief-${problem.id}`) : null
  const task = clean(briefSpec?.execution.task || problem.mission)
  const mission = clean(briefSpec?.creative.mission || problem.mission)
  const beneficiary = clean(briefSpec?.creative.beneficiary)
  const deliverables = compactList(briefSpec?.execution.deliverables, 3)
  const acceptance = compactList(
    briefSpec?.execution.acceptanceCriteria.map((criterion) => criterion.description),
    2,
  )
  const openQuestions = compactList(openQuestionsForCard(problem, cards, wires), 3)
  const workers = compactWorkers(problem, cards, wires, 4)
  const sourceMaterials = compactList(blueprint.sourceMaterials, 4)
  const recentArtifacts = compactArtifacts(problem, 4)
  const template = options?.template ?? problem.swarmTemplate

  const objectiveLines = [
    clean(problem.title) || problem.id,
    task ? `Task: ${task}` : mission ? `Mission: ${mission}` : '',
    beneficiary ? `Beneficiary: ${beneficiary}` : '',
    deliverables.length > 0
      ? `Deliver: ${deliverables.join(' | ')}`
      : acceptance.length > 0
        ? `Finish when: ${acceptance.join(' | ')}`
        : '',
    openQuestions.length > 0 ? `Resolve: ${openQuestions.join(' | ')}` : '',
    workers.length > 0 ? `Workers: ${workers.join(' | ')}` : '',
    template ? `Template: ${template}` : '',
    'Context: use attached BriefPacket, RTK basis, handoff packet, and source refs. Do not rediscover context from scratch.',
  ].filter(Boolean)

  const packetLines = [
    'ddpk:v1',
    `route:${route.strategy}|${route.primary}|${route.fallback}`,
    `why:${route.reason}`,
    `room:${clean(problem.title) || problem.id}`,
    task ? `task:${task}` : mission ? `mission:${mission}` : '',
    beneficiary ? `beneficiary:${beneficiary}` : '',
    deliverables.length > 0
      ? `deliver:${deliverables.join(' | ')}`
      : acceptance.length > 0
        ? `finish:${acceptance.join(' | ')}`
        : '',
    openQuestions.length > 0 ? `open:${openQuestions.join(' | ')}` : '',
    workers.length > 0 ? `workers:${workers.join(' | ')}` : '',
    sourceMaterials.length > 0 ? `sources:${sourceMaterials.join(' | ')}` : '',
    recentArtifacts.length > 0 ? `artifacts:${recentArtifacts.join(' | ')}` : '',
    `rtk:${blueprint.memoryWing}/${blueprint.memoryRoom}|${blueprint.launchSurface}|${blueprint.workspaceMode}`,
    'context:attached briefPacket + rtk_basis + handoff_packet + source_refs',
  ].filter(Boolean)

  const packetText = packetLines.join('\n')
  return {
    version: 1,
    route,
    objectiveText: objectiveLines.join('\n'),
    packetLines,
    packetText,
    stats: {
      lineCount: packetLines.length,
      charCount: packetText.length,
      agentCount: agentsInProblemSwarm(problem.id, cards, wires).length,
      sourceCount: blueprint.sourceMaterials.length,
      artifactCount: problem.runLedger?.[0]?.artifacts.length ?? 0,
      openQuestionCount: openQuestionsForCard(problem, cards, wires).length,
    },
  }
}
