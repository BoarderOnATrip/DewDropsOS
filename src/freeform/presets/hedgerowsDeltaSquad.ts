import { defaultTerminalRuntime } from '../agentRuntime'
import type { WorkflowCard } from '../types'

const HEDW_PROBLEM_ID = 'hedw-problem'

function agent(
  id: string,
  title: string,
  x: number,
  y: number,
  color: string,
  management: 'manual' | 'auto' = 'manual',
): WorkflowCard {
  const w = 168
  const h = 104
  return {
    id,
    x,
    y,
    width: w,
    height: h,
    title,
    expanded: true,
    color,
    kind: 'agent',
    assignedToProblemId: null,
    management,
    agentRuntime: defaultTerminalRuntime(id, title),
  }
}

/**
 * Hedgerows 2.0 — virtual company preset: one problem + delta squad in orbit.
 * Drag agents onto the problem card to combine into the swarm.
 */
export function hedgerowsDeltaSquadCards(): WorkflowCard[] {
  return [
    {
      id: HEDW_PROBLEM_ID,
      x: -190,
      y: -125,
      width: 380,
      height: 268,
      title: 'Hedgerows 2.0',
      expanded: true,
      color: '#34c759',
      kind: 'problem',
      problemShape: 'panel',
      swarmTemplate: 'build',
      preferredLaunchSurface: 'hybrid',
      memoryWing: 'hedgerows',
      memoryRoom: 'launch-garden',
      memoryContextSummary:
        'Cross-device execution room for taking Hedgerows 2.0 from concept into a real, testable product and pilot pipeline.',
      memoryAnchors: [
        'compartment/hedgerows/market-map',
        'entity/hedgerows/pilot-sites',
        'room/paired-phone-relay',
      ],
      memoryPalaceLoci: [
        {
          id: 'hedw-north-star',
          title: 'North Star Gate',
          kind: 'north_star',
          detail: 'Ship a credible MVP, validate the install path, and keep the phone and desktop surfaces in one shared mission loop.',
        },
        {
          id: 'hedw-launch-room',
          title: 'Launch Garden',
          kind: 'room',
          detail: 'The main coordination room for product, pilot, and build decisions.',
        },
        {
          id: 'hedw-market-map',
          title: 'Market Map Compartment',
          kind: 'artifact',
          detail: 'compartment/hedgerows/market-map',
        },
        {
          id: 'hedw-phone-relay',
          title: 'Phone Relay Arch',
          kind: 'portal',
          detail: 'room/paired-phone-relay',
        },
      ],
      phoneRelayBrief:
        'Capture field notes, screen fast decisions, and escalate only blockers that need a live approval.',
      desktopSessionBrief:
        'Use the desktop session for deep implementation, synthesis, regulatory review, and durable planning decisions.',
      mission: [
        'Self-watering root and plant fences that mature into living walls — hedgerows 2.0 for privacy, ecology, and place-making.',
        'North star: ship a credible MVP, validate agronomy and install path, and stay on the right side of water, structure, and property-line reality.',
        'Drop agents onto this problem hub to form a self-organizing swarm. The envelope folds around the active team.',
        'The swarm attacks the current bottleneck, reconnects to the whole goal after each chunk, and only pulls the overseer in when a real decision or constraint needs judgment.',
        'Double-click empty canvas to summon more agents. Finished agents peel back out and return to the surface for reuse.',
      ].join('\n\n'),
      openQuestions: [
        'Which jurisdiction and setback rules bound v1 installs?',
        'Irrigation source for pilots: greywater vs potable — what is allowed where we ship first?',
      ],
    },
    agent('hedw-sys-irrigation', 'Systems / irrigation engineer', -455, -95, '#5ac8fa'),
    agent('hedw-arch-land', 'Landscape architect', -455, 45, '#64d2ff'),
    agent('hedw-agronomy', 'Agronomy & plant science', -455, 185, '#30d158'),
    agent('hedw-structural', 'Structural / materials', 285, -95, '#ff9f0a'),
    agent('hedw-regulatory', 'Regulatory & permits', 285, 45, '#bf5af2'),
    agent('hedw-ops', 'Supply chain & ops', 285, 185, '#ffd60a'),
    agent('hedw-dev-lead', 'Lead developer', -215, -295, '#0a84ff'),
    agent('hedw-dev-web', 'Web & product engineer', 35, -295, '#5e5ce6'),
    agent('hedw-research', 'Research synthesis', -430, -245, '#ac8e68'),
    agent('hedw-brand', 'Brand & creative director', 215, -275, '#ff375f'),
    agent('hedw-finance', 'Financial modeling', 405, -115, '#32ade6'),
    agent('hedw-fundraise', 'Fundraising & pitch narrative', 405, 25, '#66d4cf'),
    agent('hedw-techwriter', 'Technical & spec writer', 405, 165, '#98989d'),
    agent('hedw-video', 'Video & motion', -145, 215, '#ff6482'),
    agent('hedw-copy', 'Content & copywriter', 55, 215, '#ff9ff3'),
    agent('hedw-brainstorm', 'Brainstorm / ideation partner', -305, 235, '#c4c4c4'),
    agent('hedw-memory', 'Memory palace architect', -610, -120, '#7dd3a7'),
    agent('hedw-context', 'Context archivist', -610, 20, '#8fe3ff'),
    agent('hedw-phone', 'Phone companion product lead', -610, 160, '#4ecdc4'),
    agent('hedw-voice', 'Voice / call flow designer', -610, 300, '#ffb86c'),
    agent('hedw-mobile-eng', 'Mobile product engineer', 565, -120, '#6c8cff'),
    agent('hedw-sync', 'Local-first sync engineer', 565, 20, '#34c759'),
    agent('hedw-device-qa', 'Device QA & field testing', 565, 160, '#ffd166'),
    agent('hedw-console', 'Desktop operator console', 565, 300, '#ff6b6b'),
  ]
}

/** How many preset agents exist (for continuing Agent N numbering after load). */
export function hedgerowsPresetAgentCount(): number {
  return hedgerowsDeltaSquadCards().filter((c) => c.kind === 'agent').length
}
