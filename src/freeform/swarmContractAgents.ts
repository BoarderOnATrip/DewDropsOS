import type { ButlerSwarmTemplate, CreateSwarmContractInput } from '../lib/butlerBridge'
import type { WorkflowCard } from './types'

type SwarmAgentInput = NonNullable<CreateSwarmContractInput['agents']>[number]

type RoleName = 'framer' | 'builder' | 'reviewer'

type RoleTemplate = {
  toolHints: Record<RoleName, string[]>
  rolePrompt: Record<RoleName, string>
  maxIterations: Record<RoleName, number>
}

const TEMPLATE_ROLE_MAP: Record<ButlerSwarmTemplate, RoleTemplate> = {
  planning: {
    toolHints: {
      framer: ['context_graph_snapshot', 'context_activity_feed', 'list_pending_context', 'butler_memory_search'],
      builder: ['butler_memory_search', 'context_graph_snapshot'],
      reviewer: ['context_activity_feed', 'list_pending_context'],
    },
    rolePrompt: {
      framer: 'Clarify the goal, identify constraints, and frame the current bottleneck clearly.',
      builder: 'Execute the highest-leverage slice directly and turn context into concrete forward motion.',
      reviewer: 'Review outputs, surface risks, and call out missing decisions that still need the human.',
    },
    maxIterations: { framer: 3, builder: 5, reviewer: 3 },
  },
  relationship: {
    toolHints: {
      framer: ['relationship_get_briefing', 'relationship_list_followups', 'context_graph_snapshot'],
      builder: ['relationship_list_followups', 'relationship_get_briefing', 'butler_memory_search'],
      reviewer: ['relationship_get_briefing', 'context_activity_feed'],
    },
    rolePrompt: {
      framer: 'Build the relationship briefing and identify who needs attention next.',
      builder: 'Turn relationship signals into concrete follow-ups and outreach priorities.',
      reviewer: 'Review the follow-ups, missing context, and approvals that still need the human.',
    },
    maxIterations: { framer: 3, builder: 4, reviewer: 3 },
  },
  operator: {
    toolHints: {
      framer: ['openclaw_status', 'secret_recovery_status', 'rtk_status'],
      builder: ['build_swarm_vpn_bootstrap', 'openclaw_status', 'rtk_status'],
      reviewer: ['secret_recovery_status', 'openclaw_status'],
    },
    rolePrompt: {
      framer: 'Inspect the operator stack and identify what is online, offline, or degraded.',
      builder: 'Prepare exact remediation or bootstrap steps for the operator environment.',
      reviewer: 'Review the operator plan, missing approvals, and the safe next move.',
    },
    maxIterations: { framer: 3, builder: 4, reviewer: 3 },
  },
  research: {
    toolHints: {
      framer: ['butler_memory_search', 'context_activity_feed'],
      builder: ['butler_memory_search', 'context_graph_snapshot'],
      reviewer: ['butler_memory_search'],
    },
    rolePrompt: {
      framer: 'Map the strongest existing context and evidence already available for this question.',
      builder: 'Synthesize the most useful evidence and identify remaining knowledge gaps.',
      reviewer: 'Challenge weak assumptions and surface the open questions that remain.',
    },
    maxIterations: { framer: 3, builder: 4, reviewer: 3 },
  },
  build: {
    toolHints: {
      framer: ['context_graph_snapshot', 'context_activity_feed', 'butler_memory_search'],
      builder: ['butler_memory_search', 'list_pending_context', 'context_graph_snapshot'],
      reviewer: ['context_activity_feed', 'list_pending_context'],
    },
    rolePrompt: {
      framer: 'Identify the implementation target, nearby context, and real blockers.',
      builder: 'Turn the current context into concrete build steps or patches with the smallest useful slice first.',
      reviewer: 'Review the build plan for missing dependencies, risks, and oversight decisions.',
    },
    maxIterations: { framer: 3, builder: 4, reviewer: 3 },
  },
}

function roleSequence(count: number): RoleName[] {
  if (count <= 1) return ['builder']
  if (count === 2) return ['framer', 'builder']
  return Array.from({ length: count }, (_, index) => {
    if (index === 0) return 'framer'
    if (index === count - 1) return 'reviewer'
    return 'builder'
  })
}

export function buildSwarmContractAgents(
  problem: WorkflowCard,
  agentCards: WorkflowCard[],
  template: ButlerSwarmTemplate,
  objective: string,
): SwarmAgentInput[] {
  if (agentCards.length === 0) return []

  const config = TEMPLATE_ROLE_MAP[template]
  const ordered = [...agentCards].sort((a, b) => (a.y - b.y) || (a.x - b.x) || a.title.localeCompare(b.title))
  const roles = roleSequence(ordered.length)
  const builderIds: string[] = []
  let framerId = ''

  return ordered.map((card, index) => {
    const role = roles[index]
    const id = card.id
    if (role === 'framer') framerId = id

    let dependsOn: string[] = []
    if (role === 'builder' && framerId) {
      dependsOn = [framerId]
      builderIds.push(id)
    } else if (role === 'reviewer') {
      dependsOn = builderIds.length > 0 ? [...builderIds] : framerId ? [framerId] : []
    }

    return {
      id,
      title: card.title,
      role,
      objective: [
        objective.trim(),
        '',
        `Role: ${config.rolePrompt[role]}`,
        `DewDrops card: "${card.title}" inside problem "${problem.title}".`,
      ].join('\n'),
      depends_on: dependsOn,
      max_iterations: config.maxIterations[role],
      tool_hints: config.toolHints[role],
      metadata: {
        template,
        dewdrops_card_id: card.id,
        dewdrops_problem_id: problem.id,
        dewdrops_card_title: card.title,
      },
    }
  })
}
