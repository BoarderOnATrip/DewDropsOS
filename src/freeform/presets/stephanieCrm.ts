import type { BriefSpec } from '../briefSpec'
import type { BoardWire, ButlerLaunchSurface, SwarmTemplate, WorkflowCard } from '../types'
import { applyStephanieContactsBriefPass } from './stephanieCrmContactsPass'

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
    memoryWing: 'stephanie-crm',
    memoryRoom: seed.memoryRoom,
    memoryContextSummary: seed.memoryContextSummary,
    memoryAnchors: [
      'wing/stephanie-crm',
      `room/stephanie-crm/${seed.memoryRoom}`,
      'entity/stephanie/operating-system',
    ],
    phoneRelayBrief: seed.phoneRelayBrief,
    desktopSessionBrief: seed.desktopSessionBrief,
    mission: seed.mission,
    openQuestions: [],
  }

  if (seed.id === 'stephanie-crm-contacts') {
    return applyStephanieContactsBriefPass(card)
  }

  return card
}

const CRM_ROOM_SEEDS: readonly CrmRoomSeed[] = [
  {
    id: 'stephanie-crm-contacts',
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
      'Canonical relationship room for people, households, vendors, and conversation history tied to Stephanie CRM.',
    mission: [
      'Build the relationship memory layer for Stephanie CRM.',
      'This room should make every person, household, and partner legible enough that future agents can act without re-discovering who matters and why.',
    ].join('\n\n'),
    phoneRelayBrief:
      'Capture contact updates, note relationship changes, and generate a Mira-backed aiButler phone brief; flag only contradictions in identity or ownership.',
    desktopSessionBrief:
      'Model entities, normalize fields, and produce a durable relationship map plus conversation-memory hooks that other CRM rooms can trust.',
    brief: {
      creative: {
        mission: 'Give Stephanie a calm relationship memory for every client, partner, and household she touches.',
        beneficiary:
          'Stephanie needs fast recall on people, context, and trust signals so she can operate from her phone without losing continuity.',
        audience: 'Stephanie and any future assistant agents operating her CRM workflow.',
        references: [
          {
            label: 'Warm introductions',
            ref: 'room/paired-phone-relay',
            note: 'Good references feel personal and context-rich instead of flat rows in a spreadsheet.',
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
        task: 'Define the contact and relationship model for Stephanie CRM.',
        acceptanceCriteria: [
          {
            id: 'contacts-core-entities',
            description: 'The room identifies core person, household, vendor, and referral entities.',
            verificationHint: 'Relationship map or schema lists the canonical entity types and key fields.',
          },
          {
            id: 'contacts-context-capture',
            description: 'The room preserves meaningful context such as stage, preferences, and recent interactions.',
            verificationHint: 'Artifacts show a structured summary of context that future agents can reuse.',
          },
        ],
        scope: {
          in: ['Entity model', 'Relationship map', 'Contact context fields', 'Conversation memory hooks'],
          out: ['Message sending automation', 'Listing workflows', 'Task calendar views'],
        },
        antiPatterns: [
          'Flattening every relationship into a single contact table with no household or referral structure',
          'Forcing Stephanie to restate context that the system should already remember',
        ],
        deliverables: ['Contact schema', 'Relationship map', 'Field dictionary'],
        milestone: 'CRM foundation',
        dependsOn: [],
        blockedBy: [],
        effortHint: '1 focused design/build pass',
      },
      escalationPolicy: 'outcome-contradiction-only',
      autonomyPolicy: 'full-auto',
      projectId: 'stephanie-crm',
    },
  },
  {
    id: 'stephanie-crm-listings',
    title: 'Listings',
    x: 90,
    y: -170,
    color: '#5e60ce',
    swarmTemplate: 'build',
    launchSurface: 'desktop',
    capabilityPackId: 'delivery-builder',
    capabilityProfileId: 'build-local',
    swarmRecipeId: 'build-review-ship',
    memoryRoom: 'listings',
    memoryContextSummary:
      'Execution room for listing intake, media, assets, launch checklists, and presentation outputs.',
    mission: [
      'Turn listing operations into a repeatable build lane.',
      'Agents should be able to assemble and verify listing assets without asking Stephanie to micromanage file and status flow.',
    ].join('\n\n'),
    phoneRelayBrief:
      'Capture listing changes from the field, note blockers, and hand media or status changes into the room.',
    desktopSessionBrief:
      'Implement the listing workflow, deliverables, and publishing-ready artifacts for the CRM.',
    brief: {
      creative: {
        mission: 'Make listing work feel like a controlled production line instead of an ad hoc scramble.',
        beneficiary:
          'Stephanie needs every listing to move from intake to launch with fewer dropped details and clearer readiness.',
        audience: 'Stephanie, listing coordinators, and builder/reviewer agents.',
        references: [
          {
            label: 'Launch checklist',
            ref: 'artifact/listing-launch-checklist',
            note: 'Good references make readiness visible and leave little ambiguity about what remains.',
            polarity: 'good',
          },
          {
            label: 'Loose folder chaos',
            ref: 'anti-pattern/random-drive-folders',
            note: 'Bad references scatter assets across unnamed folders and leave launch state implicit.',
            polarity: 'bad',
          },
        ],
        tone: 'Production-grade, explicit, and ready to verify.',
      },
      execution: {
        task: 'Design and build the listing workflow module for Stephanie CRM.',
        acceptanceCriteria: [
          {
            id: 'listings-stage-flow',
            description: 'The room defines or implements a clear listing stage flow from intake through launch.',
            verificationHint: 'Artifacts or code show stages, state transitions, and readiness checks.',
          },
          {
            id: 'listings-deliverables',
            description: 'The room tracks required listing deliverables such as assets, copy, and launch readiness.',
            verificationHint: 'Listing records or specs include explicit deliverables and completion states.',
          },
        ],
        scope: {
          in: ['Listing intake', 'Asset tracking', 'Stage flow', 'Launch readiness'],
          out: ['Contact graph modeling', 'General pipeline analytics', 'Long-term nurture automation'],
        },
        antiPatterns: [
          'Treating listing readiness as a single boolean with no intermediate evidence',
          'Relying on Stephanie to manually reconcile scattered files before launch',
        ],
        deliverables: ['Listing workflow spec', 'Listing module implementation plan', 'Launch readiness artifact'],
        milestone: 'Listings module',
        dependsOn: ['stephanie-crm-contacts'],
        blockedBy: [],
        effortHint: '2 focused build passes',
      },
      escalationPolicy: 'outcome-contradiction-only',
      autonomyPolicy: 'milestone-checkpoint',
      projectId: 'stephanie-crm',
    },
  },
  {
    id: 'stephanie-crm-pipeline',
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
      'Operating room for deal stages, dependencies, dashboard clarity, and bottleneck visibility across the CRM.',
    mission: [
      'Make the entire CRM legible as a flowing pipeline, not a pile of disconnected work.',
      'This room should tell agents what is moving, what is blocked, and what must happen next.',
    ].join('\n\n'),
    phoneRelayBrief:
      'Capture changes in stage, urgency, and blockers; escalate only if stage logic contradicts the room goals.',
    desktopSessionBrief:
      'Audit the cross-room workflow and define the canonical pipeline model, milestones, and dependencies.',
    brief: {
      creative: {
        mission: 'Give Stephanie one reliable view of active work, blocked work, and next moves.',
        beneficiary:
          'Stephanie needs the system to surface the true state of deals and tasks without requiring manual reconstruction.',
        audience: 'Stephanie and orchestration agents coordinating across CRM rooms.',
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
        task: 'Define the pipeline, milestones, and review surfaces for Stephanie CRM.',
        acceptanceCriteria: [
          {
            id: 'pipeline-stage-model',
            description: 'The room establishes a stage model that can describe active, blocked, and completed work.',
            verificationHint: 'Artifacts define stages, transitions, and milestone checkpoints.',
          },
          {
            id: 'pipeline-dependencies',
            description: 'The room describes how other CRM rooms feed into or depend on the pipeline.',
            verificationHint: 'Artifacts or graph output show room dependencies and cross-room visibility.',
          },
        ],
        scope: {
          in: ['Stage model', 'Milestones', 'Dependency map', 'Run monitoring'],
          out: ['Listing asset authoring', 'Direct outreach content', 'Contact entity normalization'],
        },
        antiPatterns: [
          'Multiple overlapping pipeline states with no decision rule for advancement',
          'Hidden blockers that only exist in chat history or a human head',
        ],
        deliverables: ['Pipeline map', 'Milestone definitions', 'Cross-room dependency notes'],
        milestone: 'Operations layer',
        dependsOn: ['stephanie-crm-contacts', 'stephanie-crm-listings'],
        blockedBy: [],
        effortHint: '1 audit + 1 refinement pass',
      },
      escalationPolicy: 'outcome-contradiction-only',
      autonomyPolicy: 'milestone-checkpoint',
      projectId: 'stephanie-crm',
    },
  },
  {
    id: 'stephanie-crm-followups',
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
      'Translate CRM state into timely follow-up work without forcing Stephanie to remember every next touch manually.',
      'This room should behave like an operator relay that turns state into action.',
    ].join('\n\n'),
    phoneRelayBrief:
      'Surface the next touch, remind Stephanie why it matters, and avoid escalation unless the brief conflicts with the desired outcome.',
    desktopSessionBrief:
      'Build the follow-up rules, operator views, and template surfaces tied to the pipeline and contact context.',
    brief: {
      creative: {
        mission: 'Keep high-value follow-up work moving with context and timing intact.',
        beneficiary:
          'Stephanie needs the system to tell her who to contact next, why, and with enough context to act immediately.',
        audience: 'Stephanie on phone and operator agents scheduling or drafting next actions.',
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
        task: 'Define and build the follow-up relay module for Stephanie CRM.',
        acceptanceCriteria: [
          {
            id: 'followups-next-action',
            description: 'The room can surface a concrete next follow-up action with context and rationale.',
            verificationHint: 'Artifacts or UI show next action, contact context, and why the action matters now.',
          },
          {
            id: 'followups-phone-friendly',
            description: 'The room supports a phone-first relay for fast review and action.',
            verificationHint: 'Briefs or UI artifacts show a compact phone workflow with escalation only for contradictions.',
          },
        ],
        scope: {
          in: ['Follow-up cadences', 'Operator relay views', 'Reminder logic', 'Template hooks'],
          out: ['Listing asset production', 'Deep pipeline analytics', 'Contact schema redesign'],
        },
        antiPatterns: [
          'Reminder spam without contact context or stage awareness',
          'Asking Stephanie what to do next when the brief already defines the outcome',
        ],
        deliverables: ['Follow-up rules', 'Operator relay spec', 'Phone-friendly next-action view'],
        milestone: 'Operator relay',
        dependsOn: ['stephanie-crm-pipeline'],
        blockedBy: [],
        effortHint: '1 focused build pass',
      },
      escalationPolicy: 'outcome-contradiction-only',
      autonomyPolicy: 'full-auto',
      projectId: 'stephanie-crm',
    },
  },
] as const

export function stephanieCrmPreset(): BoardPreset {
  const cards = CRM_ROOM_SEEDS.map(problemRoom)
  const wires: BoardWire[] = [
    {
      id: 'wire-stephanie-contacts-listings',
      fromCardId: 'stephanie-crm-contacts',
      toCardId: 'stephanie-crm-listings',
    },
    {
      id: 'wire-stephanie-contacts-pipeline',
      fromCardId: 'stephanie-crm-contacts',
      toCardId: 'stephanie-crm-pipeline',
    },
    {
      id: 'wire-stephanie-listings-pipeline',
      fromCardId: 'stephanie-crm-listings',
      toCardId: 'stephanie-crm-pipeline',
    },
    {
      id: 'wire-stephanie-pipeline-followups',
      fromCardId: 'stephanie-crm-pipeline',
      toCardId: 'stephanie-crm-followups',
    },
  ]
  return { cards, wires }
}
