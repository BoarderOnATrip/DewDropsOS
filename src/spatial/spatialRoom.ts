import type { MediaRuntimeBlueprint, MediaRuntimeTone } from '../lib/mediaRuntime'
import type { RoomPalaceMapping, RoomPalaceZoneId } from '../world/roomPalace'

export type SpatialRoomZoneId =
  | 'north_star'
  | 'door'
  | 'table'
  | 'wall'
  | 'shelf'
  | 'drawer'
  | 'window'
  | 'floor'
  | 'console'
  | 'checkpoint'
  | 'portal'

export type SpatialRoomNodeKind =
  | 'plaque'
  | 'door'
  | 'desk'
  | 'wall'
  | 'shelf'
  | 'cabinet'
  | 'window'
  | 'console'
  | 'checkpoint'
  | 'portal'

export type SpatialRoomNode = {
  id: string
  zoneId: SpatialRoomZoneId
  kind: SpatialRoomNodeKind
  title: string
  summary: string
  tone: MediaRuntimeTone
  itemCount?: number
}

export type SpatialRoomWalkItem = {
  id: string
  label: string
  tone: MediaRuntimeTone
}

export type SpatialRoomScene = {
  title: string
  subtitle: string
  summary: string
  memoryLabel: string
  captureLabel: string
  editLabel: string
  orchestrationLabel: string
  nodes: SpatialRoomNode[]
  walk: SpatialRoomWalkItem[]
  runtimeLanes: MediaRuntimeBlueprint['lanes']
}

export type SpatialRoomSceneInput = {
  palace: RoomPalaceMapping
  surfaceLabel: string
  memoryLabel: string
  phoneBrief?: string
  desktopBrief?: string
  mediaRuntime: MediaRuntimeBlueprint
}

function zoneTone(palaceTone: RoomPalaceMapping['zones'][number]['tone']): MediaRuntimeTone {
  if (palaceTone === 'ready') return 'ready'
  if (palaceTone === 'attention') return 'attention'
  return 'calm'
}

function zoneNodeMeta(zoneId: RoomPalaceZoneId): { kind: SpatialRoomNodeKind; title: string } {
  switch (zoneId) {
    case 'door':
      return { kind: 'door', title: 'Door' }
    case 'table':
      return { kind: 'desk', title: 'Work Table' }
    case 'wall':
      return { kind: 'wall', title: 'People Wall' }
    case 'shelf':
      return { kind: 'shelf', title: 'Evidence Desk' }
    case 'drawer':
      return { kind: 'cabinet', title: 'Drawer' }
    case 'window':
      return { kind: 'window', title: 'Future Window' }
    case 'floor':
      return { kind: 'desk', title: 'Floor Walk' }
    case 'console':
      return { kind: 'console', title: 'Control Surface' }
  }
}

function floorWalkItems(palace: RoomPalaceMapping): SpatialRoomWalkItem[] {
  const floor = palace.zones.find((zone) => zone.id === 'floor')
  const loci = floor?.items.filter((item) => item.kind === 'locus').slice(0, 4) ?? []
  if (loci.length === 0) {
    return [{ id: 'walk-empty', label: 'Add a locus', tone: 'attention' }]
  }
  return loci.map((item) => ({
    id: item.id,
    label: item.label,
    tone: 'ready',
  }))
}

function tunnelCount(palace: RoomPalaceMapping): number {
  return palace.zones
    .find((zone) => zone.id === 'wall')
    ?.items.filter((item) => item.kind === 'tunnel').length ?? 0
}

export function buildSpatialRoomScene(input: SpatialRoomSceneInput): SpatialRoomScene {
  const phoneBrief = input.phoneBrief?.trim() ?? ''
  const desktopBrief = input.desktopBrief?.trim() ?? ''
  const tunnelTotal = tunnelCount(input.palace)

  const nodes: SpatialRoomNode[] = [
    {
      id: 'north-star',
      zoneId: 'north_star',
      kind: 'plaque',
      title: 'North Star',
      summary: input.palace.summary,
      tone: 'ready',
    },
    ...input.palace.zones.map((zone) => {
      const meta = zoneNodeMeta(zone.id)
      return {
        id: `zone-${zone.id}`,
        zoneId: zone.id,
        kind: meta.kind,
        title: meta.title,
        summary: zone.summary,
        tone: zoneTone(zone.tone),
        itemCount: zone.items.length,
      }
    }),
    {
      id: 'phone-checkpoint',
      zoneId: 'checkpoint',
      kind: 'checkpoint',
      title: 'Phone Checkpoint',
      summary:
        phoneBrief || desktopBrief || 'Pin a phone or desktop brief so the room survives device changes.',
      tone: phoneBrief ? 'ready' : 'attention',
    },
    {
      id: 'room-portal',
      zoneId: 'portal',
      kind: 'portal',
      title: tunnelTotal > 0 ? 'Portal arch' : 'Portal stub',
      summary:
        tunnelTotal > 0
          ? `${tunnelTotal} adjacent room${tunnelTotal === 1 ? '' : 's'} can open from this office.`
          : 'Pin a tunnel to let the office open into another room, castle, or kingdom.',
      tone: tunnelTotal > 0 ? 'ready' : 'calm',
    },
  ]

  return {
    title: input.palace.title,
    subtitle: `Walk into ${input.palace.title}`,
    summary: `${input.surfaceLabel} room projection with native capture, editable architecture, and portals into larger worlds.`,
    memoryLabel: input.memoryLabel,
    captureLabel: input.mediaRuntime.captureLabel,
    editLabel: input.mediaRuntime.editLabel,
    orchestrationLabel: input.mediaRuntime.orchestrationLabel,
    nodes,
    walk: floorWalkItems(input.palace),
    runtimeLanes: input.mediaRuntime.lanes,
  }
}
