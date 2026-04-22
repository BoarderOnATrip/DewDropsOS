import type { MemoryPalaceLocus, MemoryPalaceLocusKind, WorkflowCard } from './types'

export const MEMORY_PALACE_KIND_OPTIONS: Array<{ value: MemoryPalaceLocusKind; label: string }> = [
  { value: 'north_star', label: 'North star' },
  { value: 'room', label: 'Room' },
  { value: 'portal', label: 'Portal' },
  { value: 'artifact', label: 'Artifact' },
  { value: 'checkpoint', label: 'Checkpoint' },
]

const MEMORY_PALACE_KIND_LABELS: Record<MemoryPalaceLocusKind, string> = {
  north_star: 'North star',
  room: 'Room',
  portal: 'Portal',
  artifact: 'Artifact',
  checkpoint: 'Checkpoint',
}

function slugToken(input: string, fallback: string): string {
  const normalized = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return normalized || fallback
}

function isKind(value: string): value is MemoryPalaceLocusKind {
  return (
    value === 'north_star' ||
    value === 'room' ||
    value === 'portal' ||
    value === 'artifact' ||
    value === 'checkpoint'
  )
}

function normalizeLocus(locus: MemoryPalaceLocus, index: number): MemoryPalaceLocus | null {
  const title = locus.title?.trim() || ''
  const detail = locus.detail?.trim() || ''
  if (!title || !detail || !isKind(locus.kind)) return null
  return {
    id: locus.id?.trim() || `locus-${index + 1}`,
    title,
    kind: locus.kind,
    detail,
  }
}

function missionFirstLine(problem: WorkflowCard): string {
  return (
    problem.mission
      ?.split(/\n+/)
      .map((line) => line.trim())
      .find(Boolean) ||
    `Carry forward the active context for ${problem.title}.`
  )
}

export function buildVisualMemoryPalace(problem: WorkflowCard): MemoryPalaceLocus[] {
  const explicit = (problem.memoryPalaceLoci ?? [])
    .map((locus, index) => normalizeLocus(locus, index))
    .filter((locus): locus is MemoryPalaceLocus => locus !== null)
  if (explicit.length > 0) return explicit

  const anchors = (problem.memoryAnchors ?? []).map((anchor) => anchor.trim()).filter(Boolean)
  const derived: MemoryPalaceLocus[] = [
    {
      id: 'north-star',
      title: 'North Star',
      kind: 'north_star',
      detail: problem.memoryContextSummary?.trim() || missionFirstLine(problem),
    },
    {
      id: 'room-core',
      title: problem.memoryRoom?.trim() || 'Working room',
      kind: 'room',
      detail: `${problem.memoryWing?.trim() || slugToken(problem.title, problem.id)}/${
        problem.memoryRoom?.trim() || 'context-map'
      }`,
    },
  ]

  for (const [index, anchor] of anchors.slice(0, 4).entries()) {
    derived.push({
      id: `anchor-${index + 1}`,
      title: anchor.split('/').pop()?.replace(/[-_]+/g, ' ') || `Anchor ${index + 1}`,
      kind: anchor.startsWith('room/') ? 'room' : anchor.startsWith('entity/') ? 'artifact' : 'portal',
      detail: anchor,
    })
  }

  if (problem.phoneRelayBrief?.trim()) {
    derived.push({
      id: 'phone-checkpoint',
      title: 'Phone relay checkpoint',
      kind: 'checkpoint',
      detail: problem.phoneRelayBrief.trim(),
    })
  }

  return derived
}

export function formatVisualMemoryPalaceDraft(loci: readonly MemoryPalaceLocus[] | undefined): string {
  return (loci ?? [])
    .map((locus) => {
      const normalized = normalizeLocus(locus, 0)
      if (!normalized) return ''
      return `${normalized.title} | ${normalized.kind} | ${normalized.detail}`
    })
    .filter(Boolean)
    .join('\n')
}

export function parseVisualMemoryPalaceDraft(raw: string): MemoryPalaceLocus[] {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const [titleRaw = '', kindRaw = '', ...detailParts] = line.split('|').map((part) => part.trim())
      const title = titleRaw.trim()
      const kindToken = kindRaw.trim()
      const detail = detailParts.join(' | ').trim()
      if (!title || !detail || !isKind(kindToken)) return null
      return {
        id: `${slugToken(title, `locus-${index + 1}`)}-${index + 1}`,
        title,
        kind: kindToken,
        detail,
      } satisfies MemoryPalaceLocus
    })
    .filter((locus): locus is MemoryPalaceLocus => locus !== null)
}

export function memoryPalaceKindLabel(kind: MemoryPalaceLocusKind): string {
  return MEMORY_PALACE_KIND_LABELS[kind]
}

export function memoryPalacePacketLine(locus: MemoryPalaceLocus): string {
  return `${memoryPalaceKindLabel(locus.kind)} | ${locus.title} | ${locus.detail}`
}
