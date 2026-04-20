import type { ButlerLaunchSurface, DewDropsWorkspaceMode, MemoryPalaceLocus } from './types'

export type RtkBasisLocus = Pick<MemoryPalaceLocus, 'id' | 'title' | 'kind' | 'detail'>

export type RtkBasis = {
  v: 1
  room_id: string
  brief_version?: number
  brief_hash?: string
  target: string
  launcher: string
  workspace_mode: DewDropsWorkspaceMode
  launch_surface: ButlerLaunchSurface
  memory_wing: string
  memory_room: string
  context_summary: string
  anchors: string[]
  source_materials?: string[]
  capability_profile_id?: string
  swarm_recipe_id?: string
  mission?: string
  beneficiary?: string
  task?: string
  acceptance_criteria?: string[]
  scope_in?: string[]
  scope_out?: string[]
  project_structure?: string[]
  deliverables?: string[]
  milestone?: string
  depends_on?: string[]
  blocked_by?: string[]
  escalation_policy?: string
  autonomy_policy?: string
  phone_brief?: string
  desktop_brief?: string
  visual_loci?: RtkBasisLocus[]
}

function cleanLineValue(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function cleanList(values: readonly string[] | undefined): string[] {
  return (values ?? []).map(cleanLineValue).filter(Boolean)
}

function joinList(values: readonly string[]): string {
  return values.join(' | ')
}

function locusLine(locus: RtkBasisLocus): string {
  return `${cleanLineValue(locus.kind)} | ${cleanLineValue(locus.title)} | ${cleanLineValue(locus.detail)}`
}

export function buildRtkBasis(input: {
  room_id: string
  brief_version?: number
  brief_hash?: string
  target: string
  launcher: string
  workspace_mode: DewDropsWorkspaceMode
  launch_surface: ButlerLaunchSurface
  memory_wing: string
  memory_room: string
  context_summary: string
  anchors: string[]
  source_materials?: string[]
  capability_profile_id?: string
  swarm_recipe_id?: string
  mission?: string
  beneficiary?: string
  task?: string
  acceptance_criteria?: string[]
  scope_in?: string[]
  scope_out?: string[]
  project_structure?: string[]
  deliverables?: string[]
  milestone?: string
  depends_on?: string[]
  blocked_by?: string[]
  escalation_policy?: string
  autonomy_policy?: string
  phone_brief?: string
  desktop_brief?: string
  visual_loci?: RtkBasisLocus[]
}): RtkBasis {
  return {
    v: 1,
    room_id: cleanLineValue(input.room_id),
    brief_version: typeof input.brief_version === 'number' ? input.brief_version : undefined,
    brief_hash: input.brief_hash?.trim() || undefined,
    target: cleanLineValue(input.target),
    launcher: cleanLineValue(input.launcher),
    workspace_mode: input.workspace_mode,
    launch_surface: input.launch_surface,
    memory_wing: cleanLineValue(input.memory_wing),
    memory_room: cleanLineValue(input.memory_room),
    context_summary: cleanLineValue(input.context_summary),
    anchors: cleanList(input.anchors),
    source_materials: cleanList(input.source_materials),
    capability_profile_id: input.capability_profile_id?.trim() || undefined,
    swarm_recipe_id: input.swarm_recipe_id?.trim() || undefined,
    mission: input.mission?.trim() || undefined,
    beneficiary: input.beneficiary?.trim() || undefined,
    task: input.task?.trim() || undefined,
    acceptance_criteria: cleanList(input.acceptance_criteria),
    scope_in: cleanList(input.scope_in),
    scope_out: cleanList(input.scope_out),
    project_structure: cleanList(input.project_structure),
    deliverables: cleanList(input.deliverables),
    milestone: input.milestone?.trim() || undefined,
    depends_on: cleanList(input.depends_on),
    blocked_by: cleanList(input.blocked_by),
    escalation_policy: input.escalation_policy?.trim() || undefined,
    autonomy_policy: input.autonomy_policy?.trim() || undefined,
    phone_brief: input.phone_brief?.trim() || undefined,
    desktop_brief: input.desktop_brief?.trim() || undefined,
    visual_loci: (input.visual_loci ?? []).map((locus) => ({
      id: cleanLineValue(locus.id),
      title: cleanLineValue(locus.title),
      kind: locus.kind,
      detail: cleanLineValue(locus.detail),
    })),
  }
}

export function serializeRtkBasisLines(basis: RtkBasis): string[] {
  const lines = [`rtk:v${basis.v}`]

  const scalarLines: Array<[string, string | number | undefined]> = [
    ['rid', basis.room_id],
    ['bv', basis.brief_version],
    ['bh', basis.brief_hash],
    ['ws', basis.workspace_mode],
    ['ls', basis.launch_surface],
    ['tg', basis.target],
    ['ln', basis.launcher],
    ['mw', basis.memory_wing],
    ['mr', basis.memory_room],
    ['cp', basis.capability_profile_id],
    ['sr', basis.swarm_recipe_id],
    ['ep', basis.escalation_policy],
    ['ap', basis.autonomy_policy],
    ['ctx', basis.context_summary],
    ['m', basis.mission],
    ['bn', basis.beneficiary],
    ['tk', basis.task],
    ['mil', basis.milestone],
    ['pb', basis.phone_brief],
    ['db', basis.desktop_brief],
  ]
  for (const [key, value] of scalarLines) {
    if (value === undefined || value === '') continue
    lines.push(`${key}:${String(value)}`)
  }

  const listLines: Array<[string, readonly string[] | undefined]> = [
    ['a', basis.anchors],
    ['src', basis.source_materials],
    ['ac', basis.acceptance_criteria],
    ['in', basis.scope_in],
    ['out', basis.scope_out],
    ['ps', basis.project_structure],
    ['dl', basis.deliverables],
    ['dep', basis.depends_on],
    ['blk', basis.blocked_by],
  ]
  for (const [key, values] of listLines) {
    if (!values || values.length === 0) continue
    lines.push(`${key}:${joinList(values)}`)
  }

  basis.visual_loci?.forEach((locus, index) => {
    lines.push(`l${index + 1}:${locusLine(locus)}`)
  })

  return lines
}

export type RtkDelta = {
  v: 1
  continuation_decision: 'continue' | 'complete' | 'escalate'
  brief_hash?: string
  brief_version?: number
  criteria_remaining?: string[]
  next_action?: string
  assumptions?: string[]
  handoff_notes?: string
}

export function buildRtkDelta(input: {
  continuation_decision: 'continue' | 'complete' | 'escalate'
  brief_hash?: string
  brief_version?: number
  criteria_remaining?: string[]
  next_action?: string
  assumptions?: string[]
  handoff_notes?: string
}): RtkDelta {
  return {
    v: 1,
    continuation_decision: input.continuation_decision,
    brief_hash: input.brief_hash?.trim() || undefined,
    brief_version: typeof input.brief_version === 'number' ? input.brief_version : undefined,
    criteria_remaining: cleanList(input.criteria_remaining),
    next_action: input.next_action ? cleanLineValue(input.next_action) || undefined : undefined,
    assumptions: cleanList(input.assumptions),
    handoff_notes: input.handoff_notes?.trim() || undefined,
  }
}

export function serializeRtkDeltaLines(delta: RtkDelta): string[] {
  const lines = [`rtk_delta:v${delta.v}`]

  lines.push(`cd:${delta.continuation_decision}`)

  if (delta.brief_hash) lines.push(`bh:${delta.brief_hash}`)
  if (delta.brief_version !== undefined) lines.push(`bv:${delta.brief_version}`)
  if (delta.criteria_remaining && delta.criteria_remaining.length > 0) {
    lines.push(`cr:${joinList(delta.criteria_remaining)}`)
  }
  if (delta.next_action) lines.push(`na:${delta.next_action}`)
  if (delta.assumptions && delta.assumptions.length > 0) {
    lines.push(`asm:${joinList(delta.assumptions)}`)
  }
  if (delta.handoff_notes) lines.push(`hn:${delta.handoff_notes}`)

  return lines
}

// Structured handoff notes convention for agent-to-agent reasoning.
//
// dec: what was chosen/decided
// why: the reasoning that made it the right call
// rej: what was considered and not chosen (optional)
// watch: the condition that would make the decision worth revisiting (optional)
export type HandoffNotesContent = {
  dec: string
  why: string
  rej?: string
  watch?: string
}

export function formatHandoffNotes(content: HandoffNotesContent): string {
  const lines = [
    `dec:${content.dec.trim()}`,
    `why:${content.why.trim()}`,
  ]
  const rej = content.rej?.trim()
  const watch = content.watch?.trim()
  if (rej) lines.push(`rej:${rej}`)
  if (watch) lines.push(`watch:${watch}`)
  return lines.join('\n')
}

export function parseHandoffNotes(notes: string): HandoffNotesContent | null {
  const fields: Record<string, string> = {}
  for (const line of notes.split('\n')) {
    const colon = line.indexOf(':')
    if (colon === -1) continue
    const key = line.slice(0, colon).trim()
    const value = line.slice(colon + 1).trim()
    if (key && value) fields[key] = value
  }
  if (!fields.dec || !fields.why) return null
  return {
    dec: fields.dec,
    why: fields.why,
    ...(fields.rej ? { rej: fields.rej } : {}),
    ...(fields.watch ? { watch: fields.watch } : {}),
  }
}
