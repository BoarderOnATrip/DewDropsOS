import { collectProblemAnchorRefs } from './briefCompartments'
import { normalizeBriefSpec } from './briefSpec'
import type { WorkflowCard } from './types'
import { buildVisualMemoryPalace } from './visualMemoryPalace'

const SOCIAL_ANCHOR_PREFIXES = ['social/', 'channel/'] as const
const PUBLISH_RE = /\b(publish|approval|approve|approved|review|sign[- ]?off|release)\b/i
const PUBLISH_ARTIFACT_RE =
  /\b(publish|approval|release|caption|thumbnail|cutdown|master[- ]?cut|social[- ]?cut)\b/i

export type ProblemApprovalHooks = {
  roomArchetype?: string
  socialTargets: string[]
  publishCheckpoint?: string
  publishArtifacts: string[]
  approvalRequired: boolean
  approvalMode?: 'human_review_before_publish'
  configured: boolean
}

export type ProblemLaunchMetadata = {
  roomKind: string
  metadata: Record<string, unknown>
  approvalHooks: ProblemApprovalHooks
}

function cleanAnchors(problem: WorkflowCard): string[] {
  return collectProblemAnchorRefs(problem)
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)]
}

function normalizeToken(value: string): string {
  return value.trim().toLowerCase()
}

function extractSocialTargets(anchors: readonly string[]): string[] {
  return unique(
    anchors.flatMap((anchor) => {
      const normalized = normalizeToken(anchor)
      const prefix = SOCIAL_ANCHOR_PREFIXES.find((candidate) => normalized.startsWith(candidate))
      if (!prefix) return []
      const target = normalized.slice(prefix.length).replace(/^\/+/, '').trim()
      return target ? [target] : []
    }),
  )
}

function extractPublishArtifacts(anchors: readonly string[]): string[] {
  return unique(
    anchors.filter((anchor) => {
      const normalized = normalizeToken(anchor)
      return normalized.startsWith('artifact/') && PUBLISH_ARTIFACT_RE.test(normalized)
    }),
  )
}

function findPublishCheckpoint(problem: WorkflowCard): string | undefined {
  const locus = buildVisualMemoryPalace(problem).find((entry) => {
    return PUBLISH_RE.test(entry.title) || PUBLISH_RE.test(entry.detail)
  })
  return locus?.title
}

function detectRoomArchetype(
  problem: WorkflowCard,
  anchors: readonly string[],
  socialTargets: readonly string[],
  approvalRequired: boolean,
): string | undefined {
  const projectId = normalizeToken(problem.briefSpec?.projectId ?? '')
  if (
    projectId === 'diy-movie' ||
    projectId === 'diymovie' ||
    anchors.some((anchor) => normalizeToken(anchor) === 'product/diymovie')
  ) {
    return 'diy_movie'
  }

  if (approvalRequired && socialTargets.length > 0) {
    return 'content_production'
  }

  return undefined
}

function briefEncodesReviewGate(problem: WorkflowCard): boolean {
  if (!problem.briefSpec) return false
  const briefSpec = normalizeBriefSpec(problem.briefSpec, `brief-${problem.id}`)

  const values = [
    ...briefSpec.execution.acceptanceCriteria.flatMap((criterion) => [
      criterion.id,
      criterion.description,
      criterion.verificationHint ?? '',
    ]),
    ...briefSpec.execution.deliverables,
    ...briefSpec.execution.antiPatterns,
    ...briefSpec.execution.scope.in,
    ...briefSpec.execution.scope.out,
  ]

  return values.some((value) => PUBLISH_RE.test(value) || PUBLISH_ARTIFACT_RE.test(value))
}

export function formatSocialTargetLabel(target: string): string {
  const normalized = normalizeToken(target)
  if (normalized === 'instagram-reels') return 'Instagram Reels'
  if (normalized === 'youtube-shorts') return 'YouTube Shorts'
  if (normalized === 'tiktok') return 'TikTok'

  return normalized
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(' ')
}

export function buildProblemApprovalHooks(problem: WorkflowCard): ProblemApprovalHooks {
  const briefSpec = problem.briefSpec ? normalizeBriefSpec(problem.briefSpec, `brief-${problem.id}`) : null
  const anchors = cleanAnchors(problem)
  const socialTargets = extractSocialTargets(anchors)
  const publishArtifacts = extractPublishArtifacts(anchors)
  const publishCheckpoint = findPublishCheckpoint(problem)
  const approvalRequired = socialTargets.length > 0 || publishArtifacts.length > 0 || !!publishCheckpoint
  const reviewRecipe = problem.swarmRecipeId?.trim() === 'build-review-ship'
  const autonomyGate = !!briefSpec && briefSpec.autonomyPolicy !== 'full-auto'
  const configured = !approvalRequired || (briefEncodesReviewGate(problem) && (reviewRecipe || autonomyGate))
  const roomArchetype = detectRoomArchetype(problem, anchors, socialTargets, approvalRequired)

  return {
    roomArchetype,
    socialTargets,
    publishCheckpoint,
    publishArtifacts,
    approvalRequired,
    approvalMode: approvalRequired ? 'human_review_before_publish' : undefined,
    configured,
  }
}

export function buildProblemLaunchMetadata(problem: WorkflowCard): ProblemLaunchMetadata {
  const approvalHooks = buildProblemApprovalHooks(problem)
  const metadata: Record<string, unknown> = {
    social_delivery: approvalHooks.socialTargets.length > 0,
    approval_required: approvalHooks.approvalRequired,
    approval_configured: approvalHooks.configured,
  }

  if (approvalHooks.roomArchetype) {
    metadata.room_archetype = approvalHooks.roomArchetype
  }
  if (approvalHooks.approvalMode) {
    metadata.approval_mode = approvalHooks.approvalMode
  }
  if (approvalHooks.socialTargets.length > 0) {
    metadata.publish_targets = approvalHooks.socialTargets
  }
  if (approvalHooks.publishCheckpoint) {
    metadata.publish_checkpoint = approvalHooks.publishCheckpoint
  }
  if (approvalHooks.publishArtifacts.length > 0) {
    metadata.publish_artifacts = approvalHooks.publishArtifacts
  }

  return {
    roomKind: approvalHooks.roomArchetype ?? 'project',
    metadata,
    approvalHooks,
  }
}
