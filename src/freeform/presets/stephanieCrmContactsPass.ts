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
type ContactEntityKind = 'person' | 'household' | 'vendor' | 'referral_partner'
type FieldType =
  | 'string'
  | 'enum'
  | 'date'
  | 'string[]'
  | 'reference'
  | 'reference[]'
  | 'object'

type ContactEntityDefinition = {
  kind: ContactEntityKind
  label: string
  purpose: string
  sourceOfTruth: SystemOwner
  requiredFields: string[]
  contextFields: string[]
}

type ContactRelationshipDefinition = {
  from: ContactEntityKind
  relation: string
  to: ContactEntityKind | 'person|household'
  cardinality: string
  sourceOfTruth: SystemOwner
  note: string
}

type ContactFieldDefinition = {
  key: string
  label: string
  appliesTo: ContactEntityKind[]
  type: FieldType
  sourceOfTruth: SystemOwner
  syncPolicy: SyncPolicy
  description: string
}

const CONTACT_PASS_RUN_ID = 'run-stephanie-contacts-brief-pass-1'
const CONTACT_PASS_CONTRACT_ID = 'contract-stephanie-contacts-brief-pass-1'
const CONTACT_PASS_TITLE = 'Contacts room live brief-engine pass'
const CONTACT_PASS_STARTED_AT = '2026-04-18T19:00:00.000Z'
const CONTACT_PASS_COMPLETED_AT = '2026-04-18T19:18:00.000Z'

const CONTACT_ARTIFACT_ANCHORS = [
  'artifact/stephanie-crm/contact-schema',
  'artifact/stephanie-crm/relationship-map',
  'artifact/stephanie-crm/field-dictionary',
] as const

const CONTACT_MEMORY_LOCI: readonly MemoryPalaceLocus[] = [
  {
    id: 'stephanie-contacts-north-star',
    title: 'Relationship Memory Arch',
    kind: 'north_star',
    detail: 'Keep Stephanie oriented around who matters, what stage they are in, and what changed recently.',
  },
  {
    id: 'stephanie-contacts-room',
    title: 'Contacts Room Floor',
    kind: 'room',
    detail: 'Canonical DewDrops room for Stephanie CRM contact structure and relationship memory.',
  },
  {
    id: 'stephanie-contacts-schema',
    title: 'Schema Binder',
    kind: 'artifact',
    detail: 'artifact/stephanie-crm/contact-schema',
  },
  {
    id: 'stephanie-contacts-relationships',
    title: 'Relationship Wall',
    kind: 'artifact',
    detail: 'artifact/stephanie-crm/relationship-map',
  },
  {
    id: 'stephanie-contacts-field-dict',
    title: 'Field Index Compartment',
    kind: 'artifact',
    detail: 'artifact/stephanie-crm/field-dictionary',
  },
  {
    id: 'stephanie-contacts-phone-brief',
    title: 'Phone Brief Portal',
    kind: 'portal',
    detail: 'aiButler/phone-briefing/contacts',
  },
] as const

export const STEPHANIE_CONTACTS_ENTITY_MODEL: readonly ContactEntityDefinition[] = [
  {
    kind: 'person',
    label: 'Person',
    purpose: 'A human contact Stephanie may call, text, brief, or place inside a shared household context.',
    sourceOfTruth: 'mira',
    requiredFields: ['entity_type', 'mira_record_id', 'display_name', 'relationship_stage'],
    contextFields: [
      'role_tags',
      'household_id',
      'communication_preferences',
      'last_interaction_summary',
      'ai_butler_phone_brief',
    ],
  },
  {
    kind: 'household',
    label: 'Household',
    purpose: 'A buying, selling, or sphere unit that groups decision-makers, preferences, and shared timing context.',
    sourceOfTruth: 'mira',
    requiredFields: ['entity_type', 'mira_record_id', 'display_name', 'household_member_ids', 'relationship_stage'],
    contextFields: [
      'preference_notes',
      'trusted_vendor_ids',
      'recent_interaction_refs',
      'open_loops',
      'ai_butler_phone_brief',
    ],
  },
  {
    kind: 'vendor',
    label: 'Vendor',
    purpose: 'A service partner Stephanie may activate for client support, listing prep, or transaction help.',
    sourceOfTruth: 'mira',
    requiredFields: ['entity_type', 'mira_record_id', 'display_name', 'role_tags'],
    contextFields: [
      'communication_preferences',
      'preference_notes',
      'last_interaction_at',
      'last_interaction_summary',
      'ai_butler_phone_brief',
    ],
  },
  {
    kind: 'referral_partner',
    label: 'Referral Partner',
    purpose: 'A person or business that sends Stephanie leads or receives outbound introductions from her network.',
    sourceOfTruth: 'mira',
    requiredFields: ['entity_type', 'mira_record_id', 'display_name', 'relationship_stage'],
    contextFields: [
      'role_tags',
      'preference_notes',
      'last_interaction_summary',
      'recent_interaction_refs',
      'ai_butler_phone_brief',
    ],
  },
] as const

export const STEPHANIE_CONTACTS_RELATIONSHIP_MAP: readonly ContactRelationshipDefinition[] = [
  {
    from: 'household',
    relation: 'has_member',
    to: 'person',
    cardinality: '1:n',
    sourceOfTruth: 'mira',
    note: 'Use households to preserve spouse, family, or co-decision context instead of flattening everyone into isolated rows.',
  },
  {
    from: 'person',
    relation: 'member_of',
    to: 'household',
    cardinality: 'n:1',
    sourceOfTruth: 'mira',
    note: 'A person can point back to the shared household record that carries stage, preferences, and open loops.',
  },
  {
    from: 'person',
    relation: 'referred_by',
    to: 'referral_partner',
    cardinality: '0:1',
    sourceOfTruth: 'mira',
    note: 'Track who introduced the contact so future outreach and reporting stay attribution-aware.',
  },
  {
    from: 'referral_partner',
    relation: 'introduces',
    to: 'person|household',
    cardinality: '1:n',
    sourceOfTruth: 'mira',
    note: 'Referral partners can introduce either a single person or an entire household opportunity.',
  },
  {
    from: 'household',
    relation: 'served_by',
    to: 'vendor',
    cardinality: 'm:n',
    sourceOfTruth: 'mira',
    note: 'Keep trusted vendors connected to the household context so phone briefings can recommend the right partner quickly.',
  },
  {
    from: 'vendor',
    relation: 'supports',
    to: 'person|household',
    cardinality: 'm:n',
    sourceOfTruth: 'mira',
    note: 'Vendor relationships should remain CRM-aware without dragging listing workflow state into the Contacts room.',
  },
] as const

export const STEPHANIE_CONTACTS_FIELD_DICTIONARY: readonly ContactFieldDefinition[] = [
  {
    key: 'entity_type',
    label: 'Entity type',
    appliesTo: ['person', 'household', 'vendor', 'referral_partner'],
    type: 'enum',
    sourceOfTruth: 'mira',
    syncPolicy: 'canonical',
    description: 'Canonical entity discriminator: person, household, vendor, or referral_partner.',
  },
  {
    key: 'mira_record_id',
    label: 'Mira record ID',
    appliesTo: ['person', 'household', 'vendor', 'referral_partner'],
    type: 'string',
    sourceOfTruth: 'mira',
    syncPolicy: 'canonical',
    description: 'Stable CRM identifier. DewDrops and Paperclip keep this by reference only.',
  },
  {
    key: 'display_name',
    label: 'Display name',
    appliesTo: ['person', 'household', 'vendor', 'referral_partner'],
    type: 'string',
    sourceOfTruth: 'mira',
    syncPolicy: 'canonical',
    description: 'Primary human-facing label used in briefings, search results, and phone prompts.',
  },
  {
    key: 'relationship_stage',
    label: 'Relationship stage',
    appliesTo: ['person', 'household', 'referral_partner'],
    type: 'enum',
    sourceOfTruth: 'mira',
    syncPolicy: 'canonical',
    description: 'Current stage such as new lead, active client, past client, sphere, or dormant referral source.',
  },
  {
    key: 'role_tags',
    label: 'Role tags',
    appliesTo: ['person', 'vendor', 'referral_partner'],
    type: 'string[]',
    sourceOfTruth: 'mira',
    syncPolicy: 'canonical',
    description: 'Short tags like buyer, seller, spouse, stager, lawyer, lender, or past-client advocate.',
  },
  {
    key: 'household_id',
    label: 'Household ID',
    appliesTo: ['person'],
    type: 'reference',
    sourceOfTruth: 'mira',
    syncPolicy: 'canonical',
    description: 'Reference from a person to the household that owns shared stage, preference, and timing context.',
  },
  {
    key: 'household_member_ids',
    label: 'Household member IDs',
    appliesTo: ['household'],
    type: 'reference[]',
    sourceOfTruth: 'mira',
    syncPolicy: 'canonical',
    description: 'Member person records for the household decision unit.',
  },
  {
    key: 'referral_partner_id',
    label: 'Referral partner ID',
    appliesTo: ['person', 'household'],
    type: 'reference',
    sourceOfTruth: 'mira',
    syncPolicy: 'canonical',
    description: 'Who introduced the contact or household into Stephanie CRM.',
  },
  {
    key: 'trusted_vendor_ids',
    label: 'Trusted vendor IDs',
    appliesTo: ['household'],
    type: 'reference[]',
    sourceOfTruth: 'mira',
    syncPolicy: 'canonical',
    description: 'Preferred vendors already trusted for this household relationship.',
  },
  {
    key: 'communication_preferences',
    label: 'Communication preferences',
    appliesTo: ['person', 'household', 'vendor'],
    type: 'object',
    sourceOfTruth: 'mira',
    syncPolicy: 'canonical',
    description: 'Preferred channel, timing windows, tone, and opt-in context for outreach.',
  },
  {
    key: 'preference_notes',
    label: 'Preference notes',
    appliesTo: ['household', 'vendor', 'referral_partner'],
    type: 'string',
    sourceOfTruth: 'mira',
    syncPolicy: 'canonical',
    description: 'Freeform notes for neighborhoods, service style, referral fit, or other relationship-specific preferences.',
  },
  {
    key: 'last_interaction_at',
    label: 'Last interaction at',
    appliesTo: ['person', 'household', 'vendor', 'referral_partner'],
    type: 'date',
    sourceOfTruth: 'mira',
    syncPolicy: 'canonical',
    description: 'Most recent logged touchpoint used for recency and reporting.',
  },
  {
    key: 'last_interaction_summary',
    label: 'Last interaction summary',
    appliesTo: ['person', 'household', 'vendor', 'referral_partner'],
    type: 'string',
    sourceOfTruth: 'mira',
    syncPolicy: 'canonical',
    description: 'The most recent meaningful contact summary future agents should read first.',
  },
  {
    key: 'recent_interaction_refs',
    label: 'Recent interaction refs',
    appliesTo: ['household', 'vendor', 'referral_partner'],
    type: 'reference[]',
    sourceOfTruth: 'mira',
    syncPolicy: 'canonical',
    description: 'Pointers to the last relevant interactions or reports so aiButler can brief without re-discovery.',
  },
  {
    key: 'ai_butler_phone_brief',
    label: 'aiButler phone brief',
    appliesTo: ['person', 'household', 'vendor', 'referral_partner'],
    type: 'string',
    sourceOfTruth: 'aiButler',
    syncPolicy: 'derived',
    description: 'A concise voice-and-phone briefing derived from Mira context for live execution on the user-facing runtime.',
  },
  {
    key: 'open_loops',
    label: 'Open loops',
    appliesTo: ['household'],
    type: 'string[]',
    sourceOfTruth: 'aiButler',
    syncPolicy: 'derived',
    description: 'Short unresolved follow-ups or unanswered questions carried into the next briefing.',
  },
  {
    key: 'paperclip_execution_refs',
    label: 'Paperclip execution refs',
    appliesTo: ['person', 'household', 'vendor', 'referral_partner'],
    type: 'reference[]',
    sourceOfTruth: 'paperclip',
    syncPolicy: 'reference-only',
    description: 'Optional issue or run links for orchestration only. Paperclip does not store canonical CRM contact state.',
  },
  {
    key: 'dewdrops_memory_anchor_refs',
    label: 'DewDrops memory anchor refs',
    appliesTo: ['person', 'household', 'vendor', 'referral_partner'],
    type: 'reference[]',
    sourceOfTruth: 'dewdrops',
    syncPolicy: 'reference-only',
    description: 'Room or artifact anchors used for spatial briefing and continuity in DewDrops.',
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

function formatFieldList(fields: readonly string[]): string {
  return fields.map((field) => `\`${field}\``).join(', ')
}

function formatAppliesTo(kinds: readonly ContactEntityKind[]): string {
  return kinds.map((kind) => `\`${kind}\``).join(', ')
}

function formatEntityModelContent(): string {
  const sections = STEPHANIE_CONTACTS_ENTITY_MODEL.map((entity) => {
    return [
      `## ${entity.label}`,
      `- kind: \`${entity.kind}\``,
      `- source_of_truth: \`${entity.sourceOfTruth}\``,
      `- purpose: ${entity.purpose}`,
      `- required_fields: ${formatFieldList(entity.requiredFields)}`,
      `- context_fields: ${formatFieldList(entity.contextFields)}`,
    ].join('\n')
  })

  return [
    '# Stephanie CRM Contacts Schema',
    '',
    '## System boundaries',
    '- `mira` is the canonical source of truth for contact identity, relationship edges, outreach context, and reporting-ready interaction history.',
    '- `aiButler` owns the phone/runtime briefing layer and derives compact execution context from Mira without becoming a second CRM.',
    '- `paperclip` stores issue/run references only. It does not own person, household, vendor, or referral records.',
    '- `dewdrops` stores room briefs, spatial anchors, and operator-facing projections of the contact model.',
    '',
    ...sections,
    '',
    '## Conversation memory hooks',
    '- `ai_butler_phone_brief` gives the phone runtime a short pre-call briefing.',
    '- `recent_interaction_refs` points back to Mira activity so future agents can reuse recent context.',
    '- `paperclip_execution_refs` links orchestration work without copying CRM data into Paperclip.',
  ].join('\n')
}

function formatRelationshipMapContent(): string {
  const rows = STEPHANIE_CONTACTS_RELATIONSHIP_MAP.map((edge) =>
    [
      `## ${edge.from} ${edge.relation} ${edge.to}`,
      `- cardinality: ${edge.cardinality}`,
      `- source_of_truth: \`${edge.sourceOfTruth}\``,
      `- note: ${edge.note}`,
    ].join('\n'),
  )

  return ['# Stephanie CRM Relationship Map', '', ...rows].join('\n')
}

function formatFieldDictionaryContent(): string {
  const rows = STEPHANIE_CONTACTS_FIELD_DICTIONARY.map((field) =>
    [
      `## ${field.label}`,
      `- key: \`${field.key}\``,
      `- applies_to: ${formatAppliesTo(field.appliesTo)}`,
      `- type: \`${field.type}\``,
      `- source_of_truth: \`${field.sourceOfTruth}\``,
      `- sync_policy: \`${field.syncPolicy}\``,
      `- description: ${field.description}`,
    ].join('\n'),
  )

  return ['# Stephanie CRM Field Dictionary', '', ...rows].join('\n')
}

function formatPassReportContent(): string {
  return [
    '# Contacts Room Live Brief-Engine Pass',
    '',
    'This first pass locks the smallest useful CRM relationship-memory slice for Stephanie CRM.',
    '',
    '## Outcome',
    '- Identified the canonical core entities: person, household, vendor, and referral_partner.',
    '- Preserved meaningful operating context with stage, preferences, last interaction, recent interaction refs, and aiButler briefing hooks.',
    '- Kept the runtime/storage boundary clean: Mira owns CRM truth, aiButler owns phone execution, DewDrops owns room projection, and Paperclip remains orchestration-only.',
    '',
    '## Deliverables',
    '- Contact schema artifact',
    '- Relationship map artifact',
    '- Field dictionary artifact',
  ].join('\n')
}

function buildContactsArtifacts(): RunArtifact[] {
  return [
    {
      id: 'artifact-stephanie-contacts-pass-report',
      runId: CONTACT_PASS_RUN_ID,
      kind: 'report',
      title: 'Contacts room brief pass report',
      summary: 'First-pass Contacts room outcome with storage boundaries and deliverable index.',
      content: formatPassReportContent(),
      createdAt: CONTACT_PASS_COMPLETED_AT,
      status: 'provisional',
    },
    {
      id: 'artifact-stephanie-contact-schema',
      runId: CONTACT_PASS_RUN_ID,
      kind: 'note',
      title: 'Contact schema',
      summary: 'Entity model for person, household, vendor, and referral_partner records.',
      content: formatEntityModelContent(),
      createdAt: CONTACT_PASS_COMPLETED_AT,
      status: 'provisional',
    },
    {
      id: 'artifact-stephanie-relationship-map',
      runId: CONTACT_PASS_RUN_ID,
      kind: 'note',
      title: 'Relationship map',
      summary: 'Canonical contact-room edges between people, households, vendors, and referral partners.',
      content: formatRelationshipMapContent(),
      createdAt: CONTACT_PASS_COMPLETED_AT,
      status: 'provisional',
    },
    {
      id: 'artifact-stephanie-field-dictionary',
      runId: CONTACT_PASS_RUN_ID,
      kind: 'note',
      title: 'Field dictionary',
      summary: 'Contact context and memory-hook fields with source-of-truth and sync-policy ownership.',
      content: formatFieldDictionaryContent(),
      createdAt: CONTACT_PASS_COMPLETED_AT,
      status: 'provisional',
    },
  ]
}

function buildContactsSelfEvaluation(): SelfEvaluation {
  return {
    alignmentSummary:
      'Defined the first Contacts-room schema slice, mapped core Stephanie CRM relationship entities, and preserved phone-usable context without making Paperclip a CRM store.',
    criteriaChecks: [
      {
        criterionId: 'contacts-core-entities',
        met: true,
        evidence:
          'The Contact schema and Relationship map artifacts enumerate person, household, vendor, and referral_partner entities plus their core edges.',
        confidence: 'high',
      },
      {
        criterionId: 'contacts-context-capture',
        met: true,
        evidence:
          'The Field dictionary captures relationship_stage, communication_preferences, preference_notes, last_interaction_summary, recent_interaction_refs, open_loops, and ai_butler_phone_brief hooks.',
        confidence: 'high',
      },
    ],
    allCriteriaMet: true,
    criteriaCovered: ['contacts-core-entities', 'contacts-context-capture'],
    criteriaRemaining: [],
    nextAction: null,
    escalationReason: null,
    assumptions: [
      'Mira remains the canonical store for all CRM records and relationship edges; DewDrops and Paperclip only carry references or projections of that data.',
      'aiButler owns phone-first briefing fields as derived runtime context instead of storing a separate canonical contact database.',
      'Organization-level entities and listing-specific workflow state stay out of this first pass because the brief scopes the slice to contacts and relationship memory only.',
    ],
    handoffNotes: [
      'dec:Locked the first Contacts-room pass around Mira-owned entities plus aiButler-derived phone briefing hooks.',
      'why:This preserves one CRM source of truth while still giving the phone runtime enough context to act without re-discovery.',
      'rej:Rejected putting canonical contact or outreach state into Paperclip, and skipped listing/task fields that belong in later CRM rooms.',
      'watch:Revisit the model if Mira cannot represent household membership or referral/vendor edges cleanly enough for reporting and phone brief generation.',
    ].join('\n'),
  }
}

function buildContactsRun(card: WorkflowCard): RunLedgerEntry {
  const briefPacket = compileBriefPacket(card, card.butlerRoomId ?? card.id)

  return {
    runId: CONTACT_PASS_RUN_ID,
    contractId: CONTACT_PASS_CONTRACT_ID,
    roomId: card.butlerRoomId ?? card.id,
    title: CONTACT_PASS_TITLE,
    status: 'completed',
    startedAt: CONTACT_PASS_STARTED_AT,
    completedAt: CONTACT_PASS_COMPLETED_AT,
    artifacts: buildContactsArtifacts(),
    briefSpecId: card.briefSpec?.id,
    briefVersion: briefPacket?.briefVersion,
    briefHash: briefPacket?.briefHash,
    selfEvaluation: buildContactsSelfEvaluation(),
    continuationDecision: 'complete',
  }
}

export function applyStephanieContactsBriefPass(card: WorkflowCard): WorkflowCard {
  return {
    ...card,
    memoryAnchors: unique([...(card.memoryAnchors ?? []), ...CONTACT_ARTIFACT_ANCHORS]),
    memoryPalaceLoci: uniqueLoci([...(card.memoryPalaceLoci ?? []), ...CONTACT_MEMORY_LOCI]),
    runLedger: [buildContactsRun(card)],
  }
}
