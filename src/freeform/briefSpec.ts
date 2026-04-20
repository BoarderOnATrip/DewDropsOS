// BriefSpec is the editable source of truth — persisted on the room card.
// BriefPacket is the immutable compiled snapshot — one per run, never editable.

// Only one escalation trigger exists: an outcome-level contradiction in the brief.
// Ambiguity → agent resolves and logs in assumptions[].
// Technical uncertainty → agent makes best call and logs in assumptions[].
export type EscalationPolicy = 'outcome-contradiction-only'

export type AutonomyPolicy =
  | 'full-auto'             // never surface except contradiction or room complete
  | 'milestone-checkpoint'  // surface at each milestone boundary
  | 'per-run-checkpoint'    // machine-gated after each run before continuing

export type BriefScope = {
  in: string[]   // must be delivered
  out: string[]  // do not touch
}

// polarity: 'good' = reference to emulate; 'bad' = failure mode to avoid
export type BriefExample = {
  label: string
  ref: string      // file path, URL, or artifact id
  note: string     // what's right or wrong about this
  polarity: 'good' | 'bad'
}

export type AcceptanceCriterion = {
  id: string
  description: string        // testable condition, present tense
  verificationHint?: string  // how to check it (test, metric, visual)
}

// The stable context layer — WHY and WHO.
// Set by human, rarely changes between runs.
export type CreativeBrief = {
  mission: string            // the outcome this brief serves, one sentence
  beneficiary: string        // who benefits and what they specifically need
  audience?: string          // end user (may differ from the person writing the brief)
  references: BriefExample[] // good and bad reference points
  tone?: string              // desired quality or approach signal
}

// The work specification layer — WHAT and HOW.
// Agents evaluate their output against this after every run.
export type ExecutionBrief = {
  task: string                            // deliverable, one sentence, verb-first
  acceptanceCriteria: AcceptanceCriterion[]
  scope: BriefScope
  projectStructure?: string[]             // intended file/folder layout for the solution
  antiPatterns: string[]                  // concrete failure modes to avoid
  deliverables: string[]                  // explicit output artifacts
  milestone?: string                      // sprint, phase, or named checkpoint
  dependsOn?: string[]                    // room or task ids that must complete first
  blockedBy?: string[]                    // prerequisites not yet satisfied
  deadline?: string                       // ISO date or named milestone
  effortHint?: string                     // rough budget or sizing signal
}

// Persisted on the room card — the editable source of truth.
// Do not compile agents against this directly; use BriefPacket instead.
export type BriefSpec = {
  id: string
  creative: CreativeBrief
  execution: ExecutionBrief
  capabilityProfileId?: string
  swarmRecipeId?: string
  escalationPolicy: EscalationPolicy
  autonomyPolicy: AutonomyPolicy
  projectId?: string
}

// Immutable compiled snapshot — produced by briefCompiler, never stored as the
// editable room brief. Includes a hash so each run knows exactly what brief it
// executed against, even if the room brief changes mid-project.
export type BriefPacket = {
  briefVersion: number
  briefHash: string     // content hash of the source BriefSpec at compile time
  compiledAt: string    // ISO timestamp
  roomId: string
  creative: CreativeBrief
  execution: ExecutionBrief
  capabilityProfileId?: string
  swarmRecipeId?: string
  escalationPolicy: EscalationPolicy
  autonomyPolicy: AutonomyPolicy
}

export function emptyBriefSpec(id: string): BriefSpec {
  return {
    id,
    creative: {
      mission: '',
      beneficiary: '',
      references: [],
    },
    execution: {
      task: '',
      acceptanceCriteria: [],
      scope: { in: [], out: [] },
      projectStructure: [],
      antiPatterns: [],
      deliverables: [],
    },
    escalationPolicy: 'outcome-contradiction-only',
    autonomyPolicy: 'full-auto',
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

function asTrimmedString(value: unknown): string | undefined {
  return typeof value === 'string' ? value.trim() || undefined : undefined
}

function normalizeStringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string').map((entry) => entry.trim()).filter(Boolean)
    : []
}

function normalizeReferences(value: unknown): BriefExample[] {
  if (!Array.isArray(value)) return []
  return value
    .map((entry): BriefExample | null => {
      const record = asRecord(entry)
      if (!record) return null
      const label = typeof record.label === 'string' ? record.label : ''
      const ref = typeof record.ref === 'string' ? record.ref : ''
      const note = typeof record.note === 'string' ? record.note : ''
      const polarity = record.polarity === 'bad' ? 'bad' : 'good'
      return { label, ref, note, polarity }
    })
    .filter((entry): entry is BriefExample => entry !== null)
}

function normalizeAcceptanceCriteria(value: unknown): AcceptanceCriterion[] {
  if (!Array.isArray(value)) return []
  return value
    .map((entry, index): AcceptanceCriterion | null => {
      const record = asRecord(entry)
      if (!record) return null
      const description = typeof record.description === 'string' ? record.description.trim() : ''
      if (!description) return null
      return {
        id: asTrimmedString(record.id) ?? `criterion-${index + 1}`,
        description,
        verificationHint: asTrimmedString(record.verificationHint),
      }
    })
    .filter((entry): entry is AcceptanceCriterion => entry !== null)
}

export function normalizeBriefSpec(value: unknown, fallbackId: string): BriefSpec {
  const base = emptyBriefSpec(fallbackId)
  const record = asRecord(value)
  if (!record) return base

  const creativeRecord = asRecord(record.creative)
  const executionRecord = asRecord(record.execution)
  const scopeRecord = asRecord(executionRecord?.scope)

  const escalationPolicy =
    record.escalationPolicy === 'outcome-contradiction-only'
      ? record.escalationPolicy
      : base.escalationPolicy
  const autonomyPolicy =
    record.autonomyPolicy === 'full-auto' ||
    record.autonomyPolicy === 'milestone-checkpoint' ||
    record.autonomyPolicy === 'per-run-checkpoint'
      ? record.autonomyPolicy
      : base.autonomyPolicy

  return {
    id: asTrimmedString(record.id) ?? base.id,
    creative: {
      mission: typeof creativeRecord?.mission === 'string' ? creativeRecord.mission : base.creative.mission,
      beneficiary:
        typeof creativeRecord?.beneficiary === 'string'
          ? creativeRecord.beneficiary
          : base.creative.beneficiary,
      audience: asTrimmedString(creativeRecord?.audience),
      references: normalizeReferences(creativeRecord?.references),
      tone: asTrimmedString(creativeRecord?.tone),
    },
    execution: {
      task: typeof executionRecord?.task === 'string' ? executionRecord.task : base.execution.task,
      acceptanceCriteria: normalizeAcceptanceCriteria(executionRecord?.acceptanceCriteria),
      scope: {
        in: normalizeStringList(scopeRecord?.in),
        out: normalizeStringList(scopeRecord?.out),
      },
      projectStructure: normalizeStringList(executionRecord?.projectStructure),
      antiPatterns: normalizeStringList(executionRecord?.antiPatterns),
      deliverables: normalizeStringList(executionRecord?.deliverables),
      milestone: asTrimmedString(executionRecord?.milestone),
      dependsOn: normalizeStringList(executionRecord?.dependsOn),
      blockedBy: normalizeStringList(executionRecord?.blockedBy),
      deadline: asTrimmedString(executionRecord?.deadline),
      effortHint: asTrimmedString(executionRecord?.effortHint),
    },
    capabilityProfileId: asTrimmedString(record.capabilityProfileId),
    swarmRecipeId: asTrimmedString(record.swarmRecipeId),
    escalationPolicy,
    autonomyPolicy,
    projectId: asTrimmedString(record.projectId),
  }
}
