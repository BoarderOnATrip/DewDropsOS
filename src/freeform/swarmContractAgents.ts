import type { ButlerSwarmTemplate, CreateSwarmContractInput } from '../lib/butlerBridge'
import { describeAgentRuntime, describeAgentSessionPolicy, normalizeAgentRuntime } from './agentRuntime'
import { buildProblemSessionBlueprint } from './sessionBlueprint'
import type { DewDropsWorkspaceMode, WorkflowCard } from './types'

type SwarmAgentInput = NonNullable<CreateSwarmContractInput['agents']>[number]

type RoleName = 'on_duty' | 'worker' | 'review'

type RoleTemplate = {
  toolHints: Record<RoleName, string[]>
  rolePrompt: Record<RoleName, string>
  maxIterations: Record<RoleName, number>
}

const TEMPLATE_ROLE_MAP: Record<ButlerSwarmTemplate, RoleTemplate> = {
  planning: {
    toolHints: {
      on_duty: ['context_graph_snapshot', 'context_activity_feed', 'list_pending_context', 'butler_memory_search'],
      worker: ['butler_memory_search', 'context_graph_snapshot'],
      review: ['context_activity_feed', 'list_pending_context'],
    },
    rolePrompt: {
      on_duty: 'Clarify the goal, identify constraints, and route the swarm toward the next useful move.',
      worker: 'Execute the highest-leverage slice directly and turn context into concrete forward motion.',
      review: 'Review outputs, surface risks, and call out missing decisions that still need the human.',
    },
    maxIterations: { on_duty: 3, worker: 5, review: 3 },
  },
  relationship: {
    toolHints: {
      on_duty: ['relationship_get_briefing', 'relationship_list_followups', 'context_graph_snapshot'],
      worker: ['relationship_list_followups', 'relationship_get_briefing', 'butler_memory_search'],
      review: ['relationship_get_briefing', 'context_activity_feed'],
    },
    rolePrompt: {
      on_duty: 'Build the relationship briefing and identify who needs attention next.',
      worker: 'Turn relationship signals into concrete follow-ups and outreach priorities.',
      review: 'Review the follow-ups, missing context, and approvals that still need the human.',
    },
    maxIterations: { on_duty: 3, worker: 4, review: 3 },
  },
  operator: {
    toolHints: {
      on_duty: ['openclaw_status', 'secret_recovery_status', 'rtk_status'],
      worker: ['build_swarm_vpn_bootstrap', 'openclaw_status', 'rtk_status'],
      review: ['secret_recovery_status', 'openclaw_status'],
    },
    rolePrompt: {
      on_duty: 'Inspect the operator stack and identify what is online, offline, or degraded.',
      worker: 'Prepare exact remediation or bootstrap steps for the operator environment.',
      review: 'Review the operator plan, missing approvals, and the safe next move.',
    },
    maxIterations: { on_duty: 3, worker: 4, review: 3 },
  },
  research: {
    toolHints: {
      on_duty: ['butler_memory_search', 'context_activity_feed'],
      worker: ['butler_memory_search', 'context_graph_snapshot'],
      review: ['butler_memory_search'],
    },
    rolePrompt: {
      on_duty: 'Map the strongest existing context and evidence already available for this question.',
      worker: 'Synthesize the most useful evidence and identify remaining knowledge gaps.',
      review: 'Challenge weak assumptions and surface the open questions that remain.',
    },
    maxIterations: { on_duty: 3, worker: 4, review: 3 },
  },
  build: {
    toolHints: {
      on_duty: ['context_graph_snapshot', 'context_activity_feed', 'butler_memory_search'],
      worker: ['butler_memory_search', 'list_pending_context', 'context_graph_snapshot'],
      review: ['context_activity_feed', 'list_pending_context'],
    },
    rolePrompt: {
      on_duty: 'Identify the implementation target, nearby context, and real blockers.',
      worker: 'Turn the current context into concrete build steps or patches with the smallest useful slice first.',
      review: 'Review the build plan for missing dependencies, risks, and oversight decisions.',
    },
    maxIterations: { on_duty: 3, worker: 4, review: 3 },
  },
}

function roleSequence(count: number): RoleName[] {
  if (count <= 1) return ['worker']
  if (count === 2) return ['on_duty', 'worker']
  return Array.from({ length: count }, (_, index) => {
    if (index === 0) return 'on_duty'
    if (index === count - 1) return 'review'
    return 'worker'
  })
}

export function buildSwarmContractAgents(
  problem: WorkflowCard,
  agentCards: WorkflowCard[],
  template: ButlerSwarmTemplate,
  objective: string,
  workspaceMode: DewDropsWorkspaceMode = 'desktop',
): SwarmAgentInput[] {
  if (agentCards.length === 0) return []

  const config = TEMPLATE_ROLE_MAP[template]
  const blueprint = buildProblemSessionBlueprint(problem, workspaceMode)
  const ordered = [...agentCards].sort((a, b) => (a.y - b.y) || (a.x - b.x) || a.title.localeCompare(b.title))
  const roles = roleSequence(ordered.length)
  const workerIds: string[] = []
  let onDutyId = ''

  return ordered.map((card, index) => {
    const role = roles[index]
    const id = card.id
    const runtime = normalizeAgentRuntime(card.agentRuntime, { cardId: card.id, title: card.title })
    if (role === 'on_duty') onDutyId = id
    if (role === 'worker') workerIds.push(id)

    let dependsOn: string[] = []
    if (role === 'worker' && onDutyId) {
      dependsOn = [onDutyId]
    } else if (role === 'review') {
      dependsOn = workerIds.length > 0 ? [...workerIds] : onDutyId ? [onDutyId] : []
    }

    return {
      id,
      title: card.title,
      role,
      objective: [
        objective.trim(),
        '',
        `Duty: ${config.rolePrompt[role]}`,
        `DewDrops card: "${card.title}" inside problem "${problem.title}".`,
        `Runtime: ${describeAgentRuntime({ ...card, agentRuntime: runtime })}.`,
        `Session policy: ${describeAgentSessionPolicy(runtime)}.`,
        `Memory palace: ${blueprint.memoryWing}/${blueprint.memoryRoom}.`,
      ].join('\n'),
      depends_on: dependsOn,
      max_iterations: config.maxIterations[role],
      tool_hints: config.toolHints[role],
      metadata: {
        template,
        dewdrops_card_id: card.id,
        dewdrops_problem_id: problem.id,
        dewdrops_card_title: card.title,
        runtime_kind: runtime.kind,
        runtime_profile: runtime.profile,
        runtime_transport: runtime.transport,
        runtime_instance_label: runtime.instanceLabel,
        runtime_command: runtime.command,
        runtime_vpn_alias: runtime.vpnAlias,
        runtime_workspace_root: runtime.workspaceRoot,
        session_policy_max_runtime_ms: runtime.sessionPolicy?.maxRuntimeMs,
        session_policy_max_steps: runtime.sessionPolicy?.maxSteps,
        session_policy_allow_network: runtime.sessionPolicy?.allowNetwork,
        session_policy_writable_roots: runtime.sessionPolicy?.writableRoots,
        session_policy_requires_approval_for: runtime.sessionPolicy?.requiresApprovalFor,
        session_state_status: runtime.sessionState?.status,
        memory_wing: blueprint.memoryWing,
        memory_room: blueprint.memoryRoom,
        preferred_launch_surface: problem.preferredLaunchSurface ?? blueprint.launchSurface,
      },
    }
  })
}
