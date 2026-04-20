import type { BriefCompartmentAsset, BriefCompartmentKind, WorkflowCard } from './types'
import { buildVisualMemoryPalace } from './visualMemoryPalace'

export type BriefCompartmentOption = {
  id: string
  label: string
  hint: string
  anchorRef: string
  kind: BriefCompartmentKind
  source: 'system' | 'locus'
  locusId?: string
  keywords: string[]
}

export type BriefCompartmentFileDescriptor = {
  name: string
  type: string
  size: number
}

type CompartmentDefinition = {
  kind: Exclude<BriefCompartmentKind, 'custom'>
  label: string
  hint: string
  keywords: string[]
}

type CompartmentSignals = {
  scores: Partial<Record<BriefCompartmentKind, number>>
  reasons: Partial<Record<BriefCompartmentKind, string[]>>
  tokens: Set<string>
  extension: string
}

const SYSTEM_COMPARTMENTS: readonly CompartmentDefinition[] = [
  {
    kind: 'north_star',
    label: 'North Star',
    hint: 'Mission, goal, outline, and outcome truth for the room.',
    keywords: ['north', 'star', 'brief', 'mission', 'goal', 'strategy', 'outline', 'spec', 'requirements'],
  },
  {
    kind: 'reference',
    label: 'Reference Compartment',
    hint: 'Research, examples, inspiration, brand context, and precedent.',
    keywords: ['reference', 'research', 'example', 'examples', 'inspiration', 'moodboard', 'brand', 'style', 'deck'],
  },
  {
    kind: 'source',
    label: 'Source Compartment',
    hint: 'Raw materials, notes, transcripts, and general intake.',
    keywords: ['source', 'raw', 'intake', 'notes', 'transcript', 'material', 'materials', 'assets', 'import'],
  },
  {
    kind: 'data',
    label: 'Data Compartment',
    hint: 'Structured source files like CSVs, JSON, sheets, and records.',
    keywords: ['data', 'dataset', 'csv', 'json', 'sheet', 'spreadsheet', 'record', 'records', 'crm', 'contacts'],
  },
  {
    kind: 'script',
    label: 'Script Table',
    hint: 'Scripts, copy, captions, hooks, and narration.',
    keywords: ['script', 'copy', 'caption', 'captions', 'hook', 'hooks', 'voiceover', 'narration', 'dialogue'],
  },
  {
    kind: 'shotlist',
    label: 'Shotlist Rail',
    hint: 'Scenes, beats, storyboards, shot lists, and schedules.',
    keywords: ['shot', 'shotlist', 'scene', 'scenes', 'storyboard', 'coverage', 'beats', 'schedule', 'callsheet'],
  },
  {
    kind: 'capture',
    label: 'Capture Bay',
    hint: 'Raw footage, audio, stills, recordings, and on-set material.',
    keywords: ['capture', 'footage', 'raw', 'rushes', 'take', 'clip', 'recording', 'camera', 'broll', 'audio'],
  },
  {
    kind: 'edit',
    label: 'Edit Desk',
    hint: 'Assembly, cut, timeline, sequence, and project files.',
    keywords: ['edit', 'cut', 'timeline', 'assembly', 'sequence', 'project', 'roughcut', 'finecut', 'timeline'],
  },
  {
    kind: 'publish',
    label: 'Publish Gate',
    hint: 'Exports, finals, approvals, release candidates, and delivery.',
    keywords: ['publish', 'export', 'final', 'delivery', 'release', 'approval', 'approve', 'thumbnail', 'master'],
  },
  {
    kind: 'social',
    label: 'Social Queue',
    hint: 'Reels, Shorts, TikTok, channel cuts, and social packaging.',
    keywords: ['social', 'reel', 'reels', 'shorts', 'short', 'tiktok', 'instagram', 'youtube', 'post'],
  },
] as const

const EXTENSION_CATEGORY_MAP: Record<string, BriefCompartmentKind[]> = {
  md: ['north_star', 'script', 'reference'],
  txt: ['source', 'north_star', 'script'],
  doc: ['north_star', 'reference', 'script'],
  docx: ['north_star', 'reference', 'script'],
  pdf: ['reference', 'north_star'],
  csv: ['data', 'shotlist', 'source'],
  tsv: ['data', 'source'],
  xls: ['data', 'shotlist'],
  xlsx: ['data', 'shotlist'],
  numbers: ['data', 'shotlist'],
  json: ['data', 'source'],
  yaml: ['data', 'source'],
  yml: ['data', 'source'],
  png: ['capture', 'reference', 'publish', 'social'],
  jpg: ['capture', 'reference', 'social'],
  jpeg: ['capture', 'reference', 'social'],
  webp: ['capture', 'reference', 'social'],
  gif: ['capture', 'social'],
  mp4: ['capture', 'edit', 'publish', 'social'],
  mov: ['capture', 'edit', 'publish', 'social'],
  m4v: ['capture', 'edit', 'publish', 'social'],
  mp3: ['capture', 'script'],
  wav: ['capture', 'script'],
  m4a: ['capture', 'script'],
  aac: ['capture', 'script'],
  prproj: ['edit'],
  fcpxml: ['edit'],
  aep: ['edit'],
  ppt: ['reference', 'publish'],
  pptx: ['reference', 'publish'],
  key: ['reference', 'publish'],
}

function slugToken(input: string, fallback: string): string {
  const normalized = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return normalized || fallback
}

function extensionFromName(name: string): string {
  const parts = name.trim().toLowerCase().split('.')
  return parts.length > 1 ? parts[parts.length - 1] ?? '' : ''
}

function tokenize(raw: string): string[] {
  return raw
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 1)
}

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}

function boost(
  signals: CompartmentSignals,
  kind: BriefCompartmentKind,
  amount: number,
  reason: string,
): void {
  signals.scores[kind] = (signals.scores[kind] ?? 0) + amount
  signals.reasons[kind] = uniqueStrings([...(signals.reasons[kind] ?? []), reason])
}

function systemCompartment(kind: Exclude<BriefCompartmentKind, 'custom'>): CompartmentDefinition {
  return SYSTEM_COMPARTMENTS.find((entry) => entry.kind === kind) ?? SYSTEM_COMPARTMENTS[0]!
}

function inferKindFromText(raw: string): BriefCompartmentKind {
  const tokens = new Set(tokenize(raw))
  let best: BriefCompartmentKind = 'custom'
  let bestScore = 0

  for (const entry of SYSTEM_COMPARTMENTS) {
    const score = entry.keywords.filter((keyword) => tokens.has(keyword)).length
    if (score > bestScore) {
      best = entry.kind
      bestScore = score
    }
  }

  return bestScore > 0 ? best : 'custom'
}

function buildOptionFromLocus(problem: WorkflowCard, locus: ReturnType<typeof buildVisualMemoryPalace>[number]): BriefCompartmentOption {
  const kind = inferKindFromText(`${locus.title} ${locus.detail}`)
  const definition = kind === 'custom' ? null : systemCompartment(kind)
  return {
    id: `locus:${problem.id}:${locus.id}`,
    label: locus.title,
    hint: locus.detail,
    anchorRef: `compartment/${slugToken(locus.title, locus.id)}`,
    kind,
    source: 'locus',
    locusId: locus.id,
    keywords: uniqueStrings([
      ...tokenize(`${locus.title} ${locus.detail}`),
      ...(definition?.keywords ?? []),
    ]),
  }
}

function problemContextText(problem: WorkflowCard): string {
  const brief = problem.briefSpec
  return [
    problem.title,
    problem.mission,
    problem.memoryContextSummary,
    problem.memoryWing,
    problem.memoryRoom,
    problem.phoneRelayBrief,
    problem.desktopSessionBrief,
    brief?.creative.mission,
    brief?.creative.beneficiary,
    brief?.creative.audience,
    brief?.creative.tone,
    ...((brief?.creative.references ?? []).flatMap((reference) => [reference.label, reference.note, reference.ref])),
    brief?.execution.task,
    ...(brief?.execution.scope.in ?? []),
    ...(brief?.execution.scope.out ?? []),
    ...(brief?.execution.deliverables ?? []),
    ...(brief?.execution.antiPatterns ?? []),
    ...(brief?.execution.acceptanceCriteria ?? []).flatMap((criterion) => [
      criterion.id,
      criterion.description,
      criterion.verificationHint ?? '',
    ]),
    ...buildVisualMemoryPalace(problem).flatMap((locus) => [locus.title, locus.detail]),
  ]
    .filter(Boolean)
    .join(' ')
}

function buildSignals(file: BriefCompartmentFileDescriptor): CompartmentSignals {
  const extension = extensionFromName(file.name)
  const tokens = new Set(tokenize([file.name, extension, file.type].filter(Boolean).join(' ')))
  const signals: CompartmentSignals = {
    scores: {},
    reasons: {},
    tokens,
    extension,
  }

  if (extension && EXTENSION_CATEGORY_MAP[extension]) {
    EXTENSION_CATEGORY_MAP[extension]!.forEach((kind, index) => {
      boost(signals, kind, Math.max(1, 4 - index), `.${extension} file signal`)
    })
  }

  if (file.type.startsWith('video/')) {
    boost(signals, 'capture', 4, 'video media signal')
    boost(signals, 'edit', 2, 'video media signal')
  } else if (file.type.startsWith('image/')) {
    boost(signals, 'capture', 3, 'image media signal')
    boost(signals, 'reference', 2, 'image media signal')
    boost(signals, 'social', 1, 'image media signal')
  } else if (file.type.startsWith('audio/')) {
    boost(signals, 'capture', 3, 'audio media signal')
    boost(signals, 'script', 1, 'audio media signal')
  } else if (file.type.includes('json') || file.type.includes('sheet')) {
    boost(signals, 'data', 3, 'structured file signal')
  } else if (file.type.startsWith('text/')) {
    boost(signals, 'source', 2, 'text file signal')
  }

  const tokenBoosts: Array<[BriefCompartmentKind, readonly string[], string]> = [
    ['north_star', ['brief', 'mission', 'goal', 'outline', 'requirements', 'north'], 'North Star keywords'],
    ['reference', ['reference', 'research', 'moodboard', 'inspiration', 'brand', 'example'], 'reference keywords'],
    ['source', ['source', 'raw', 'notes', 'transcript', 'asset', 'assets', 'material'], 'source keywords'],
    ['data', ['data', 'dataset', 'sheet', 'spreadsheet', 'csv', 'json', 'contacts', 'crm', 'leads'], 'data keywords'],
    ['script', ['script', 'copy', 'caption', 'captions', 'hook', 'voiceover', 'narration', 'dialogue'], 'script keywords'],
    ['shotlist', ['shot', 'shotlist', 'scene', 'storyboard', 'coverage', 'schedule', 'callsheet'], 'shotlist keywords'],
    ['capture', ['capture', 'footage', 'rushes', 'take', 'clip', 'recording', 'camera', 'broll'], 'capture keywords'],
    ['edit', ['edit', 'cut', 'timeline', 'assembly', 'sequence', 'roughcut', 'finecut'], 'edit keywords'],
    ['publish', ['publish', 'export', 'final', 'delivery', 'release', 'approval', 'thumbnail', 'master'], 'publish keywords'],
    ['social', ['social', 'reel', 'reels', 'short', 'shorts', 'tiktok', 'instagram', 'youtube', 'post'], 'social keywords'],
  ]

  tokenBoosts.forEach(([kind, keywords, reason]) => {
    const matches = keywords.filter((keyword) => tokens.has(keyword))
    if (matches.length > 0) {
      boost(signals, kind, 2 + matches.length, `${reason}: ${matches.slice(0, 3).join(', ')}`)
    }
  })

  return signals
}

function describeReasons(
  option: BriefCompartmentOption,
  fileMatches: string[],
  roomMatches: string[],
  signalReasons: readonly string[],
): string {
  const reasons = uniqueStrings([
    ...signalReasons.slice(0, 2),
    fileMatches.length > 0 ? `matched ${fileMatches.slice(0, 3).join(', ')}` : '',
    roomMatches.length > 0 ? `room guidance leans ${option.label.toLowerCase()}` : '',
  ])

  if (reasons.length === 0) {
    return `Placed in ${option.label} as the current room intake default.`
  }

  return `Sorted into ${option.label} because ${reasons.slice(0, 2).join(' and ')}.`
}

function bestFallbackOption(options: readonly BriefCompartmentOption[]): BriefCompartmentOption {
  return (
    options.find((option) => option.kind === 'source') ??
    options.find((option) => option.kind === 'reference') ??
    options[0] ?? {
      id: 'system:source',
      label: 'Source Compartment',
      hint: systemCompartment('source').hint,
      anchorRef: 'compartment/source-compartment',
      kind: 'source',
      source: 'system',
      keywords: [...systemCompartment('source').keywords],
    }
  )
}

function detectSocialTargets(raw: string): string[] {
  const normalized = raw.toLowerCase()
  const targets: string[] = []
  if (/\b(instagram|reels?)\b/.test(normalized)) targets.push('instagram-reels')
  if (/\b(youtube|shorts?)\b/.test(normalized)) targets.push('youtube-shorts')
  if (/\b(tik ?tok)\b/.test(normalized)) targets.push('tiktok')
  return uniqueStrings(targets)
}

export function buildBriefCompartmentOptions(problem: WorkflowCard): BriefCompartmentOption[] {
  const locusOptions = buildVisualMemoryPalace(problem).map((locus) => buildOptionFromLocus(problem, locus))
  const usedKinds = new Set(locusOptions.filter((option) => option.kind !== 'custom').map((option) => option.kind))
  const systemOptions = SYSTEM_COMPARTMENTS
    .filter((entry) => !usedKinds.has(entry.kind))
    .map<BriefCompartmentOption>((entry) => ({
      id: `system:${entry.kind}`,
      label: entry.label,
      hint: entry.hint,
      anchorRef: `compartment/${slugToken(entry.label, entry.kind)}`,
      kind: entry.kind,
      source: 'system',
      keywords: [...entry.keywords],
    }))

  return [...locusOptions, ...systemOptions]
}

export function createBriefCompartmentAsset(
  problem: WorkflowCard,
  file: BriefCompartmentFileDescriptor,
  options?: {
    compartmentOptions?: readonly BriefCompartmentOption[]
    assetId?: string
    addedAt?: string
  },
): BriefCompartmentAsset {
  const compartmentOptions = options?.compartmentOptions ?? buildBriefCompartmentOptions(problem)
  const fallback = bestFallbackOption(compartmentOptions)
  const contextTokens = new Set(tokenize(problemContextText(problem)))
  const signals = buildSignals(file)

  let bestOption = fallback
  let bestScore = Number.NEGATIVE_INFINITY
  let bestReason = ''
  let bestStatus: BriefCompartmentAsset['organizeStatus'] = 'review'

  for (const option of compartmentOptions) {
    const fileMatches = option.keywords.filter((keyword) => signals.tokens.has(keyword))
    const roomMatches = option.keywords.filter((keyword) => contextTokens.has(keyword))
    const categoryBoost = signals.scores[option.kind] ?? 0
    let score = categoryBoost + fileMatches.length * 4 + Math.min(roomMatches.length, 3)

    if (option.source === 'locus') score += 1
    if (option.kind === 'custom' && fileMatches.length === 0) score -= 1

    const status: BriefCompartmentAsset['organizeStatus'] = score >= 4 ? 'sorted' : 'review'
    const reason = describeReasons(option, fileMatches, roomMatches, signals.reasons[option.kind] ?? [])

    if (score > bestScore) {
      bestOption = option
      bestScore = score
      bestReason = reason
      bestStatus = status
    }
  }

  const addedAt = options?.addedAt ?? new Date().toISOString()
  const extension = signals.extension || undefined
  const slug = slugToken(`${bestOption.label}-${file.name}`, 'compartment-asset')

  return {
    id: options?.assetId ?? `compartment-${slug}-${Math.random().toString(36).slice(2, 8)}`,
    name: file.name,
    mimeType: file.type || 'application/octet-stream',
    sizeBytes: Number.isFinite(file.size) ? file.size : 0,
    addedAt,
    compartmentId: bestOption.id,
    compartmentLabel: bestOption.label,
    compartmentKind: bestOption.kind,
    anchorRef: bestOption.anchorRef,
    extension,
    organizeStatus: bestStatus,
    organizeReason: bestReason,
    matchedLocusId: bestOption.locusId,
  }
}

export function briefCompartmentAssetArtifactRef(asset: Pick<BriefCompartmentAsset, 'id' | 'name'>): string {
  return `artifact/${slugToken(asset.name, asset.id)}`
}

export function briefCompartmentAssetAnchorRefs(asset: BriefCompartmentAsset): string[] {
  const socialTargets = detectSocialTargets(`${asset.name} ${asset.compartmentLabel}`)
  return uniqueStrings([
    asset.anchorRef,
    briefCompartmentAssetArtifactRef(asset),
    ...socialTargets.map((target) => `social/${target}`),
  ])
}

export function collectProblemAnchorRefs(problem: WorkflowCard): string[] {
  const manualAnchors = (problem.memoryAnchors ?? []).map((anchor) => anchor.trim()).filter(Boolean)
  const compartmentAnchors = (problem.briefCompartmentAssets ?? []).flatMap(briefCompartmentAssetAnchorRefs)
  return uniqueStrings([...manualAnchors, ...compartmentAnchors])
}
