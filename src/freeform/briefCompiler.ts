import type { BriefPacket, BriefSpec } from './briefSpec'
import { normalizeBriefSpec } from './briefSpec'
import type { WorkflowCard } from './types'

function hashContent(content: string): string {
  let h = 0
  for (let i = 0; i < content.length; i++) {
    h = Math.imul(31, h) + content.charCodeAt(i) | 0
  }
  return (h >>> 0).toString(36)
}

function hashBriefSpec(spec: BriefSpec): string {
  return hashContent(JSON.stringify(spec))
}

// Compile a BriefPacket from a room card.
// Returns null if the card has no briefSpec.
// The returned packet is immutable — it captures the brief exactly as it was
// at compile time. Store it with the run, not on the room card.
export function compileBriefPacket(
  card: WorkflowCard,
  roomId: string,
): BriefPacket | null {
  if (!card.briefSpec) return null
  const spec = normalizeBriefSpec(card.briefSpec, card.briefSpec.id ?? `brief-${card.id}`)
  return {
    briefVersion: card.briefVersion ?? 1,
    briefHash: hashBriefSpec(spec),
    compiledAt: new Date().toISOString(),
    roomId,
    creative: spec.creative,
    execution: spec.execution,
    capabilityProfileId: spec.capabilityProfileId,
    swarmRecipeId: spec.swarmRecipeId,
    escalationPolicy: spec.escalationPolicy,
    autonomyPolicy: spec.autonomyPolicy,
  }
}

// Increment the brief version on the card after a save.
// The caller is responsible for persisting the updated card.
export function bumpBriefVersion(card: WorkflowCard): WorkflowCard {
  return {
    ...card,
    briefVersion: (card.briefVersion ?? 0) + 1,
  }
}

// Returns true if the card has a briefSpec, a non-empty runLedger, the latest
// run entry has a briefHash, AND that hash differs from the current brief.
// Returns false in all other cases (no brief, no runs, no hash, or hashes match).
export function detectBriefHashDrift(card: WorkflowCard): boolean {
  if (!card.briefSpec) return false
  if (!card.runLedger || card.runLedger.length === 0) return false
  const spec = normalizeBriefSpec(card.briefSpec, card.briefSpec.id ?? `brief-${card.id}`)
  const runHash = card.runLedger[0].briefHash
  if (!runHash) return false
  return runHash !== hashBriefSpec(spec)
}

// Returns the current hash, the latest run hash, and whether drift exists.
// currentHash is null when the card has no briefSpec.
// runHash is null when the card has no runs or the latest run has no briefHash.
export function getBriefDriftInfo(card: WorkflowCard): {
  hasDrift: boolean
  currentHash: string | null
  runHash: string | null
} {
  const currentHash = card.briefSpec
    ? hashBriefSpec(normalizeBriefSpec(card.briefSpec, card.briefSpec.id ?? `brief-${card.id}`))
    : null
  const runHash = card.runLedger?.[0]?.briefHash ?? null
  return {
    currentHash,
    runHash,
    hasDrift: detectBriefHashDrift(card),
  }
}
