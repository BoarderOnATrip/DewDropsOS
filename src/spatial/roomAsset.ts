export type RoomAssetPoint = {
  x: number
  y: number
  z: number
}

export type RoomAssetSize = {
  width: number
  depth: number
  height: number
}

export type RoomAssetRect = {
  x: number
  y: number
  width: number
  height: number
}

export type RoomAssetRoomType = 'office' | 'meeting' | 'studio' | 'relay' | 'custom'

export type RoomAssetZoneId =
  | 'north_star'
  | 'door'
  | 'people_wall'
  | 'work_table'
  | 'evidence_desk'
  | 'future_window'
  | 'control_surface'
  | 'archive_shelf'
  | 'closet'
  | 'drawer'
  | 'phone_checkpoint'

export type RoomAssetCapturePipeline = 'roomplan' | 'arkit' | 'avfoundation' | 'openusd' | 'manual' | 'import'
export type RoomAssetCaptureDevice = 'iphone' | 'ipad' | 'desktop' | 'web' | 'unknown'
export type RoomAssetMediaSurfaceKind = 'screen' | 'panel' | 'window' | 'projection' | 'camera' | 'microphone' | 'speaker'
export type RoomAssetPropKind =
  | 'desk'
  | 'chair'
  | 'lamp'
  | 'monitor'
  | 'whiteboard'
  | 'plant'
  | 'shelf'
  | 'camera'
  | 'speaker'
  | 'book'
  | 'folder'
  | 'frame'
  | 'other'

export type RoomAssetPortalKind = 'doorway' | 'hallway' | 'window' | 'threshold' | 'tunnel'

export type RoomAssetMetadata = {
  id: string
  title: string
  summary: string
  roomType: RoomAssetRoomType
  editable: boolean
  labels: string[]
  version: number
}

export type RoomAssetCaptureSource = {
  kind: 'native_capture' | 'imported'
  pipeline: RoomAssetCapturePipeline
  device: RoomAssetCaptureDevice
  label: string
  captureStack: string[]
  capturedAt?: string
  sourceUri?: string
  importedFrom?: string
}

export type RoomAssetPortalTarget =
  | {
      kind: 'room'
      id: string
      label?: string
    }
  | {
      kind: 'wing'
      id: string
      label?: string
    }
  | {
      kind: 'world'
      id?: string
      label?: string
    }

export type RoomAssetPortal = {
  id: string
  label: string
  summary: string
  kind: RoomAssetPortalKind
  edge: 'north' | 'east' | 'south' | 'west'
  bounds: RoomAssetRect
  target?: RoomAssetPortalTarget
  locusId?: string
  tags: string[]
}

export type RoomAssetLocus = {
  id: string
  zoneId: RoomAssetZoneId
  label: string
  summary: string
  position: RoomAssetPoint
  size: RoomAssetSize
  propIds: string[]
  portalIds: string[]
  mediaSurfaceIds: string[]
  tags: string[]
}

export type RoomAssetProp = {
  id: string
  label: string
  summary: string
  kind: RoomAssetPropKind
  position: RoomAssetPoint
  size: RoomAssetSize
  locusId?: string
  mediaSurfaceIds: string[]
  tags: string[]
}

export type RoomAssetMediaSurface = {
  id: string
  label: string
  summary: string
  kind: RoomAssetMediaSurfaceKind
  position: RoomAssetPoint
  size: RoomAssetSize
  locusId?: string
  propIds: string[]
  channels: Array<'camera' | 'microphone' | 'speaker' | 'screen' | 'relay' | 'review'>
  active: boolean
  tags: string[]
}

export type RoomAsset = {
  metadata: RoomAssetMetadata
  captureSource: RoomAssetCaptureSource
  bounds: RoomAssetBounds
  portals: RoomAssetPortal[]
  loci: RoomAssetLocus[]
  props: RoomAssetProp[]
  mediaSurfaces: RoomAssetMediaSurface[]
}

export type RoomAssetBounds = {
  width: number
  depth: number
  height: number
  origin: RoomAssetPoint
}

export type RoomAssetSeed = {
  id?: string
  title?: string
  summary?: string
  roomType?: RoomAssetRoomType
  labels?: readonly string[]
  importedFrom?: string
  sourceUri?: string
  capturedAt?: string
}

export type RoomAssetContextInput = {
  title?: string
  summary?: string
  roomType?: RoomAssetRoomType
  memoryLabel?: string
  surfaceLabel?: string
  captureLabel?: string
  editLabel?: string
  actorLabels?: readonly string[]
  locusLabels?: readonly string[]
  artifactLabels?: readonly string[]
  tunnelLabels?: readonly string[]
  anchorLabels?: readonly string[]
  briefLabels?: readonly string[]
  openQuestionLabels?: readonly string[]
  latestRunLabel?: string
}

export const CANONICAL_ROOM_ASSET_LOCI: ReadonlyArray<{
  id: RoomAssetZoneId
  label: string
  summary: string
  position: RoomAssetPoint
  size: RoomAssetSize
}> = [
  {
    id: 'north_star',
    label: 'North Star',
    summary: 'Mission anchor and room return point.',
    position: { x: 0, y: -1.1, z: 0 },
    size: { width: 0.7, depth: 0.4, height: 0.2 },
  },
  {
    id: 'door',
    label: 'Door',
    summary: 'Entry and re-entry threshold.',
    position: { x: 0, y: 1.35, z: 0 },
    size: { width: 1.0, depth: 0.25, height: 2.2 },
  },
  {
    id: 'people_wall',
    label: 'People Wall',
    summary: 'Actors and relationships stay visible here.',
    position: { x: -2.1, y: 0.1, z: 0 },
    size: { width: 0.55, depth: 2.2, height: 1.8 },
  },
  {
    id: 'work_table',
    label: 'Work Table',
    summary: 'Active commitments and live work sit here.',
    position: { x: 0.15, y: 0.15, z: 0 },
    size: { width: 1.6, depth: 0.9, height: 0.75 },
  },
  {
    id: 'evidence_desk',
    label: 'Evidence Desk',
    summary: 'Notes, documents, and proof stay within reach.',
    position: { x: 2.0, y: 0.1, z: 0 },
    size: { width: 1.0, depth: 0.55, height: 0.78 },
  },
  {
    id: 'future_window',
    label: 'Future Window',
    summary: 'Open opportunities and next moves face outward.',
    position: { x: 2.2, y: -1.25, z: 0 },
    size: { width: 1.0, depth: 0.35, height: 1.6 },
  },
  {
    id: 'control_surface',
    label: 'Control Surface',
    summary: 'Agent actions and orchestration live here.',
    position: { x: 0.95, y: 1.0, z: 0 },
    size: { width: 1.15, depth: 0.45, height: 0.3 },
  },
  {
    id: 'archive_shelf',
    label: 'Archive Shelf',
    summary: 'Folded history and durable reference sit here.',
    position: { x: -2.0, y: -1.0, z: 0 },
    size: { width: 1.1, depth: 0.35, height: 1.6 },
  },
  {
    id: 'closet',
    label: 'Closet',
    summary: 'Compressed context and tucked-away details live here.',
    position: { x: -1.0, y: 1.0, z: 0 },
    size: { width: 0.9, depth: 0.45, height: 1.8 },
  },
  {
    id: 'drawer',
    label: 'Drawer',
    summary: 'Atomic leaves and folded records live here.',
    position: { x: -0.3, y: 0.9, z: 0 },
    size: { width: 0.65, depth: 0.25, height: 0.18 },
  },
  {
    id: 'phone_checkpoint',
    label: 'Phone Checkpoint',
    summary: 'Mobile relay and quick handoff live here.',
    position: { x: 1.55, y: 1.25, z: 0 },
    size: { width: 0.8, depth: 0.3, height: 0.2 },
  },
] as const

const DEFAULT_BOUNDS: RoomAssetBounds = {
  width: 5.6,
  depth: 4.2,
  height: 2.8,
  origin: { x: 0, y: 0, z: 0 },
}

const DEFAULT_CAPTURE_STACK = ['RoomPlan capture', 'ARKit scene mesh', 'AVFoundation media stream', 'OpenUSD room asset']

const DEFAULT_LOCUS_TAGS: Record<RoomAssetZoneId, string[]> = {
  north_star: ['mission'],
  door: ['entry', 'threshold'],
  people_wall: ['actors', 'relationships'],
  work_table: ['work', 'active'],
  evidence_desk: ['evidence', 'documents'],
  future_window: ['future', 'opportunity'],
  control_surface: ['agents', 'control'],
  archive_shelf: ['archive', 'history'],
  closet: ['compression', 'context'],
  drawer: ['records', 'leaves'],
  phone_checkpoint: ['phone', 'relay'],
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function normalizeText(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function normalizeOptionalText(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const text = value.trim()
  return text.length > 0 ? text : undefined
}

function normalizeNumber(value: unknown, fallback: number, minimum = 0): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.max(minimum, value)
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function slugToken(input: string, fallback: string): string {
  const normalized = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return normalized || fallback
}

function normalizePoint(value: unknown, fallback: RoomAssetPoint): RoomAssetPoint {
  if (!isRecord(value)) return fallback
  return {
    x: normalizeNumber(value.x, fallback.x),
    y: normalizeNumber(value.y, fallback.y),
    z: normalizeNumber(value.z, fallback.z),
  }
}

function normalizeSize(value: unknown, fallback: RoomAssetSize): RoomAssetSize {
  if (!isRecord(value)) return fallback
  return {
    width: normalizeNumber(value.width, fallback.width, 0.01),
    depth: normalizeNumber(value.depth, fallback.depth, 0.01),
    height: normalizeNumber(value.height, fallback.height, 0.01),
  }
}

function normalizeBounds(value: unknown, fallback: RoomAssetBounds): RoomAssetBounds {
  if (!isRecord(value)) return fallback
  return {
    width: normalizeNumber(value.width, fallback.width, 0.01),
    depth: normalizeNumber(value.depth, fallback.depth, 0.01),
    height: normalizeNumber(value.height, fallback.height, 0.01),
    origin: normalizePoint(value.origin, fallback.origin),
  }
}

function normalizeRect(value: unknown, fallback: RoomAssetRect): RoomAssetRect {
  if (!isRecord(value)) return fallback
  return {
    x: normalizeNumber(value.x, fallback.x),
    y: normalizeNumber(value.y, fallback.y),
    width: normalizeNumber(value.width, fallback.width, 0.01),
    height: normalizeNumber(value.height, fallback.height, 0.01),
  }
}

function normalizeStrings(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .map((entry) => normalizeOptionalText(entry))
        .filter((entry): entry is string => !!entry)
    : []
}

function uniqueById<T extends { id: string }>(items: readonly T[]): T[] {
  const seen = new Set<string>()
  const output: T[] = []
  for (const item of items) {
    if (seen.has(item.id)) continue
    seen.add(item.id)
    output.push(item)
  }
  return output
}

function clampToBounds(point: RoomAssetPoint, bounds: RoomAssetBounds): RoomAssetPoint {
  const halfWidth = bounds.width / 2
  const halfDepth = bounds.depth / 2
  const halfHeight = bounds.height / 2
  return {
    x: clamp(point.x, bounds.origin.x - halfWidth, bounds.origin.x + halfWidth),
    y: clamp(point.y, bounds.origin.y - halfDepth, bounds.origin.y + halfDepth),
    z: clamp(point.z, bounds.origin.z - halfHeight, bounds.origin.z + halfHeight),
  }
}

function assetIdFromTitle(title: string): string {
  return `room-asset-${slugToken(title, 'office')}`
}

function normalizeRoomType(value: unknown, fallback: RoomAssetRoomType): RoomAssetRoomType {
  return value === 'office' || value === 'meeting' || value === 'studio' || value === 'relay' || value === 'custom'
    ? value
    : fallback
}

function normalizeCaptureSource(value: unknown, seed: RoomAssetSeed, imported = false): RoomAssetCaptureSource {
  const source = isRecord(value) ? value : {}
  return {
    kind: imported ? 'imported' : 'native_capture',
    pipeline:
      source.pipeline === 'roomplan' ||
      source.pipeline === 'arkit' ||
      source.pipeline === 'avfoundation' ||
      source.pipeline === 'openusd' ||
      source.pipeline === 'manual' ||
      source.pipeline === 'import'
        ? source.pipeline
        : imported
          ? 'import'
          : 'roomplan',
    device:
      source.device === 'iphone' || source.device === 'ipad' || source.device === 'desktop' || source.device === 'web'
        ? source.device
        : imported
          ? 'unknown'
          : 'iphone',
    label: normalizeText(source.label, imported ? 'Imported room asset' : 'Native capture seed'),
    captureStack: normalizeStrings(source.captureStack).length > 0 ? normalizeStrings(source.captureStack) : [...DEFAULT_CAPTURE_STACK],
    capturedAt: normalizeOptionalText(source.capturedAt ?? seed.capturedAt),
    sourceUri: normalizeOptionalText(source.sourceUri ?? seed.sourceUri),
    importedFrom: normalizeOptionalText(source.importedFrom ?? seed.importedFrom),
  }
}

function canonicalLocusTemplate(zoneId: RoomAssetZoneId): (typeof CANONICAL_ROOM_ASSET_LOCI)[number] {
  const locus = CANONICAL_ROOM_ASSET_LOCI.find((entry) => entry.id === zoneId)
  if (!locus) {
    return CANONICAL_ROOM_ASSET_LOCI[0]
  }
  return locus
}

function normalizeZoneId(value: unknown, label: string, fallback: RoomAssetZoneId = 'work_table'): RoomAssetZoneId {
  const text = normalizeOptionalText(value)?.toLowerCase() ?? label.toLowerCase()
  if (text.includes('north')) return 'north_star'
  if (text.includes('door') || text.includes('gate') || text.includes('entry') || text.includes('entrance')) return 'door'
  if (text.includes('people') || text.includes('person') || text.includes('wall') || text.includes('relationship')) {
    return 'people_wall'
  }
  if (text.includes('table') || text.includes('desk') || text.includes('work')) return 'work_table'
  if (text.includes('evidence') || text.includes('proof') || text.includes('document') || text.includes('file')) {
    return 'evidence_desk'
  }
  if (text.includes('future') || text.includes('window') || text.includes('opportunity') || text.includes('next')) {
    return 'future_window'
  }
  if (text.includes('control') || text.includes('surface') || text.includes('agent') || text.includes('console')) {
    return 'control_surface'
  }
  if (text.includes('archive') || text.includes('shelf') || text.includes('history') || text.includes('reference')) {
    return 'archive_shelf'
  }
  if (text.includes('closet') || text.includes('stash') || text.includes('storage')) return 'closet'
  if (text.includes('drawer') || text.includes('fold')) return 'drawer'
  if (text.includes('phone') || text.includes('relay') || text.includes('mobile')) return 'phone_checkpoint'
  return fallback
}

function normalizePortalKind(value: unknown, label: string): RoomAssetPortalKind {
  const text = normalizeOptionalText(value)?.toLowerCase() ?? label.toLowerCase()
  if (text.includes('window')) return 'window'
  if (text.includes('hall')) return 'hallway'
  if (text.includes('threshold')) return 'threshold'
  if (text.includes('tunnel')) return 'tunnel'
  return 'doorway'
}

function normalizePortalEdge(value: unknown, index: number): RoomAssetPortal['edge'] {
  if (value === 'north' || value === 'east' || value === 'south' || value === 'west') return value
  return (['north', 'east', 'south', 'west'] as const)[index % 4]
}

function normalizePortal(value: unknown, index: number, bounds: RoomAssetBounds): RoomAssetPortal | null {
  if (!isRecord(value)) return null
  const label = normalizeText(value.label ?? value.title, `Portal ${index + 1}`)
  return {
    id: normalizeText(value.id, `portal-${index + 1}`),
    label,
    summary: normalizeText(value.summary, 'A transition surface for the room.'),
    kind: normalizePortalKind(value.kind, label),
    edge: normalizePortalEdge(value.edge, index),
    bounds: normalizeRect(value.bounds, {
      x: bounds.origin.x,
      y: bounds.origin.y,
      width: 1.1,
      height: 2.1,
    }),
    target: isRecord(value.target)
        ? {
            kind:
              value.target.kind === 'room' || value.target.kind === 'wing' || value.target.kind === 'world'
                ? value.target.kind
                : 'world',
            id: normalizeOptionalText(value.target.id) ?? slugToken(label, 'target'),
            label: normalizeOptionalText(value.target.label),
          }
        : undefined,
    locusId: normalizeOptionalText(value.locusId),
    tags: normalizeStrings(value.tags),
  }
}

function normalizePropKind(value: unknown, label: string): RoomAssetPropKind {
  const text = normalizeOptionalText(value)?.toLowerCase() ?? label.toLowerCase()
  if (text.includes('desk')) return 'desk'
  if (text.includes('chair')) return 'chair'
  if (text.includes('lamp')) return 'lamp'
  if (text.includes('monitor') || text.includes('screen')) return 'monitor'
  if (text.includes('whiteboard') || text.includes('board')) return 'whiteboard'
  if (text.includes('plant')) return 'plant'
  if (text.includes('shelf')) return 'shelf'
  if (text.includes('camera')) return 'camera'
  if (text.includes('speaker')) return 'speaker'
  if (text.includes('book')) return 'book'
  if (text.includes('folder') || text.includes('file')) return 'folder'
  if (text.includes('frame') || text.includes('picture')) return 'frame'
  return 'other'
}

function normalizeProp(value: unknown, index: number, bounds: RoomAssetBounds): RoomAssetProp | null {
  if (!isRecord(value)) return null
  const label = normalizeText(value.label ?? value.title, `Prop ${index + 1}`)
  const position = clampToBounds(
    normalizePoint(value.position, {
      x: bounds.origin.x,
      y: bounds.origin.y,
      z: bounds.origin.z,
    }),
    bounds,
  )
  return {
    id: normalizeText(value.id, `prop-${index + 1}`),
    label,
    summary: normalizeText(value.summary, 'A movable room prop.'),
    kind: normalizePropKind(value.kind, label),
    position,
    size: normalizeSize(value.size, { width: 0.45, depth: 0.45, height: 0.45 }),
    locusId: normalizeOptionalText(value.locusId),
    mediaSurfaceIds: normalizeStrings(value.mediaSurfaceIds),
    tags: normalizeStrings(value.tags),
  }
}

function normalizeMediaSurfaceKind(value: unknown, label: string): RoomAssetMediaSurfaceKind {
  const text = normalizeOptionalText(value)?.toLowerCase() ?? label.toLowerCase()
  if (text.includes('panel')) return 'panel'
  if (text.includes('window')) return 'window'
  if (text.includes('projection') || text.includes('projector')) return 'projection'
  if (text.includes('camera')) return 'camera'
  if (text.includes('microphone') || text.includes('mic')) return 'microphone'
  if (text.includes('speaker')) return 'speaker'
  return 'screen'
}

function normalizeMediaSurface(
  value: unknown,
  index: number,
  bounds: RoomAssetBounds,
): RoomAssetMediaSurface | null {
  if (!isRecord(value)) return null
  const label = normalizeText(value.label ?? value.title, `Media surface ${index + 1}`)
  const position = clampToBounds(
    normalizePoint(value.position, {
      x: bounds.origin.x,
      y: bounds.origin.y,
      z: bounds.origin.z,
    }),
    bounds,
  )
  return {
    id: normalizeText(value.id, `media-surface-${index + 1}`),
    label,
    summary: normalizeText(value.summary, 'A native media surface in the room.'),
    kind: normalizeMediaSurfaceKind(value.kind, label),
    position,
    size: normalizeSize(value.size, { width: 0.6, depth: 0.15, height: 0.4 }),
    locusId: normalizeOptionalText(value.locusId),
    propIds: normalizeStrings(value.propIds),
    channels:
      normalizeStrings(value.channels).filter((channel): channel is RoomAssetMediaSurface['channels'][number] =>
        channel === 'camera' ||
        channel === 'microphone' ||
        channel === 'speaker' ||
        channel === 'screen' ||
        channel === 'relay' ||
        channel === 'review'
      ),
    active: value.active !== false,
    tags: normalizeStrings(value.tags),
  }
}

function normalizeLocus(value: unknown, index: number, bounds: RoomAssetBounds): RoomAssetLocus | null {
  if (!isRecord(value)) return null
  const label = normalizeText(value.label ?? value.title, `Locus ${index + 1}`)
  const zoneId = normalizeZoneId(value.zoneId ?? value.kind, label)
  const template = canonicalLocusTemplate(zoneId)
  const position = clampToBounds(normalizePoint(value.position, template.position), bounds)
  return {
    id: normalizeText(value.id, `${zoneId}-${index + 1}`),
    zoneId,
    label,
    summary: normalizeText(value.summary, template.summary),
    position,
    size: normalizeSize(value.size, template.size),
    propIds: normalizeStrings(value.propIds),
    portalIds: normalizeStrings(value.portalIds),
    mediaSurfaceIds: normalizeStrings(value.mediaSurfaceIds),
    tags: normalizeStrings(value.tags),
  }
}

function defaultLoci(bounds: RoomAssetBounds): RoomAssetLocus[] {
  return CANONICAL_ROOM_ASSET_LOCI.map((template, index) => ({
    id: `${template.id}-${index + 1}`,
    zoneId: template.id,
    label: template.label,
    summary: template.summary,
    position: clampToBounds(template.position, bounds),
    size: template.size,
    propIds: [],
    portalIds: [],
    mediaSurfaceIds: [],
    tags: [...DEFAULT_LOCUS_TAGS[template.id]],
  }))
}

function defaultPortals(bounds: RoomAssetBounds): RoomAssetPortal[] {
  return [
    {
      id: 'portal-main-door',
      label: 'Main Door',
      summary: 'Primary room threshold for entry and re-entry.',
      kind: 'doorway',
      edge: 'south',
      bounds: {
        x: bounds.origin.x,
        y: bounds.origin.y + bounds.depth / 2 - 0.08,
        width: 1.2,
        height: 2.1,
      },
      target: { kind: 'world', label: 'Hallway' },
      locusId: 'door-2',
      tags: ['entry', 'default'],
    },
    {
      id: 'portal-window-cut',
      label: 'Window Cut',
      summary: 'A view portal for light, review, and outward context.',
      kind: 'window',
      edge: 'east',
      bounds: {
        x: bounds.origin.x + bounds.width / 2 - 0.08,
        y: bounds.origin.y - 0.4,
        width: 1.1,
        height: 1.4,
      },
      target: { kind: 'world', label: 'Outside' },
      locusId: 'future_window-6',
      tags: ['outlook', 'default'],
    },
  ]
}

function defaultProps(bounds: RoomAssetBounds): RoomAssetProp[] {
  const center = bounds.origin
  return [
    {
      id: 'prop-desk',
      label: 'Desk',
      summary: 'The active work surface.',
      kind: 'desk',
      position: { x: center.x + 0.1, y: center.y + 0.15, z: center.z },
      size: { width: 1.6, depth: 0.8, height: 0.75 },
      locusId: 'work_table-4',
      mediaSurfaceIds: ['media-main-screen'],
      tags: ['work', 'default'],
    },
    {
      id: 'prop-chair',
      label: 'Chair',
      summary: 'The operator seat.',
      kind: 'chair',
      position: { x: center.x - 0.55, y: center.y + 0.45, z: center.z },
      size: { width: 0.45, depth: 0.45, height: 0.9 },
      locusId: 'work_table-4',
      mediaSurfaceIds: [],
      tags: ['seating', 'default'],
    },
    {
      id: 'prop-whiteboard',
      label: 'Whiteboard',
      summary: 'Capture planning, signals, and decisions.',
      kind: 'whiteboard',
      position: { x: center.x - 2.0, y: center.y + 0.1, z: center.z },
      size: { width: 1.2, depth: 0.08, height: 0.9 },
      locusId: 'people_wall-3',
      mediaSurfaceIds: ['media-brief-panel'],
      tags: ['planning', 'default'],
    },
    {
      id: 'prop-lamp',
      label: 'Desk Lamp',
      summary: 'Focused light over the work table.',
      kind: 'lamp',
      position: { x: center.x + 0.65, y: center.y + 0.25, z: center.z },
      size: { width: 0.2, depth: 0.2, height: 0.65 },
      locusId: 'evidence_desk-5',
      mediaSurfaceIds: [],
      tags: ['light', 'default'],
    },
  ]
}

function defaultMediaSurfaces(bounds: RoomAssetBounds): RoomAssetMediaSurface[] {
  const center = bounds.origin
  return [
    {
      id: 'media-main-screen',
      label: 'Main Screen',
      summary: 'The desktop projection surface for deep editing.',
      kind: 'screen',
      position: { x: center.x + 1.0, y: center.y + 0.6, z: center.z },
      size: { width: 1.2, depth: 0.08, height: 0.75 },
      locusId: 'control_surface-7',
      propIds: ['prop-desk'],
      channels: ['screen', 'review'],
      active: true,
      tags: ['desktop', 'default'],
    },
    {
      id: 'media-brief-panel',
      label: 'Brief Panel',
      summary: 'A wall-facing review and handoff surface.',
      kind: 'panel',
      position: { x: center.x - 1.55, y: center.y + 0.05, z: center.z },
      size: { width: 1.0, depth: 0.06, height: 0.68 },
      locusId: 'people_wall-3',
      propIds: ['prop-whiteboard'],
      channels: ['screen', 'review', 'relay'],
      active: true,
      tags: ['brief', 'default'],
    },
    {
      id: 'media-phone-relay',
      label: 'Phone Relay',
      summary: 'A compact projection for mobile handoff.',
      kind: 'projection',
      position: { x: center.x + 1.75, y: center.y + 1.0, z: center.z },
      size: { width: 0.55, depth: 0.12, height: 0.9 },
      locusId: 'phone_checkpoint-11',
      propIds: [],
      channels: ['relay', 'review'],
      active: false,
      tags: ['mobile', 'default'],
    },
  ]
}

function buildExtraArtifactProps(labels: readonly string[], bounds: RoomAssetBounds): RoomAssetProp[] {
  const normalized = normalizeStrings(labels)
  return normalized.slice(0, 4).map((label, index) => ({
    id: `artifact-prop-${index + 1}-${slugToken(label, 'artifact')}`,
    label,
    summary: 'A captured artifact or anchored object staged inside the room.',
    kind: index % 2 === 0 ? 'folder' : 'frame',
    position: {
      x: bounds.origin.x + 1.55 - index * 0.5,
      y: bounds.origin.y - 0.2 + index * 0.2,
      z: bounds.origin.z,
    },
    size: { width: 0.34, depth: 0.08, height: 0.26 },
    locusId: index < 2 ? 'evidence_desk-5' : 'archive_shelf-8',
    mediaSurfaceIds: [],
    tags: ['artifact', 'generated'],
  }))
}

function buildContextPortals(labels: readonly string[], bounds: RoomAssetBounds): RoomAssetPortal[] {
  const normalized = normalizeStrings(labels)
  if (normalized.length === 0) return defaultPortals(bounds)

  const edges: Array<RoomAssetPortal['edge']> = ['north', 'east', 'south', 'west']
  return normalized.slice(0, 4).map((label, index) => ({
    id: `portal-${slugToken(label, `room-${index + 1}`)}`,
    label,
    summary: `A portal from this office into ${label}.`,
    kind: 'tunnel',
    edge: edges[index % edges.length],
    bounds: {
      x:
        index % 2 === 0
          ? bounds.origin.x
          : bounds.origin.x + bounds.width / 2 - 0.08,
      y:
        index % 2 === 0
          ? bounds.origin.y + bounds.depth / 2 - 0.08
          : bounds.origin.y - 0.4,
      width: 1.1,
      height: 2.0,
    },
    target: {
      kind: 'room',
      id: slugToken(label, `room-${index + 1}`),
      label,
    },
    locusId: index === 0 ? 'door-2' : 'future_window-6',
    tags: ['generated', 'portal'],
  }))
}

function buildContextLoci(base: readonly RoomAssetLocus[], labels: readonly string[]): RoomAssetLocus[] {
  const normalized = normalizeStrings(labels)
  if (normalized.length === 0) return [...base]

  return base.map((locus, index) => {
    const label = normalized[index]
    if (!label) return locus

    return {
      ...locus,
      label,
      summary: `Mapped memory locus for ${label}.`,
      tags: [...locus.tags, 'mapped'],
    }
  })
}

function buildContextMediaSurfaces(
  base: readonly RoomAssetMediaSurface[],
  input: RoomAssetContextInput,
): RoomAssetMediaSurface[] {
  return base.map((surface, index) => {
    if (index === 0) {
      return {
        ...surface,
        label: normalizeText(input.editLabel, surface.label),
        summary: `Editable desktop forge for ${normalizeText(input.title, 'this room')}.`,
        active: true,
        tags: [...surface.tags, 'edit'],
      }
    }
    if (index === 2) {
      return {
        ...surface,
        label: normalizeText(input.captureLabel, surface.label),
        summary: 'Native capture and mobile relay surface for the room.',
        active: true,
        tags: [...surface.tags, 'capture'],
      }
    }
    return surface
  })
}

function mergeImportedLoci(loci: readonly RoomAssetLocus[], bounds: RoomAssetBounds): RoomAssetLocus[] {
  const normalized = loci.map((locus, index) => normalizeLocus(locus, index, bounds)).filter((locus): locus is RoomAssetLocus => !!locus)
  const importedByZone = new Map<string, RoomAssetLocus>()
  for (const locus of normalized) {
    if (!importedByZone.has(locus.zoneId)) {
      importedByZone.set(locus.zoneId, locus)
    }
  }
  return CANONICAL_ROOM_ASSET_LOCI.map((template, index) => {
    const imported = importedByZone.get(template.id)
    if (imported) return imported
    return {
      id: `${template.id}-${index + 1}`,
      zoneId: template.id,
      label: template.label,
      summary: template.summary,
      position: clampToBounds(template.position, bounds),
      size: template.size,
      propIds: [],
      portalIds: [],
      mediaSurfaceIds: [],
      tags: [...DEFAULT_LOCUS_TAGS[template.id]],
    }
  })
}

function mergeImportedPortals(portals: readonly RoomAssetPortal[], bounds: RoomAssetBounds): RoomAssetPortal[] {
  const normalized = portals.map((portal, index) => normalizePortal(portal, index, bounds)).filter((portal): portal is RoomAssetPortal => !!portal)
  return uniqueById(normalized.length > 0 ? normalized : defaultPortals(bounds))
}

function mergeImportedProps(props: readonly RoomAssetProp[], bounds: RoomAssetBounds): RoomAssetProp[] {
  const normalized = props.map((prop, index) => normalizeProp(prop, index, bounds)).filter((prop): prop is RoomAssetProp => !!prop)
  return uniqueById(normalized.length > 0 ? normalized : defaultProps(bounds))
}

function mergeImportedMediaSurfaces(
  mediaSurfaces: readonly RoomAssetMediaSurface[],
  bounds: RoomAssetBounds,
): RoomAssetMediaSurface[] {
  const normalized = mediaSurfaces
    .map((surface, index) => normalizeMediaSurface(surface, index, bounds))
    .filter((surface): surface is RoomAssetMediaSurface => !!surface)
  return uniqueById(normalized.length > 0 ? normalized : defaultMediaSurfaces(bounds))
}

export function createDefaultOfficeRoomAsset(seed: RoomAssetSeed = {}): RoomAsset {
  const title = normalizeText(seed.title, 'Office')
  const bounds = DEFAULT_BOUNDS
  return {
    metadata: {
      id: normalizeText(seed.id, assetIdFromTitle(title)),
      title,
      summary: normalizeText(seed.summary, 'A canonical office-like room asset seeded from native capture.'),
      roomType: normalizeRoomType(seed.roomType, 'office'),
      editable: true,
      labels: normalizeStrings(seed.labels).length > 0 ? normalizeStrings(seed.labels) : ['room-asset', 'office', 'native-capture'],
      version: 1,
    },
    captureSource: {
      kind: 'native_capture',
      pipeline: 'roomplan',
      device: 'iphone',
      label: 'Native capture seed',
      captureStack: [...DEFAULT_CAPTURE_STACK],
      sourceUri: normalizeOptionalText(seed.sourceUri),
      importedFrom: normalizeOptionalText(seed.importedFrom),
    },
    bounds,
    portals: defaultPortals(bounds),
    loci: defaultLoci(bounds),
    props: defaultProps(bounds),
    mediaSurfaces: defaultMediaSurfaces(bounds),
  }
}

export function normalizeImportedRoomAsset(input: unknown, seed: RoomAssetSeed = {}): RoomAsset {
  const imported = isRecord(input) ? input : {}
  const base = createDefaultOfficeRoomAsset(seed)
  const metadata = isRecord(imported.metadata) ? imported.metadata : imported
  const captureSource = isRecord(imported.captureSource) ? imported.captureSource : imported
  const bounds = normalizeBounds(imported.bounds, base.bounds)
  const lociInput = Array.isArray(imported.loci) ? imported.loci : []
  const portalsInput = Array.isArray(imported.portals) ? imported.portals : []
  const propsInput = Array.isArray(imported.props) ? imported.props : []
  const mediaSurfacesInput = Array.isArray(imported.mediaSurfaces) ? imported.mediaSurfaces : []

  const loci = lociInput.length > 0 ? mergeImportedLoci(lociInput, bounds) : base.loci
  const portals = portalsInput.length > 0 ? mergeImportedPortals(portalsInput, bounds) : base.portals
  const props = propsInput.length > 0 ? mergeImportedProps(propsInput, bounds) : base.props
  const mediaSurfaces = mediaSurfacesInput.length > 0 ? mergeImportedMediaSurfaces(mediaSurfacesInput, bounds) : base.mediaSurfaces

  return {
    metadata: {
      id: normalizeText(metadata.id, base.metadata.id),
      title: normalizeText(metadata.title, base.metadata.title),
      summary: normalizeText(metadata.summary, base.metadata.summary),
      roomType: normalizeRoomType(metadata.roomType, 'custom'),
      editable: metadata.editable !== false,
      labels: normalizeStrings(metadata.labels).length > 0 ? normalizeStrings(metadata.labels) : base.metadata.labels,
      version: normalizeNumber(metadata.version, base.metadata.version, 1),
    },
    captureSource: normalizeCaptureSource(captureSource, seed, true),
    bounds,
    portals,
    loci,
    props,
    mediaSurfaces,
  }
}

export function buildRoomAssetFromSpatialContext(input: RoomAssetContextInput): RoomAsset {
  const title = normalizeText(input.title, 'Office')
  const summary = normalizeText(
    input.summary,
    'A living room asset that can be captured natively, edited deeply, and opened into larger worlds.',
  )
  const baseLabels = normalizeStrings([
    ...(input.memoryLabel ? [input.memoryLabel] : []),
    ...(input.surfaceLabel ? [input.surfaceLabel] : []),
    ...(input.anchorLabels ?? []),
  ])
  const base = createDefaultOfficeRoomAsset({
    title,
    summary,
    roomType: input.roomType ?? 'office',
    labels: baseLabels,
  })
  const artifactProps = buildExtraArtifactProps(input.artifactLabels ?? [], base.bounds)

  return {
    ...base,
    metadata: {
      ...base.metadata,
      title,
      summary,
      roomType: input.roomType ?? base.metadata.roomType,
      labels: baseLabels.length > 0 ? [...new Set(baseLabels)] : base.metadata.labels,
    },
    captureSource: {
      ...base.captureSource,
      label: normalizeText(input.captureLabel, base.captureSource.label),
    },
    portals: buildContextPortals(input.tunnelLabels ?? [], base.bounds),
    loci: buildContextLoci(base.loci, input.locusLabels ?? []),
    props: uniqueById([...base.props, ...artifactProps]),
    mediaSurfaces: buildContextMediaSurfaces(base.mediaSurfaces, input),
  }
}
