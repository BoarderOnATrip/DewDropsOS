export type RoomPalaceZoneId =
  | 'door'
  | 'table'
  | 'wall'
  | 'shelf'
  | 'compartment'
  | 'window'
  | 'floor'
  | 'console'

export type RoomPalaceItemKind =
  | 'room'
  | 'actor'
  | 'locus'
  | 'artifact'
  | 'tunnel'
  | 'anchor'
  | 'brief'
  | 'question'
  | 'run'
  | 'overflow'

export type RoomPalaceInput = {
  title?: string
  summary?: string
  actors?: readonly string[]
  loci?: readonly string[]
  artifacts?: readonly string[]
  tunnels?: readonly string[]
  anchors?: readonly string[]
  briefs?: readonly string[]
  openQuestions?: readonly string[]
  latestRun?: string
}

export type RoomPalaceItem = {
  id: string
  label: string
  detail: string
  kind: RoomPalaceItemKind
  sourceIndex: number
}

export type RoomPalaceZoneTone = 'ready' | 'attention' | 'missing' | 'calm'

export type RoomPalaceZone = {
  id: RoomPalaceZoneId
  label: string
  summary: string
  tone: RoomPalaceZoneTone
  emptyLabel: string
  items: RoomPalaceItem[]
}

export type RoomPalaceCounts = {
  actors: number
  loci: number
  artifacts: number
  tunnels: number
  anchors: number
  briefs: number
  openQuestions: number
  hasLatestRun: boolean
}

export type RoomPalaceMapping = {
  title: string
  summary: string
  counts: RoomPalaceCounts
  zones: RoomPalaceZone[]
}

const ZONE_ORDER: readonly RoomPalaceZoneId[] = [
  'door',
  'table',
  'wall',
  'shelf',
  'compartment',
  'window',
  'floor',
  'console',
]

const ZONE_LABELS: Record<RoomPalaceZoneId, string> = {
  door: 'Door',
  table: 'Table',
  wall: 'Wall',
  shelf: 'Shelf',
  compartment: 'Compartment',
  window: 'Window',
  floor: 'Floor',
  console: 'Console',
}

const ZONE_EMPTY_LABELS: Record<RoomPalaceZoneId, string> = {
  door: 'No room title yet',
  table: 'No actors anchored yet',
  wall: 'No anchors or tunnels yet',
  shelf: 'No artifacts placed yet',
  compartment: 'No questions folded away',
  window: 'No briefs facing outward',
  floor: 'No loci staged yet',
  console: 'No run recorded yet',
}

function normalizeText(value: string | undefined): string {
  return value?.trim() ?? ''
}

function slugToken(input: string, fallback: string): string {
  const normalized = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return normalized || fallback
}

function pluralize(count: number, singular: string): string {
  return `${count} ${singular}${count === 1 ? '' : 's'}`
}

function zoneSummary(
  zoneId: RoomPalaceZoneId,
  counts: RoomPalaceCounts,
  latestRun: string,
  roomSummary: string,
): string {
  switch (zoneId) {
    case 'door':
      return roomSummary || 'Entry point for the room palace.'
    case 'table':
      return counts.actors > 0 ? `${pluralize(counts.actors, 'actor')} anchored here.` : 'Active actors live here.'
    case 'wall':
      return counts.anchors > 0 || counts.tunnels > 0
        ? `${pluralize(counts.anchors, 'anchor')} and ${pluralize(counts.tunnels, 'tunnel')} stitched into the room.`
        : 'Stable anchors and cross-room routes live here.'
    case 'shelf':
      return counts.artifacts > 0
        ? `${pluralize(counts.artifacts, 'artifact')} stored here.`
        : 'Artifacts and durable evidence live here.'
    case 'compartment':
      return counts.openQuestions > 0
        ? `${pluralize(counts.openQuestions, 'open question')} folded away.`
        : 'Folded questions and deferred context live here.'
    case 'window':
      return counts.briefs > 0
        ? `${pluralize(counts.briefs, 'brief')} facing outward.`
        : 'Briefs and outward-facing context live here.'
    case 'floor':
      return counts.loci > 0
        ? `${pluralize(counts.loci, 'locus')} laid out in a fixed walk.`
        : 'Loci and path order live here.'
    case 'console':
      return latestRun ? `Latest run: ${latestRun}` : 'Live execution state and handoff console.'
  }
}

function itemDetail(kind: Exclude<RoomPalaceItemKind, 'overflow'>, index: number, total: number): string {
  const label = kind === 'room' ? 'Room identity' : `${kind[0].toUpperCase()}${kind.slice(1)} ${index + 1} of ${total}`
  return label
}

function buildItem(
  zoneId: RoomPalaceZoneId,
  kind: RoomPalaceItemKind,
  label: string,
  sourceIndex: number,
  detail?: string,
): RoomPalaceItem {
  const safeLabel = normalizeText(label)
  return {
    id: `${zoneId}-${kind}-${sourceIndex + 1}-${slugToken(safeLabel, `${kind}-${sourceIndex + 1}`)}`,
    label: safeLabel,
    detail: detail ?? `${ZONE_LABELS[zoneId]} locus`,
    kind,
    sourceIndex,
  }
}

function normalizeList(values: readonly string[] | undefined): string[] {
  return (values ?? []).map(normalizeText).filter(Boolean)
}

function buildCappedItems(
  zoneId: RoomPalaceZoneId,
  kind: Exclude<RoomPalaceItemKind, 'overflow'>,
  values: readonly string[] | undefined,
  cap = 4,
): RoomPalaceItem[] {
  const normalized = normalizeList(values)
  const limited = normalized.slice(0, cap)
  const items = limited.map((label, index) =>
    buildItem(zoneId, kind, label, index, itemDetail(kind, index, normalized.length)),
  )
  if (normalized.length > cap) {
    items.push(
      buildItem(
        zoneId,
        'overflow',
        `+${normalized.length - cap} more`,
        cap,
        'Collapsed to keep the room compact.',
      ),
    )
  }
  return items
}

function buildDoorItems(title: string): RoomPalaceItem[] {
  const roomTitle = normalizeText(title) || 'Untitled room'
  return [buildItem('door', 'room', roomTitle, 0, 'Room identity')]
}

function buildConsoleItems(latestRun: string): RoomPalaceItem[] {
  const run = normalizeText(latestRun)
  return run ? [buildItem('console', 'run', run, 0, 'Latest run')] : []
}

function buildCounts(input: RoomPalaceInput): RoomPalaceCounts {
  const actors = normalizeList(input.actors)
  const loci = normalizeList(input.loci)
  const artifacts = normalizeList(input.artifacts)
  const tunnels = normalizeList(input.tunnels)
  const anchors = normalizeList(input.anchors)
  const briefs = normalizeList(input.briefs)
  const openQuestions = normalizeList(input.openQuestions)
  const latestRun = normalizeText(input.latestRun)

  return {
    actors: actors.length,
    loci: loci.length,
    artifacts: artifacts.length,
    tunnels: tunnels.length,
    anchors: anchors.length,
    briefs: briefs.length,
    openQuestions: openQuestions.length,
    hasLatestRun: latestRun.length > 0,
  }
}

function buildZone(
  zoneId: RoomPalaceZoneId,
  input: RoomPalaceInput,
  counts: RoomPalaceCounts,
  roomSummary: string,
): RoomPalaceZone {
  const latestRun = normalizeText(input.latestRun)
  const title = normalizeText(input.title) || 'Untitled room'

  switch (zoneId) {
    case 'door':
      return {
        id: zoneId,
        label: ZONE_LABELS[zoneId],
        summary: zoneSummary(zoneId, counts, latestRun, roomSummary),
        tone: title ? 'calm' : 'missing',
        emptyLabel: ZONE_EMPTY_LABELS[zoneId],
        items: buildDoorItems(title),
      }
    case 'table':
      return {
        id: zoneId,
        label: ZONE_LABELS[zoneId],
        summary: zoneSummary(zoneId, counts, latestRun, roomSummary),
        tone: counts.actors > 0 ? 'ready' : 'calm',
        emptyLabel: ZONE_EMPTY_LABELS[zoneId],
        items: buildCappedItems(zoneId, 'actor', input.actors),
      }
    case 'wall':
      return {
        id: zoneId,
        label: ZONE_LABELS[zoneId],
        summary: zoneSummary(zoneId, counts, latestRun, roomSummary),
        tone: counts.anchors > 0 || counts.tunnels > 0 ? 'ready' : 'calm',
        emptyLabel: ZONE_EMPTY_LABELS[zoneId],
        items: [
          ...buildCappedItems(zoneId, 'anchor', input.anchors),
          ...buildCappedItems(zoneId, 'tunnel', input.tunnels),
        ],
      }
    case 'shelf':
      return {
        id: zoneId,
        label: ZONE_LABELS[zoneId],
        summary: zoneSummary(zoneId, counts, latestRun, roomSummary),
        tone: counts.artifacts > 0 ? 'ready' : 'missing',
        emptyLabel: ZONE_EMPTY_LABELS[zoneId],
        items: buildCappedItems(zoneId, 'artifact', input.artifacts),
      }
    case 'compartment':
      return {
        id: zoneId,
        label: ZONE_LABELS[zoneId],
        summary: zoneSummary(zoneId, counts, latestRun, roomSummary),
        tone: counts.openQuestions > 0 ? 'attention' : 'calm',
        emptyLabel: ZONE_EMPTY_LABELS[zoneId],
        items: buildCappedItems(zoneId, 'question', input.openQuestions),
      }
    case 'window':
      return {
        id: zoneId,
        label: ZONE_LABELS[zoneId],
        summary: zoneSummary(zoneId, counts, latestRun, roomSummary),
        tone: counts.briefs > 0 ? 'ready' : 'calm',
        emptyLabel: ZONE_EMPTY_LABELS[zoneId],
        items: buildCappedItems(zoneId, 'brief', input.briefs),
      }
    case 'floor':
      return {
        id: zoneId,
        label: ZONE_LABELS[zoneId],
        summary: zoneSummary(zoneId, counts, latestRun, roomSummary),
        tone: counts.loci > 0 ? 'ready' : 'missing',
        emptyLabel: ZONE_EMPTY_LABELS[zoneId],
        items: buildCappedItems(zoneId, 'locus', input.loci),
      }
    case 'console':
      return {
        id: zoneId,
        label: ZONE_LABELS[zoneId],
        summary: zoneSummary(zoneId, counts, latestRun, roomSummary),
        tone: counts.hasLatestRun ? 'ready' : 'calm',
        emptyLabel: ZONE_EMPTY_LABELS[zoneId],
        items: buildConsoleItems(latestRun),
      }
  }
}

export function roomPalaceZoneLabel(zoneId: RoomPalaceZoneId): string {
  return ZONE_LABELS[zoneId]
}

export function buildRoomPalaceMapping(input: RoomPalaceInput): RoomPalaceMapping {
  const counts = buildCounts(input)
  const title = normalizeText(input.title) || 'Untitled room'
  const summary = normalizeText(input.summary) || `Room palace for ${title}`
  const zones = ZONE_ORDER.map((zoneId) => buildZone(zoneId, input, counts, summary))

  return {
    title,
    summary,
    counts,
    zones,
  }
}
