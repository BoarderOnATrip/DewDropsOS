import { defaultTerminalRuntime } from '../agentRuntime'
import { compileBriefPacket } from '../briefCompiler'
import type { BriefSpec } from '../briefSpec'
import type { BoardWire, RunArtifact, RunLedgerEntry, SelfEvaluation, WorkflowCard } from '../types'

const DIY_MOVIE_ROOM_ID = 'diy-movie-room'
const DIY_MOVIE_RUN_ID = 'diy-movie-run-approval-pass'
const DIY_MOVIE_CONTRACT_ID = 'diy-movie-contract-approval-pass'
const DIY_MOVIE_RUN_TITLE = 'DIYMovie publish packet pass'
const DIY_MOVIE_STARTED_AT = '2026-04-18T09:00:00.000Z'
const DIY_MOVIE_COMPLETED_AT = '2026-04-18T09:14:00.000Z'

type BoardPreset = {
  cards: WorkflowCard[]
  wires: BoardWire[]
}

function agent(
  id: string,
  title: string,
  x: number,
  y: number,
  color: string,
): WorkflowCard {
  return {
    id,
    x,
    y,
    width: 168,
    height: 104,
    title,
    expanded: true,
    color,
    kind: 'agent',
    assignedToProblemId: null,
    management: 'manual',
    agentRuntime: defaultTerminalRuntime(id, title),
  }
}

function roomBrief(): BriefSpec {
  return {
    id: `${DIY_MOVIE_ROOM_ID}-brief`,
    capabilityProfileId: 'build-local',
    swarmRecipeId: 'build-review-ship',
    creative: {
      mission:
        'Turn a rough idea into a shootable short-film package with a clean handoff into edit and a human-reviewed social release packet.',
      beneficiary:
        'A creator needs one room that keeps story, production, edit, and release context attached to the same project instead of scattering it across docs and chats.',
      audience: 'DIY filmmakers, collaborators, and future Butler runs coordinating the movie from capture through release.',
      references: [
        {
          label: 'Shoot day packet',
          ref: 'artifact/diymovie/master-shot-list',
          note: 'Good references keep story beats, coverage, and production notes in one package the crew can actually use.',
          polarity: 'good',
        },
        {
          label: 'Loose message thread chaos',
          ref: 'anti-pattern/chat-only-production',
          note: 'Bad references bury the plan in scattered messages and make every pickup or export a rediscovery exercise.',
          polarity: 'bad',
        },
      ],
      tone: 'Practical, cinematic, and production-aware.',
    },
    execution: {
      task:
        'Shape the current DIYMovie concept into a shootable script, a credible shot plan, an edit handoff, and a publish approval packet.',
      acceptanceCriteria: [
        {
          id: 'diymovie-story-to-script',
          description: 'The room turns the idea into a coherent script or beat-driven scene plan with a clear emotional spine.',
          verificationHint: 'Artifacts include a readable script or beat sheet tied to the project premise.',
        },
        {
          id: 'diymovie-production-handoff',
          description: 'The room produces a shot list and capture/edit handoff that makes the project shootable without restating the plan.',
          verificationHint: 'Artifacts include a master shot list, coverage notes, and edit-direction context.',
        },
        {
          id: 'diymovie-publish-gate',
          description: 'The room prepares a release packet for social cutdowns and keeps a human approval gate before publishing.',
          verificationHint: 'Artifacts include a publish approval packet and the brief explicitly avoids autonomous posting.',
        },
      ],
      scope: {
        in: [
          'Idea shaping',
          'Script and beat work',
          'Shot listing',
          'Capture checklist',
          'Edit direction',
          'Release packet for short-form socials',
        ],
        out: [
          'Autonomous posting without review',
          'Paid distribution',
          'Long-term analytics dashboards',
          'Feature-length scheduling and budgeting',
        ],
      },
      antiPatterns: [
        'Treating social posting as automatic instead of a review-gated release step',
        'Separating the shot list from the story logic so capture becomes guesswork on set',
        'Dumping raw notes into chat without a reusable story, edit, and publish packet',
      ],
      deliverables: [
        'Beat sheet or script draft',
        'Master shot list',
        'Capture checklist',
        'Edit decision list',
        'Publish approval packet',
      ],
      milestone: 'First release-ready story room',
      dependsOn: [],
      blockedBy: [],
      effortHint: '1 story pass + 1 production pass + 1 release pass',
    },
    escalationPolicy: 'outcome-contradiction-only',
    autonomyPolicy: 'milestone-checkpoint',
    projectId: 'diy-movie',
  }
}

function buildRunArtifacts(): RunArtifact[] {
  return [
    {
      id: `${DIY_MOVIE_RUN_ID}-report`,
      runId: DIY_MOVIE_RUN_ID,
      kind: 'report',
      title: 'DIYMovie room publish packet report',
      summary: 'Summarized the story spine, shot plan, and release gate for the first launch pass.',
      createdAt: DIY_MOVIE_COMPLETED_AT,
    },
    {
      id: `${DIY_MOVIE_RUN_ID}-shot-list`,
      runId: DIY_MOVIE_RUN_ID,
      kind: 'plan',
      title: 'Master shot list',
      summary: 'Primary coverage plan with hero beats, pickups, and transition shots.',
      createdAt: DIY_MOVIE_COMPLETED_AT,
    },
    {
      id: `${DIY_MOVIE_RUN_ID}-edit-list`,
      runId: DIY_MOVIE_RUN_ID,
      kind: 'plan',
      title: 'Edit decision list',
      summary: 'Pacing, selects, sound, and social-cutdown notes for post-production.',
      createdAt: DIY_MOVIE_COMPLETED_AT,
    },
    {
      id: `${DIY_MOVIE_RUN_ID}-publish-packet`,
      runId: DIY_MOVIE_RUN_ID,
      kind: 'plan',
      title: 'Publish approval packet',
      summary: 'Release packet for captions, thumbnails, cutdowns, and final human review.',
      createdAt: DIY_MOVIE_COMPLETED_AT,
    },
  ]
}

function buildRunSelfEvaluation(): SelfEvaluation {
  return {
    alignmentSummary:
      'Converted the DIYMovie concept into a first-pass story room, built the master shot list and edit handoff, and stopped at a human-reviewed publish packet instead of posting automatically.',
    criteriaChecks: [
      {
        criterionId: 'diymovie-story-to-script',
        met: true,
        evidence:
          'The report establishes the story spine and script/beat direction so future runs can continue from a coherent narrative instead of raw notes.',
        confidence: 'high',
      },
      {
        criterionId: 'diymovie-production-handoff',
        met: true,
        evidence:
          'The Master shot list and Edit decision list connect story intent to coverage, pickups, pacing, and post-production work.',
        confidence: 'high',
      },
      {
        criterionId: 'diymovie-publish-gate',
        met: true,
        evidence:
          'The Publish approval packet preserves a human approval gate before any Instagram Reels, TikTok, or YouTube Shorts release.',
        confidence: 'high',
      },
    ],
    allCriteriaMet: true,
    criteriaCovered: [
      'diymovie-story-to-script',
      'diymovie-production-handoff',
      'diymovie-publish-gate',
    ],
    criteriaRemaining: [],
    nextAction: null,
    escalationReason: null,
    assumptions: [
      'The first pass targets short-form social cutdowns around a hero short instead of a full distribution stack.',
      'Phone capture remains the likely field surface, while desktop remains the primary place for script shaping, edit direction, and release review.',
      'Human review owns captions, thumbnails, and final channel selection before anything ships publicly.',
    ],
    handoffNotes: [
      'dec:Locked the room around a single story-to-release pipeline with a publish approval gate.',
      'why:That keeps movie making practical for a small team while still protecting the last-mile social release step.',
      'rej:Rejected autonomous posting and skipped long-term analytics or paid media because they do not help the first room prove the workflow.',
      'watch:Revisit the release packet if future runs need a stronger distinction between the hero cut, teaser cutdowns, and channel-specific caption variants.',
    ].join('\n'),
  }
}

function seedApprovalPass(card: WorkflowCard): WorkflowCard {
  const briefPacket = compileBriefPacket(card, card.butlerRoomId ?? card.id)
  const run: RunLedgerEntry = {
    runId: DIY_MOVIE_RUN_ID,
    contractId: DIY_MOVIE_CONTRACT_ID,
    roomId: card.butlerRoomId ?? card.id,
    title: DIY_MOVIE_RUN_TITLE,
    status: 'completed',
    startedAt: DIY_MOVIE_STARTED_AT,
    completedAt: DIY_MOVIE_COMPLETED_AT,
    artifacts: buildRunArtifacts(),
    briefSpecId: card.briefSpec?.id,
    briefVersion: briefPacket?.briefVersion,
    briefHash: briefPacket?.briefHash,
    selfEvaluation: buildRunSelfEvaluation(),
    continuationDecision: 'complete',
  }

  return {
    ...card,
    runLedger: [run],
  }
}

function roomCard(): WorkflowCard {
  return seedApprovalPass({
    id: DIY_MOVIE_ROOM_ID,
    x: -200,
    y: -125,
    width: 390,
    height: 274,
    title: 'DIYMovie Story Forge',
    expanded: true,
    color: '#ff7a45',
    kind: 'problem',
    problemShape: 'panel',
    swarmTemplate: 'build',
    preferredLaunchSurface: 'hybrid',
    capabilityProfileId: 'build-local',
    swarmRecipeId: 'build-review-ship',
    briefSpec: roomBrief(),
    briefVersion: 1,
    briefLocked: true,
    memoryWing: 'diymovie',
    memoryRoom: 'story-forge',
    memoryContextSummary:
      'Single room for idea shaping, script work, shot planning, capture, edit, and review-gated social release.',
    memoryAnchors: [
      'product/diymovie',
      'compartment/diymovie/story-bank',
      'artifact/diymovie/master-shot-list',
      'artifact/diymovie/edit-decision-list',
      'artifact/diymovie/publish-approval-packet',
      'social/instagram-reels',
      'social/tiktok',
      'social/youtube-shorts',
    ],
    memoryPalaceLoci: [
      {
        id: 'idea-wall',
        title: 'Idea Wall',
        kind: 'room',
        detail: 'Core premise, emotional hook, and scene energy live here before anything gets formal.',
      },
      {
        id: 'script-table',
        title: 'Script Table',
        kind: 'artifact',
        detail: 'Beat sheet, dialogue, and scene order for the current cut.',
      },
      {
        id: 'shotlist-rail',
        title: 'Shotlist Rail',
        kind: 'artifact',
        detail: 'Coverage plan, props, lenses, pickups, and the master shot list.',
      },
      {
        id: 'capture-bay',
        title: 'Capture Bay',
        kind: 'room',
        detail: 'Phone-friendly shooting checklist, location notes, and performance cues.',
      },
      {
        id: 'edit-desk',
        title: 'Edit Desk',
        kind: 'artifact',
        detail: 'Selects, pacing, sound, exports, and social-cutdown notes for post.',
      },
      {
        id: 'publish-gate',
        title: 'Publish Gate',
        kind: 'checkpoint',
        detail: 'Final review for captions, thumbnails, release packet, and channel approvals.',
      },
    ],
    phoneRelayBrief:
      'Capture shoot notes, pickup requests, and approval blockers from set; escalate if the final cut, brand claims, or release decision needs a human before publishing.',
    desktopSessionBrief:
      'Use the desktop room to shape the story, tighten the script, build the shot list, drive the edit handoff, and prepare the release packet for reviewed social cutdowns.',
    mission: [
      'DIYMovie should make small-team movie making feel like one coherent room instead of a scattered pile of notes, footage, and release tasks.',
      'The room starts with the idea, hardens into a script and master shot list, carries capture and edit context forward, and stops at a human-reviewed publish gate.',
      'Social cutdowns are part of the room, but posting is not autonomous. Approval stays in the loop.',
    ].join('\n\n'),
    openQuestions: [],
  })
}

export function diyMoviePreset(): BoardPreset {
  return {
    cards: [
      roomCard(),
      agent('diy-story', 'Story producer', -470, -80, '#ffb347'),
      agent('diy-script', 'Scriptwriter', -470, 60, '#ffc15e'),
      agent('diy-shotlist', 'Shot planner', -470, 200, '#ffd166'),
      agent('diy-capture', 'Capture director', 290, -80, '#72ddf7'),
      agent('diy-editor', 'Editor', 290, 60, '#8093f1'),
      agent('diy-social', 'Social cutdown producer', 290, 200, '#f65aa3'),
    ],
    wires: [],
  }
}
