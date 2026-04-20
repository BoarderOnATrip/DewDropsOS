import type { ButlerSwarmTemplate } from '../lib/butlerBridge'
import type { AutonomyPolicy } from './briefSpec'
import type { ButlerLaunchSurface, WorkflowCard } from './types'

export type CapabilityPack = {
  id: string
  label: string
  description: string
  capabilityProfileId: string
  swarmRecipeId: string
  template: ButlerSwarmTemplate
  launchSurface: ButlerLaunchSurface
  autonomyPolicy?: AutonomyPolicy
  reviewPolicy?: string
  tags: string[]
}

type PackMatchingTarget = Pick<
  WorkflowCard,
  | 'capabilityPackId'
  | 'capabilityProfileId'
  | 'swarmRecipeId'
  | 'swarmTemplate'
  | 'preferredLaunchSurface'
  | 'briefSpec'
>

export const CAPABILITY_PACKS: readonly CapabilityPack[] = [
  {
    id: 'relationship-memory',
    label: 'Relationship Memory',
    description: 'Research-first relationship mapping with a calm phone/desktop relay.',
    capabilityProfileId: 'research-standard',
    swarmRecipeId: 'relationship-map',
    template: 'relationship',
    launchSurface: 'hybrid',
    autonomyPolicy: 'full-auto',
    reviewPolicy: 'human-acceptance',
    tags: ['crm', 'relationship', 'memory'],
  },
  {
    id: 'delivery-builder',
    label: 'Delivery Builder',
    description: 'Local build lane with review and ship sequencing for production work.',
    capabilityProfileId: 'build-local',
    swarmRecipeId: 'build-review-ship',
    template: 'build',
    launchSurface: 'desktop',
    autonomyPolicy: 'milestone-checkpoint',
    reviewPolicy: 'machine-gate',
    tags: ['build', 'delivery', 'ship'],
  },
  {
    id: 'operations-audit',
    label: 'Operations Audit',
    description: 'Planning and audit posture for cross-room visibility, coverage, and bottlenecks.',
    capabilityProfileId: 'ops-diagnostic',
    swarmRecipeId: 'audit-report',
    template: 'planning',
    launchSurface: 'desktop',
    autonomyPolicy: 'milestone-checkpoint',
    reviewPolicy: 'machine-gate',
    tags: ['ops', 'audit', 'monitoring'],
  },
  {
    id: 'operator-relay-pack',
    label: 'Operator Relay',
    description: 'Hybrid operator loop for phone-first routing, decisions, and next-action handoff.',
    capabilityProfileId: 'build-local',
    swarmRecipeId: 'operator-relay',
    template: 'operator',
    launchSurface: 'hybrid',
    autonomyPolicy: 'full-auto',
    reviewPolicy: 'human-acceptance',
    tags: ['operator', 'relay', 'phone'],
  },
  {
    id: 'research-sprint',
    label: 'Research Sprint',
    description: 'Desktop research lane with synthesis and explicit evidence gathering.',
    capabilityProfileId: 'research-standard',
    swarmRecipeId: 'research-sweep',
    template: 'research',
    launchSurface: 'desktop',
    autonomyPolicy: 'per-run-checkpoint',
    reviewPolicy: 'human-acceptance',
    tags: ['research', 'synthesis'],
  },
] as const

export function getCapabilityPack(id: string): CapabilityPack | undefined {
  return CAPABILITY_PACKS.find((pack) => pack.id === id)
}

export function listCapabilityPacks(): readonly CapabilityPack[] {
  return CAPABILITY_PACKS
}

function normalized(value: string | undefined | null): string {
  return value?.trim() ?? ''
}

function packMatchesTarget(pack: CapabilityPack, target: PackMatchingTarget): boolean {
  if (normalized(target.capabilityProfileId) !== pack.capabilityProfileId) return false
  if (normalized(target.swarmRecipeId) !== pack.swarmRecipeId) return false
  if (normalized(target.swarmTemplate) !== pack.template) return false
  if (normalized(target.preferredLaunchSurface) !== pack.launchSurface) return false
  if (pack.autonomyPolicy && target.briefSpec && target.briefSpec.autonomyPolicy !== pack.autonomyPolicy) {
    return false
  }
  return true
}

export function resolveCapabilityPackId(target: PackMatchingTarget): string | undefined {
  const explicit = normalized(target.capabilityPackId)
  if (explicit) {
    const pack = getCapabilityPack(explicit)
    if (pack && packMatchesTarget(pack, target)) return pack.id
  }

  const matches = CAPABILITY_PACKS.filter((pack) => packMatchesTarget(pack, target))
  if (matches.length === 1) return matches[0]!.id
  return undefined
}

export function applyCapabilityPack(problem: WorkflowCard, pack: CapabilityPack): WorkflowCard {
  const next: WorkflowCard = {
    ...problem,
    capabilityPackId: pack.id,
    capabilityProfileId: pack.capabilityProfileId,
    swarmRecipeId: pack.swarmRecipeId,
    swarmTemplate: pack.template,
    preferredLaunchSurface: pack.launchSurface,
  }

  if (problem.briefSpec) {
    next.briefSpec = {
      ...problem.briefSpec,
      capabilityProfileId: pack.capabilityProfileId,
      swarmRecipeId: pack.swarmRecipeId,
      autonomyPolicy: pack.autonomyPolicy ?? problem.briefSpec.autonomyPolicy,
    }
  }

  return next
}

export function syncCapabilityPack(problem: WorkflowCard): WorkflowCard {
  const capabilityPackId = resolveCapabilityPackId(problem)
  if (problem.capabilityPackId === capabilityPackId) return problem
  return {
    ...problem,
    capabilityPackId,
  }
}
