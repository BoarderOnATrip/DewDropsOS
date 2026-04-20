import { normalizeBriefSpec } from './briefSpec'
import type { ButlerLaunchSurface, DewDropsWorkspaceMode, WorkflowCard } from './types'
import { collectProblemAnchorRefs } from './briefCompartments'
import { buildVisualMemoryPalace } from './visualMemoryPalace'
import { buildRtkBasis, serializeRtkBasisLines, type RtkBasis } from './rtk'

type Option<T extends string> = {
  value: T
  label: string
  detail: string
}

export const WORKSPACE_MODE_OPTIONS: Array<Option<DewDropsWorkspaceMode>> = [
  {
    value: 'desktop',
    label: 'Desktop session',
    detail: 'Dense operator surface for heavy execution, reviews, and long work loops.',
  },
  {
    value: 'phone',
    label: 'Phone relay',
    detail: 'Compact handoff mode for capture, screening, and quick Butler relay work.',
  },
  {
    value: 'palace',
    label: 'Memory palace',
    detail: 'Context-first review mode for rooms, anchors, and continuity packets.',
  },
]

export const LAUNCH_SURFACE_OPTIONS: Array<Option<ButlerLaunchSurface>> = [
  {
    value: 'desktop',
    label: 'Desktop',
    detail: 'Launch directly into the full desktop operator surface.',
  },
  {
    value: 'phone',
    label: 'Phone',
    detail: 'Launch a phone-aware Butler relay suited to capture and quick action.',
  },
  {
    value: 'hybrid',
    label: 'Hybrid',
    detail: 'Run a cross-device handoff between desktop depth and phone continuity.',
  },
]

const WORKSPACE_LABELS: Record<DewDropsWorkspaceMode, string> = {
  desktop: 'Desktop session',
  phone: 'Phone relay',
  palace: 'Memory palace',
}

const SURFACE_LABELS: Record<ButlerLaunchSurface, string> = {
  desktop: 'Desktop',
  phone: 'Phone',
  hybrid: 'Hybrid',
}

export type ProblemSessionBlueprint = {
  workspaceMode: DewDropsWorkspaceMode
  workspaceLabel: string
  launchSurface: ButlerLaunchSurface
  launchSurfaceLabel: string
  target: string
  launcher: string
  memoryWing: string
  memoryRoom: string
  contextSummary: string
  anchors: string[]
  sourceMaterials: string[]
  visualLoci: ReturnType<typeof buildVisualMemoryPalace>
  phoneBrief: string
  desktopBrief: string
  capabilityProfileId?: string
  swarmRecipeId?: string
  projectStructure: string[]
  rtkBasis: RtkBasis
  handoffLines: string[]
  handoffText: string
  sourceRefs: string[]
}

function slugToken(input: string, fallback: string): string {
  const normalized = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return normalized || fallback
}

export function parseAnchorInput(raw: string): string[] {
  const parts = raw
    .split(/[\n,]+/)
    .map((part) => part.trim())
    .filter(Boolean)
  return [...new Set(parts)]
}

export function formatAnchorInput(anchors: readonly string[] | undefined): string {
  return Array.isArray(anchors) ? anchors.join(', ') : ''
}

export function buildProblemSessionBlueprint(
  problem: WorkflowCard,
  workspaceMode: DewDropsWorkspaceMode,
): ProblemSessionBlueprint {
  const launchSurface =
    problem.preferredLaunchSurface ??
    (workspaceMode === 'phone' ? 'phone' : workspaceMode === 'palace' ? 'hybrid' : 'desktop')

  const target =
    launchSurface === 'phone'
      ? 'paired_phone'
      : launchSurface === 'hybrid'
        ? 'cross_device_handoff'
        : 'local_desktop'
  const launcher = launchSurface === 'phone' ? 'mobile' : 'desktop'
  const memoryWing = problem.memoryWing?.trim() || slugToken(problem.title, problem.id)
  const memoryRoom =
    problem.memoryRoom?.trim() ||
    (workspaceMode === 'palace'
      ? 'context-map'
      : workspaceMode === 'phone'
        ? 'phone-relay'
        : 'heavy-work')
  const contextSummary =
    problem.memoryContextSummary?.trim() ||
    problem.mission?.split(/\n+/).map((line) => line.trim()).find(Boolean) ||
    `Room context for ${problem.title}.`
  const anchors = collectProblemAnchorRefs(problem)
  const sourceMaterials = (problem.briefCompartmentAssets ?? []).map(
    (asset) => `${asset.compartmentLabel} -> ${asset.name}`,
  )
  const visualLoci = buildVisualMemoryPalace(problem)
  const phoneBrief = problem.phoneRelayBrief?.trim() || ''
  const desktopBrief = problem.desktopSessionBrief?.trim() || ''
  const capabilityProfileId = problem.capabilityProfileId?.trim() || undefined
  const swarmRecipeId = problem.swarmRecipeId?.trim() || undefined
  const briefSpec = problem.briefSpec ? normalizeBriefSpec(problem.briefSpec, `brief-${problem.id}`) : null
  const projectStructure = briefSpec?.execution.projectStructure ?? []
  const rtkBasis = buildRtkBasis({
    room_id: problem.butlerRoomId?.trim() || problem.id,
    brief_version: problem.briefVersion,
    target,
    launcher,
    workspace_mode: workspaceMode,
    launch_surface: launchSurface,
    memory_wing: memoryWing,
    memory_room: memoryRoom,
    context_summary: contextSummary,
    anchors,
    source_materials: sourceMaterials,
    capability_profile_id: capabilityProfileId,
    swarm_recipe_id: swarmRecipeId,
    mission: briefSpec?.creative.mission ?? problem.mission,
    beneficiary: briefSpec?.creative.beneficiary,
    task: briefSpec?.execution.task,
    acceptance_criteria: briefSpec?.execution.acceptanceCriteria.map((criterion) => `${criterion.id}:${criterion.description}`),
    scope_in: briefSpec?.execution.scope.in,
    scope_out: briefSpec?.execution.scope.out,
    project_structure: projectStructure,
    deliverables: briefSpec?.execution.deliverables,
    milestone: briefSpec?.execution.milestone,
    depends_on: briefSpec?.execution.dependsOn,
    blocked_by: briefSpec?.execution.blockedBy,
    escalation_policy: briefSpec?.escalationPolicy,
    autonomy_policy: briefSpec?.autonomyPolicy,
    phone_brief: phoneBrief,
    desktop_brief: desktopBrief,
    visual_loci: visualLoci,
  })
  const handoffLines = serializeRtkBasisLines(rtkBasis)

  return {
    workspaceMode,
    workspaceLabel: WORKSPACE_LABELS[workspaceMode],
    launchSurface,
    launchSurfaceLabel: SURFACE_LABELS[launchSurface],
    target,
    launcher,
    memoryWing,
    memoryRoom,
    contextSummary,
    anchors,
    sourceMaterials,
    visualLoci,
    phoneBrief,
    desktopBrief,
    capabilityProfileId,
    swarmRecipeId,
    projectStructure,
    rtkBasis,
    handoffLines,
    handoffText: handoffLines.join('\n'),
    sourceRefs: [
      `dewdrops/cards/${problem.id}`,
      ...(problem.briefCompartmentAssets ?? []).slice(0, 8).map((asset) => `dewdrops/cards/${problem.id}/compartments/${asset.id}`),
      `lifegirdle/wings/${memoryWing}/rooms/${memoryRoom}`,
    ],
  }
}
