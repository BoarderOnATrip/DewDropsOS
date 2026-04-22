import { compileBriefPacket } from '../briefCompiler'
import type {
  MemoryPalaceLocus,
  RunArtifact,
  RunLedgerEntry,
  SelfEvaluation,
  WorkflowCard,
} from '../types'

type SystemOwner = 'mira' | 'aiButler' | 'paperclip' | 'dewdrops'
type SyncPolicy = 'canonical' | 'derived' | 'reference-only'
type OpportunityStageId = 'intake' | 'qualified' | 'scoped' | 'ready' | 'active' | 'completed'

type OpportunityStageDefinition = {
  id: OpportunityStageId
  label: string
  objective: string
  sourceOfTruth: SystemOwner
  entrySignals: string[]
  requiredEvidence: string[]
  exitCriteria: string[]
}

type OpportunityDeliverableDefinition = {
  id: string
  label: string
  requiredByStage: OpportunityStageId
  sourceOfTruth: SystemOwner
  syncPolicy: SyncPolicy
  summary: string
  completionEvidence: string
}

type OpportunityWorkflowSlice = {
  id: string
  label: string
  trigger: string
  systems: SystemOwner[]
  outputs: string[]
  note: string
}

type OpportunityReadinessGate = {
  id: string
  label: string
  stages: OpportunityStageId[]
  sourceOfTruth: SystemOwner
  detail: string
  missingState: string
}

const OPPORTUNITY_PASS_RUN_ID = 'run-crm-opportunities-brief-pass-1'
const OPPORTUNITY_PASS_CONTRACT_ID = 'contract-crm-opportunities-brief-pass-1'
const OPPORTUNITY_PASS_TITLE = 'Opportunities room live brief-engine pass'
const OPPORTUNITY_PASS_STARTED_AT = '2026-04-18T20:05:00.000Z'
const OPPORTUNITY_PASS_COMPLETED_AT = '2026-04-18T20:31:00.000Z'

const OPPORTUNITY_ARTIFACT_ANCHORS = [
  'artifact/crm/opportunity-workflow-spec',
  'artifact/crm/opportunity-module-plan',
  'artifact/crm/opportunity-readiness-artifact',
] as const

const OPPORTUNITY_MEMORY_LOCI: readonly MemoryPalaceLocus[] = [
  {
    id: 'crm-opportunities-north-star',
    title: 'Opportunity Lane Arch',
    kind: 'north_star',
    detail:
      'Keep every active opportunity moving from phone intake to completion without copying CRM truth into the orchestration layer.',
  },
  {
    id: 'crm-opportunities-room',
    title: 'Opportunities Room Floor',
    kind: 'room',
    detail: 'Canonical DewDrops room for generic CRM opportunity workflow, deliverables, and readiness artifacts.',
  },
  {
    id: 'crm-opportunities-spec',
    title: 'Workflow Spec Binder',
    kind: 'artifact',
    detail: 'artifact/crm/opportunity-workflow-spec',
  },
  {
    id: 'crm-opportunities-plan',
    title: 'Module Plan Board',
    kind: 'artifact',
    detail: 'artifact/crm/opportunity-module-plan',
  },
  {
    id: 'crm-opportunities-readiness',
    title: 'Readiness Gate Rack',
    kind: 'artifact',
    detail: 'artifact/crm/opportunity-readiness-artifact',
  },
  {
    id: 'crm-opportunities-phone-brief',
    title: 'Phone Brief Portal',
    kind: 'portal',
    detail: 'aiButler/phone-briefing/opportunities',
  },
] as const

export const CRM_OPPORTUNITY_STAGE_FLOW: readonly OpportunityStageDefinition[] = [
  {
    id: 'intake',
    label: 'Intake',
    objective: 'Capture the phone request, the desired outcome, and the linked CRM context before work fans out.',
    sourceOfTruth: 'mira',
    entrySignals: [
      'A user asks for help on the phone or drops a fresh CRM request into the room.',
      'The opportunity has a named contact, company, or account context worth acting on.',
    ],
    requiredEvidence: [
      'Opportunity intake packet with request summary, primary contact ref, and target outcome.',
      'Initial due window or urgency note recorded in Mira.',
    ],
    exitCriteria: [
      'The opportunity has a stable CRM record in Mira.',
      'The request can be understood without replaying the original conversation.',
    ],
  },
  {
    id: 'qualified',
    label: 'Qualified',
    objective: 'Confirm that the opportunity is real, worth pursuing now, and has a clear owner plus success condition.',
    sourceOfTruth: 'mira',
    entrySignals: [
      'Intake is captured and the operator can state what outcome would make the work worthwhile.',
    ],
    requiredEvidence: [
      'Qualification record with fit, urgency, owner, and target outcome.',
      'Known blocker or no-go reasons called out explicitly instead of staying implicit.',
    ],
    exitCriteria: [
      'The room can say why the opportunity should move forward now.',
      'The next stage can be staffed without asking the human to restate intent.',
    ],
  },
  {
    id: 'scoped',
    label: 'Scoped',
    objective: 'Translate the qualified opportunity into a controlled execution plan with named deliverables and dependencies.',
    sourceOfTruth: 'mira',
    entrySignals: [
      'Qualification is complete and there is enough context to define the work lane.',
    ],
    requiredEvidence: [
      'Execution plan with the required deliverables, owners, due windows, and dependency notes.',
      'Stage-specific outputs are named so agents know what done looks like.',
    ],
    exitCriteria: [
      'The opportunity has a clear plan rather than a vague request.',
      'Required deliverables are explicit enough to survive agent handoffs.',
    ],
  },
  {
    id: 'ready',
    label: 'Ready',
    objective: 'Verify that the required assets, evidence, and room bindings exist before delivery starts.',
    sourceOfTruth: 'mira',
    entrySignals: [
      'The scoped plan exists and the team is ready to gather or verify inputs.',
    ],
    requiredEvidence: [
      'Asset register with each required file, note, or dependency tracked by status.',
      'Readiness gates checked with missing items called out explicitly.',
    ],
    exitCriteria: [
      'Any missing asset or unknown dependency is visible before execution starts.',
      'The room can tell aiButler what is ready and what still blocks the work.',
    ],
  },
  {
    id: 'active',
    label: 'Active',
    objective: 'Run the opportunity through the live execution lane while keeping phone briefs and orchestration refs in sync.',
    sourceOfTruth: 'mira',
    entrySignals: [
      'Readiness is satisfied enough to start execution.',
      'The operator or an agent has a concrete next action to take now.',
    ],
    requiredEvidence: [
      'aiButler phone execution brief derived from current CRM state.',
      'Paperclip execution refs attached by reference only so orchestration can run without becoming the database.',
      'DewDrops room anchors updated with the active workflow artifacts.',
    ],
    exitCriteria: [
      'The opportunity can be briefed from the phone with current stage, blockers, and next action.',
      'Execution history exists without duplicating canonical CRM state into Paperclip.',
    ],
  },
  {
    id: 'completed',
    label: 'Completed',
    objective: 'Close the loop with outcome capture, delivered artifacts, and reporting-ready notes back in Mira.',
    sourceOfTruth: 'mira',
    entrySignals: [
      'The active work finished or was explicitly closed with a known outcome.',
    ],
    requiredEvidence: [
      'Completion record with delivered outputs, outcome summary, and reporting notes.',
      'Final follow-up or closure brief available for aiButler to relay back to the user.',
    ],
    exitCriteria: [
      'Mira can answer what happened, what was delivered, and what should happen next.',
      'The phone runtime can brief the user on the completed outcome without manual reconstruction.',
    ],
  },
] as const

export const CRM_OPPORTUNITY_DELIVERABLES: readonly OpportunityDeliverableDefinition[] = [
  {
    id: 'opportunity_intake_packet',
    label: 'Opportunity intake packet',
    requiredByStage: 'intake',
    sourceOfTruth: 'mira',
    syncPolicy: 'canonical',
    summary: 'The initial CRM record tying the request to contacts, outcome, urgency, and the raw ask.',
    completionEvidence: 'A Mira opportunity record exists with linked contact refs and a request summary.',
  },
  {
    id: 'qualification_record',
    label: 'Qualification record',
    requiredByStage: 'qualified',
    sourceOfTruth: 'mira',
    syncPolicy: 'canonical',
    summary: 'The decision note explaining why the opportunity is worth pursuing now and who owns it.',
    completionEvidence: 'Fit, urgency, owner, and target outcome are written into the opportunity record.',
  },
  {
    id: 'execution_plan',
    label: 'Execution plan',
    requiredByStage: 'scoped',
    sourceOfTruth: 'mira',
    syncPolicy: 'canonical',
    summary: 'The work lane definition covering deliverables, due windows, dependencies, and expected outputs.',
    completionEvidence: 'Named deliverables and dependency notes exist in the opportunity plan.',
  },
  {
    id: 'asset_register',
    label: 'Asset register',
    requiredByStage: 'ready',
    sourceOfTruth: 'mira',
    syncPolicy: 'canonical',
    summary: 'A tracked list of the files, notes, proofs, or external inputs required before or during execution.',
    completionEvidence: 'Each required asset has a status, owner, and missing-state note.',
  },
  {
    id: 'phone_execution_brief',
    label: 'Phone execution brief',
    requiredByStage: 'active',
    sourceOfTruth: 'aiButler',
    syncPolicy: 'derived',
    summary: 'A short aiButler briefing with current stage, blockers, next action, and the reason it matters now.',
    completionEvidence: 'The active opportunity can be relayed back to the user as a phone-ready brief.',
  },
  {
    id: 'paperclip_execution_refs',
    label: 'Paperclip execution refs',
    requiredByStage: 'active',
    sourceOfTruth: 'paperclip',
    syncPolicy: 'reference-only',
    summary: 'Issue and run references for orchestration, staffing, and execution auditability only.',
    completionEvidence: 'Paperclip issue or run IDs are linked by reference without storing canonical CRM state there.',
  },
  {
    id: 'completion_record',
    label: 'Completion record',
    requiredByStage: 'completed',
    sourceOfTruth: 'mira',
    syncPolicy: 'canonical',
    summary: 'The closeout artifact with outcome, delivered work, reporting notes, and the next expected follow-up.',
    completionEvidence: 'Mira stores the outcome summary, delivered outputs, and reporting-ready status.',
  },
] as const

export const CRM_OPPORTUNITY_MODULE_PLAN: readonly OpportunityWorkflowSlice[] = [
  {
    id: 'phone-intake',
    label: 'Phone intake to CRM record',
    trigger: 'The user asks on the phone for help with an opportunity.',
    systems: ['aiButler', 'mira', 'dewdrops'],
    outputs: [
      'aiButler captures a concise request summary.',
      'Mira stores the intake packet as the canonical opportunity record.',
      'DewDrops receives an anchorable room summary for follow-on execution.',
    ],
    note:
      'The phone runtime captures and relays context, but the canonical opportunity state lives in Mira from the first step.',
  },
  {
    id: 'qualification-scope',
    label: 'Qualification and scope lock',
    trigger: 'The intake packet exists and the team needs to decide whether and how to pursue it.',
    systems: ['mira', 'dewdrops'],
    outputs: [
      'Qualification record with owner, urgency, and target outcome.',
      'Execution plan with deliverables, due windows, and dependencies.',
      'Room-visible workflow artifacts for later brief-engine passes.',
    ],
    note:
      'This slice converts a vague ask into a repeatable build lane without changing the underlying contact model.',
  },
  {
    id: 'execution-lane',
    label: 'CRM-aware execution lane',
    trigger: 'The opportunity is scoped and needs active delivery plus live briefings.',
    systems: ['mira', 'aiButler', 'paperclip', 'dewdrops'],
    outputs: [
      'Asset register with live status per required input.',
      'aiButler phone execution brief with current stage and next action.',
      'Paperclip execution refs linked by reference only for orchestration and staffing.',
    ],
    note:
      'Paperclip runs the work, DewDrops projects the lane, and aiButler briefs the user, but Mira remains the source of truth for opportunity state.',
  },
  {
    id: 'completion-loop',
    label: 'Completion and reporting loop',
    trigger: 'The active work is done or explicitly closed with a known outcome.',
    systems: ['mira', 'aiButler', 'dewdrops'],
    outputs: [
      'Completion record with delivered outputs and reporting notes.',
      'aiButler closure brief for the user-facing runtime.',
      'Accepted room artifacts available for future recall and review.',
    ],
    note:
      'The slice ends when the phone can answer what happened and what matters next without human reconstruction.',
  },
] as const

export const CRM_OPPORTUNITY_READINESS_GATES: readonly OpportunityReadinessGate[] = [
  {
    id: 'linked-context',
    label: 'Linked context',
    stages: ['intake', 'qualified'],
    sourceOfTruth: 'mira',
    detail: 'Each opportunity needs linked contact or account refs plus a stable desired outcome before it can qualify.',
    missingState: 'No linked CRM context means the room still depends on the human remembering who or what the work is for.',
  },
  {
    id: 'deliverable-definition',
    label: 'Deliverable definition',
    stages: ['qualified', 'scoped'],
    sourceOfTruth: 'mira',
    detail: 'Qualification must produce a scoped plan with named deliverables, owners, and dependency notes.',
    missingState: 'Without named deliverables, agents will invent their own interpretation of the opportunity.',
  },
  {
    id: 'asset-coverage',
    label: 'Asset coverage',
    stages: ['scoped', 'ready', 'active'],
    sourceOfTruth: 'mira',
    detail: 'The asset register must show which required files, notes, or proofs exist and what is still missing.',
    missingState: 'Execution starts blind if missing inputs are not surfaced before the stage turns active.',
  },
  {
    id: 'phone-brief-coverage',
    label: 'Phone brief coverage',
    stages: ['ready', 'active', 'completed'],
    sourceOfTruth: 'aiButler',
    detail: 'aiButler needs enough CRM state to brief the operator on current stage, blockers, next action, and closure.',
    missingState: 'If the phone cannot explain the opportunity in one short brief, the slice is not yet operational.',
  },
  {
    id: 'orchestration-boundary',
    label: 'Orchestration boundary',
    stages: ['active', 'completed'],
    sourceOfTruth: 'paperclip',
    detail: 'Execution refs belong in Paperclip only as links to work, never as copied CRM records or reporting state.',
    missingState: 'If Paperclip starts carrying canonical opportunity fields, the CRM boundary has broken.',
  },
] as const

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)]
}

function uniqueLoci(loci: readonly MemoryPalaceLocus[]): MemoryPalaceLocus[] {
  const byId = new Map<string, MemoryPalaceLocus>()
  for (const locus of loci) {
    byId.set(locus.id, locus)
  }
  return [...byId.values()]
}

function stageLabels(stageIds: readonly OpportunityStageId[]): string {
  return stageIds.map((stageId) => `\`${stageId}\``).join(', ')
}

function systemLabels(systems: readonly SystemOwner[]): string {
  return systems.map((system) => `\`${system}\``).join(', ')
}

function formatWorkflowSpecContent(): string {
  const stageSections = CRM_OPPORTUNITY_STAGE_FLOW.map((stage, index) => {
    return [
      `## ${index + 1}. ${stage.label}`,
      `- id: \`${stage.id}\``,
      `- source_of_truth: \`${stage.sourceOfTruth}\``,
      `- objective: ${stage.objective}`,
      '- entry_signals:',
      ...stage.entrySignals.map((signal) => `  - ${signal}`),
      '- required_evidence:',
      ...stage.requiredEvidence.map((evidence) => `  - ${evidence}`),
      '- exit_criteria:',
      ...stage.exitCriteria.map((criterion) => `  - ${criterion}`),
    ].join('\n')
  })

  const deliverableSections = CRM_OPPORTUNITY_DELIVERABLES.map((deliverable) => {
    return [
      `## ${deliverable.label}`,
      `- id: \`${deliverable.id}\``,
      `- required_by_stage: \`${deliverable.requiredByStage}\``,
      `- source_of_truth: \`${deliverable.sourceOfTruth}\``,
      `- sync_policy: \`${deliverable.syncPolicy}\``,
      `- summary: ${deliverable.summary}`,
      `- completion_evidence: ${deliverable.completionEvidence}`,
    ].join('\n')
  })

  return [
    '# Generic CRM Opportunity Workflow Spec',
    '',
    '## System boundaries',
    '- `mira` is the canonical source of truth for opportunity stage, deliverables, asset status, outreach context, and reporting-ready outcomes.',
    '- `aiButler` owns the user-facing runtime, phone briefing, and execution prompts derived from Mira state.',
    '- `paperclip` orchestrates issues, staffing, and runs by reference only; it does not become the CRM database.',
    '- `dewdrops` projects the opportunity lane into room artifacts, anchors, and memory-ready review surfaces.',
    '',
    '## Stage flow',
    ...stageSections,
    '',
    '## Required deliverables by stage',
    ...deliverableSections,
  ].join('\n')
}

function formatModulePlanContent(): string {
  const sliceSections = CRM_OPPORTUNITY_MODULE_PLAN.map((slice) => {
    return [
      `## ${slice.label}`,
      `- id: \`${slice.id}\``,
      `- trigger: ${slice.trigger}`,
      `- systems: ${systemLabels(slice.systems)}`,
      '- outputs:',
      ...slice.outputs.map((output) => `  - ${output}`),
      `- note: ${slice.note}`,
    ].join('\n')
  })

  return [
    '# Generic CRM Opportunity Module Plan',
    '',
    'This plan keeps the slice vertical: start from a user request on the phone, land canonical CRM state in Mira, run execution through Paperclip by reference, and return a useful phone briefing or outcome.',
    '',
    ...sliceSections,
  ].join('\n')
}

function formatReadinessArtifactContent(): string {
  const gateSections = CRM_OPPORTUNITY_READINESS_GATES.map((gate) => {
    return [
      `## ${gate.label}`,
      `- id: \`${gate.id}\``,
      `- stages: ${stageLabels(gate.stages)}`,
      `- source_of_truth: \`${gate.sourceOfTruth}\``,
      `- detail: ${gate.detail}`,
      `- missing_state: ${gate.missingState}`,
    ].join('\n')
  })

  return [
    '# Generic CRM Opportunity Readiness Artifact',
    '',
    'Readiness is not a boolean. These gates make the room prove whether an opportunity is actually ready to move to the next stage.',
    '',
    ...gateSections,
  ].join('\n')
}

function formatPassReportContent(): string {
  return [
    '# Opportunities Room Live Brief-Engine Pass',
    '',
    'This pass defines the smallest generic CRM opportunity lane that can start with a phone request and end with a CRM-aware action or completion briefing.',
    '',
    '## Outcome',
    '- Locked a six-stage opportunity flow from intake through completion.',
    '- Named the required deliverables and evidence for each active stage.',
    '- Kept Mira as the CRM source of truth, aiButler as the runtime, DewDrops as the room projection, and Paperclip as orchestration only.',
    '',
    '## Deliverables',
    '- Opportunity workflow spec',
    '- Opportunity module plan',
    '- Opportunity readiness artifact',
  ].join('\n')
}

function buildOpportunityArtifacts(): RunArtifact[] {
  return [
    {
      id: 'artifact-crm-opportunities-pass-report',
      runId: OPPORTUNITY_PASS_RUN_ID,
      kind: 'report',
      title: 'Opportunities room brief pass report',
      summary: 'First-pass outcome for the generic CRM opportunities lane and system-boundary decisions.',
      content: formatPassReportContent(),
      createdAt: OPPORTUNITY_PASS_COMPLETED_AT,
      status: 'provisional',
    },
    {
      id: 'artifact-crm-opportunity-workflow-spec',
      runId: OPPORTUNITY_PASS_RUN_ID,
      kind: 'note',
      title: 'Opportunity workflow spec',
      summary: 'Stage flow and required deliverables for generic CRM opportunities from intake through completion.',
      content: formatWorkflowSpecContent(),
      createdAt: OPPORTUNITY_PASS_COMPLETED_AT,
      status: 'provisional',
    },
    {
      id: 'artifact-crm-opportunity-module-plan',
      runId: OPPORTUNITY_PASS_RUN_ID,
      kind: 'plan',
      title: 'Opportunity module plan',
      summary: 'Vertical slices that keep Mira canonical while aiButler, Paperclip, and DewDrops play their bounded roles.',
      content: formatModulePlanContent(),
      createdAt: OPPORTUNITY_PASS_COMPLETED_AT,
      status: 'provisional',
    },
    {
      id: 'artifact-crm-opportunity-readiness',
      runId: OPPORTUNITY_PASS_RUN_ID,
      kind: 'note',
      title: 'Opportunity readiness artifact',
      summary: 'Readiness gates that prove whether an active opportunity is actually ready to advance.',
      content: formatReadinessArtifactContent(),
      createdAt: OPPORTUNITY_PASS_COMPLETED_AT,
      status: 'provisional',
    },
  ]
}

function buildOpportunitySelfEvaluation(): SelfEvaluation {
  return {
    alignmentSummary:
      'Defined the generic CRM opportunity lane, attached stage-specific deliverables and readiness gates, and kept canonical CRM state in Mira instead of drifting into Paperclip or the runtime.',
    criteriaChecks: [
      {
        criterionId: 'crm-opportunities-stage-flow',
        met: true,
        evidence:
          'The Opportunity workflow spec artifact defines intake, qualified, scoped, ready, active, and completed stages with required evidence and exit criteria.',
        confidence: 'high',
      },
      {
        criterionId: 'crm-opportunities-deliverables',
        met: true,
        evidence:
          'The Opportunity workflow spec and readiness artifact enumerate the deliverables, evidence, and readiness gates required for each active opportunity stage.',
        confidence: 'high',
      },
    ],
    allCriteriaMet: true,
    criteriaCovered: ['crm-opportunities-stage-flow', 'crm-opportunities-deliverables'],
    criteriaRemaining: [],
    nextAction: null,
    escalationReason: null,
    assumptions: [
      'Mira can store opportunity-stage state, deliverable definitions, asset status, and completion notes without requiring a new CRM database inside Paperclip.',
      'aiButler derives phone-facing briefings and next actions from Mira state rather than becoming a second canonical opportunity store.',
      'The first pass stops at workflow, readiness, and projection artifacts; long-term nurture automation and cross-workspace analytics remain out of scope.',
    ],
    handoffNotes: [
      'dec:locked the opportunity slice around a phone-to-Mira intake, a Mira-owned workflow lane, and Paperclip reference-only execution refs.',
      'why:that is the smallest end-to-end path that proves the phone CRM direction without splitting canonical state across systems.',
      'rej:rejected putting opportunity stage or reporting truth into Paperclip, and skipped broader pipeline analytics or relationship graph redesign.',
      'watch:revisit the slice if Mira cannot hold the asset register or if aiButler needs more than a derived phone brief to execute reliably.',
    ].join('\n'),
  }
}

function buildOpportunityRun(card: WorkflowCard): RunLedgerEntry {
  const briefPacket = compileBriefPacket(card, card.butlerRoomId ?? card.id)

  return {
    runId: OPPORTUNITY_PASS_RUN_ID,
    contractId: OPPORTUNITY_PASS_CONTRACT_ID,
    roomId: card.butlerRoomId ?? card.id,
    title: OPPORTUNITY_PASS_TITLE,
    status: 'completed',
    startedAt: OPPORTUNITY_PASS_STARTED_AT,
    completedAt: OPPORTUNITY_PASS_COMPLETED_AT,
    artifacts: buildOpportunityArtifacts(),
    briefSpecId: card.briefSpec?.id,
    briefVersion: briefPacket?.briefVersion,
    briefHash: briefPacket?.briefHash,
    selfEvaluation: buildOpportunitySelfEvaluation(),
    continuationDecision: 'complete',
  }
}

export function applyCrmOpportunitiesBriefPass(card: WorkflowCard): WorkflowCard {
  return {
    ...card,
    memoryAnchors: unique([...(card.memoryAnchors ?? []), ...OPPORTUNITY_ARTIFACT_ANCHORS]),
    memoryPalaceLoci: uniqueLoci([...(card.memoryPalaceLoci ?? []), ...OPPORTUNITY_MEMORY_LOCI]),
    runLedger: [buildOpportunityRun(card)],
  }
}
