import type { BriefSpec } from '../briefSpec'
import type { BoardWire, ButlerLaunchSurface, SwarmTemplate, WorkflowCard } from '../types'
import { applyCrmOpportunitiesBriefPass } from './crmOpportunitiesPass'

type CrmRoomSeed = {
  id: string
  title: string
  x: number
  y: number
  color: string
  swarmTemplate: SwarmTemplate
  launchSurface: ButlerLaunchSurface
  capabilityPackId: string
  capabilityProfileId: string
  swarmRecipeId: string
  memoryRoom: string
  memoryContextSummary: string
  mission: string
  phoneRelayBrief: string
  desktopSessionBrief: string
  brief: Omit<BriefSpec, 'id' | 'capabilityProfileId' | 'swarmRecipeId'>
}

type BoardPreset = {
  cards: WorkflowCard[]
  wires: BoardWire[]
}

function roomBrief(seed: CrmRoomSeed): BriefSpec {
  return {
    id: `${seed.id}-brief`,
    capabilityProfileId: seed.capabilityProfileId,
    swarmRecipeId: seed.swarmRecipeId,
    ...seed.brief,
  }
}

function problemRoom(seed: CrmRoomSeed): WorkflowCard {
  const card: WorkflowCard = {
    id: seed.id,
    x: seed.x,
    y: seed.y,
    width: 360,
    height: 252,
    title: seed.title,
    expanded: true,
    color: seed.color,
    kind: 'problem',
    problemShape: 'panel',
    swarmTemplate: seed.swarmTemplate,
    preferredLaunchSurface: seed.launchSurface,
    capabilityPackId: seed.capabilityPackId,
    capabilityProfileId: seed.capabilityProfileId,
    swarmRecipeId: seed.swarmRecipeId,
    briefSpec: roomBrief(seed),
    briefVersion: 1,
    briefLocked: true,
    memoryWing: 'crm',
    memoryRoom: seed.memoryRoom,
    memoryContextSummary: seed.memoryContextSummary,
    memoryAnchors: [
      'wing/crm',
      `room/crm/${seed.memoryRoom}`,
      'entity/crm/operator',
    ],
    phoneRelayBrief: seed.phoneRelayBrief,
    desktopSessionBrief: seed.desktopSessionBrief,
    mission: seed.mission,
    openQuestions: [],
  }

  if (seed.id === 'crm-opportunities') {
    return applyCrmOpportunitiesBriefPass(card)
  }

  return card
}

const CRM_ROOM_SEEDS: readonly CrmRoomSeed[] = [
  {
    id: 'crm-contacts',
    title: 'Contacts',
    x: -470,
    y: -170,
    color: '#4ecdc4',
    swarmTemplate: 'relationship',
    launchSurface: 'hybrid',
    capabilityPackId: 'relationship-memory',
    capabilityProfileId: 'research-standard',
    swarmRecipeId: 'relationship-map',
    memoryRoom: 'contacts',
    memoryContextSummary:
      'Canonical relationship room for people, companies, partners, and shared context that every other CRM room depends on.',
    mission: [
      'Build the relationship memory layer for the CRM.',
      'This room should make every contact, organization, and partner legible enough that future agents can act without rediscovering who matters and why.',
    ].join('\n\n'),
    phoneRelayBrief:
      'Capture contact updates, note relationship changes, and surface a phone-ready brief; escalate only for contradictions in identity, ownership, or intent.',
    desktopSessionBrief:
      'Model people, organizations, and relationship context so the rest of the CRM can trust the memory layer.',
    brief: {
      creative: {
        mission: 'Give the operator a calm relationship memory for every person, company, and partner in the CRM.',
        beneficiary:
          'The operator needs fast recall on people, context, and trust signals without losing continuity between conversations.',
        audience: 'Operators and assistant agents coordinating outreach, delivery, and follow-through.',
        references: [
          {
            label: 'Warm introductions',
            ref: 'room/phone-relay',
            note: 'Good references feel personal and context-rich instead of flattened into generic rows.',
            polarity: 'good',
          },
          {
            label: 'Spreadsheet overload',
            ref: 'anti-pattern/tabular-crm',
            note: 'Bad references bury relationships in columns and make follow-up feel mechanical.',
            polarity: 'bad',
          },
        ],
        tone: 'Trustworthy, low-friction, and relationship-first.',
      },
      execution: {
        task: 'Define the contact and relationship model for the CRM.',
        acceptanceCriteria: [
          {
            id: 'crm-contacts-core-entities',
            description: 'The room identifies core person, company, and partner entities.',
            verificationHint: 'The relationship map or schema lists the canonical entity types and key fields.',
          },
          {
            id: 'crm-contacts-context-capture',
            description: 'The room preserves meaningful context such as stage, preferences, and recent interactions.',
            verificationHint: 'Artifacts show a structured summary of reusable relationship context.',
          },
        ],
        scope: {
          in: ['Entity model', 'Relationship map', 'Context fields', 'Conversation memory hooks'],
          out: ['Outbound automation', 'Opportunity execution', 'Calendar and scheduling systems'],
        },
        antiPatterns: [
          'Flattening every relationship into a single contact table with no company or partner structure',
          'Forcing the operator to restate context that the system should already remember',
        ],
        deliverables: ['Contact schema', 'Relationship map', 'Field dictionary'],
        milestone: 'CRM foundation',
        dependsOn: [],
        blockedBy: [],
        effortHint: '1 focused design/build pass',
      },
      escalationPolicy: 'outcome-contradiction-only',
      autonomyPolicy: 'full-auto',
      projectId: 'crm',
    },
  },
  {
    id: 'crm-opportunities',
    title: 'Opportunities',
    x: 90,
    y: -170,
    color: '#5e60ce',
    swarmTemplate: 'build',
    launchSurface: 'desktop',
    capabilityPackId: 'delivery-builder',
    capabilityProfileId: 'build-local',
    swarmRecipeId: 'build-review-ship',
    memoryRoom: 'opportunities',
    memoryContextSummary:
      'Execution room for opportunities, delivery states, assets, and readiness across the active book of business.',
    mission: [
      'Turn active opportunities into a repeatable build lane.',
      'Agents should be able to assemble the required work, evidence, and state transitions without asking the human to micromanage every step.',
    ].join('\n\n'),
    phoneRelayBrief:
      'Capture opportunity changes from the field, note blockers, and hand status changes into the room with the right context.',
    desktopSessionBrief:
      'Implement the opportunity workflow, deliverables, and readiness artifacts for the CRM.',
    brief: {
      creative: {
        mission: 'Make opportunity work feel like a controlled production line instead of an ad hoc scramble.',
        beneficiary:
          'The operator needs every opportunity to move from qualification to completion with fewer dropped details and clearer readiness.',
        audience: 'Operators plus builder and reviewer agents working on active opportunities.',
        references: [
          {
            label: 'Readiness checklist',
            ref: 'artifact/opportunity-readiness-checklist',
            note: 'Good references make readiness visible and leave little ambiguity about what remains.',
            polarity: 'good',
          },
          {
            label: 'Loose folder chaos',
            ref: 'anti-pattern/random-drive-folders',
            note: 'Bad references scatter assets across unnamed folders and leave state implicit.',
            polarity: 'bad',
          },
        ],
        tone: 'Production-grade, explicit, and ready to verify.',
      },
      execution: {
        task: 'Design and build the opportunity workflow module for the CRM.',
        acceptanceCriteria: [
          {
            id: 'crm-opportunities-stage-flow',
            description: 'The room defines or implements a clear opportunity stage flow from qualification through completion.',
            verificationHint: 'Artifacts or code show stages, transitions, and readiness checks.',
          },
          {
            id: 'crm-opportunities-deliverables',
            description: 'The room tracks required deliverables, evidence, or outputs for each active opportunity.',
            verificationHint: 'Opportunity records or specs include explicit deliverables and completion states.',
          },
        ],
        scope: {
          in: ['Opportunity intake', 'Asset tracking', 'Stage flow', 'Readiness'],
          out: ['Relationship graph redesign', 'Cross-workspace analytics', 'Long-term nurture automation'],
        },
        antiPatterns: [
          'Treating readiness as a single boolean with no intermediate evidence',
          'Relying on the human to manually reconcile scattered files before work can advance',
        ],
        deliverables: ['Opportunity workflow spec', 'Opportunity module plan', 'Readiness artifact'],
        milestone: 'Opportunity module',
        dependsOn: ['crm-contacts'],
        blockedBy: [],
        effortHint: '2 focused build passes',
      },
      escalationPolicy: 'outcome-contradiction-only',
      autonomyPolicy: 'milestone-checkpoint',
      projectId: 'crm',
    },
  },
  {
    id: 'crm-pipeline',
    title: 'Pipeline',
    x: -190,
    y: 210,
    color: '#ff9f1c',
    swarmTemplate: 'planning',
    launchSurface: 'desktop',
    capabilityPackId: 'operations-audit',
    capabilityProfileId: 'ops-diagnostic',
    swarmRecipeId: 'audit-report',
    memoryRoom: 'pipeline',
    memoryContextSummary:
      'Operating room for stages, dependencies, dashboard clarity, and bottleneck visibility across the CRM.',
    mission: [
      'Make the CRM legible as a flowing pipeline, not a pile of disconnected work.',
      'This room should tell agents what is moving, what is blocked, and what must happen next.',
    ].join('\n\n'),
    phoneRelayBrief:
      'Capture changes in stage, urgency, and blockers; escalate only if the pipeline logic contradicts the room goals.',
    desktopSessionBrief:
      'Audit the cross-room workflow and define the canonical pipeline model, milestones, and dependencies.',
    brief: {
      creative: {
        mission: 'Give the operator one reliable view of active work, blocked work, and next moves.',
        beneficiary:
          'The operator needs the system to surface the true state of deals and tasks without requiring manual reconstruction.',
        audience: 'Operators and orchestration agents coordinating across CRM rooms.',
        references: [
          {
            label: 'Operator dashboard',
            ref: 'projection/run-monitor',
            note: 'Good references make bottlenecks and next actions obvious.',
            polarity: 'good',
          },
          {
            label: 'Status soup',
            ref: 'anti-pattern/ambiguous-pipeline',
            note: 'Bad references have too many overlapping states and no dependency clarity.',
            polarity: 'bad',
          },
        ],
        tone: 'Operationally crisp, explicit, and dependency-aware.',
      },
      execution: {
        task: 'Define the pipeline, milestones, and review surfaces for the CRM.',
        acceptanceCriteria: [
          {
            id: 'crm-pipeline-stage-model',
            description: 'The room establishes a stage model that can describe active, blocked, and completed work.',
            verificationHint: 'Artifacts define stages, transitions, and milestone checkpoints.',
          },
          {
            id: 'crm-pipeline-dependencies',
            description: 'The room describes how other CRM rooms feed into or depend on the pipeline.',
            verificationHint: 'Artifacts or graph output show room dependencies and cross-room visibility.',
          },
        ],
        scope: {
          in: ['Stage model', 'Milestones', 'Dependency map', 'Run monitoring'],
          out: ['Opportunity asset authoring', 'Direct outreach content', 'Contact normalization'],
        },
        antiPatterns: [
          'Multiple overlapping pipeline states with no decision rule for advancement',
          'Hidden blockers that only exist in chat history or a human head',
        ],
        deliverables: ['Pipeline map', 'Milestone definitions', 'Cross-room dependency notes'],
        milestone: 'Operations layer',
        dependsOn: ['crm-contacts', 'crm-opportunities'],
        blockedBy: [],
        effortHint: '1 audit + 1 refinement pass',
      },
      escalationPolicy: 'outcome-contradiction-only',
      autonomyPolicy: 'milestone-checkpoint',
      projectId: 'crm',
    },
  },
  {
    id: 'crm-followups',
    title: 'Follow-ups',
    x: 370,
    y: 210,
    color: '#ff6b6b',
    swarmTemplate: 'operator',
    launchSurface: 'hybrid',
    capabilityPackId: 'operator-relay-pack',
    capabilityProfileId: 'build-local',
    swarmRecipeId: 'operator-relay',
    memoryRoom: 'follow-ups',
    memoryContextSummary:
      'Relay room for follow-up cadences, reminders, templates, and operator-facing next actions.',
    mission: [
      'Translate CRM state into timely follow-up work without forcing the human to remember every next touch manually.',
      'This room should behave like an operator relay that turns state into action.',
    ].join('\n\n'),
    phoneRelayBrief:
      'Surface the next touch, remind the operator why it matters, and avoid escalation unless the brief conflicts with the desired outcome.',
    desktopSessionBrief:
      'Build the follow-up rules, operator views, and template surfaces tied to the pipeline and contact context.',
    brief: {
      creative: {
        mission: 'Keep high-value follow-up work moving with context and timing intact.',
        beneficiary:
          'The operator needs the system to tell them who to contact next, why, and with enough context to act immediately.',
        audience: 'Human operators on phone plus assistant agents scheduling or drafting next actions.',
        references: [
          {
            label: 'Calm reminder flow',
            ref: 'phone/follow-up-relay',
            note: 'Good references feel like a trusted assistant surfacing the right next move.',
            polarity: 'good',
          },
          {
            label: 'Nag spam',
            ref: 'anti-pattern/crm-notification-blast',
            note: 'Bad references generate noisy reminders with no context or prioritization.',
            polarity: 'bad',
          },
        ],
        tone: 'Calm, timely, and operator-friendly.',
      },
      execution: {
        task: 'Define and build the follow-up relay module for the CRM.',
        acceptanceCriteria: [
          {
            id: 'crm-followups-next-action',
            description: 'The room can surface a concrete next follow-up action with context and rationale.',
            verificationHint: 'Artifacts or UI show next action, contact context, and why the action matters now.',
          },
          {
            id: 'crm-followups-phone-friendly',
            description: 'The room supports a phone-first relay for fast review and action.',
            verificationHint: 'Briefs or UI artifacts show a compact phone workflow with escalation only for contradictions.',
          },
        ],
        scope: {
          in: ['Follow-up cadences', 'Operator relay views', 'Reminder logic', 'Template hooks'],
          out: ['Opportunity production work', 'Deep pipeline analytics', 'Contact schema redesign'],
        },
        antiPatterns: [
          'Reminder spam without contact context or stage awareness',
          'Asking the human what to do next when the brief already defines the outcome',
        ],
        deliverables: ['Follow-up rules', 'Operator relay spec', 'Phone-friendly next-action view'],
        milestone: 'Operator relay',
        dependsOn: ['crm-pipeline'],
        blockedBy: [],
        effortHint: '1 focused build pass',
      },
      escalationPolicy: 'outcome-contradiction-only',
      autonomyPolicy: 'full-auto',
      projectId: 'crm',
    },
  },
] as const

export function crmPreset(): BoardPreset {
  const cards = CRM_ROOM_SEEDS.map(problemRoom)
  const wires: BoardWire[] = [
    {
      id: 'wire-crm-contacts-opportunities',
      fromCardId: 'crm-contacts',
      toCardId: 'crm-opportunities',
    },
    {
      id: 'wire-crm-contacts-pipeline',
      fromCardId: 'crm-contacts',
      toCardId: 'crm-pipeline',
    },
    {
      id: 'wire-crm-opportunities-pipeline',
      fromCardId: 'crm-opportunities',
      toCardId: 'crm-pipeline',
    },
    {
      id: 'wire-crm-pipeline-followups',
      fromCardId: 'crm-pipeline',
      toCardId: 'crm-followups',
    },
  ]
  return { cards, wires }
}
