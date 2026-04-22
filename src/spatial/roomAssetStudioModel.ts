import type { RoomAsset, RoomAssetLocus, RoomAssetPortal } from './roomAsset'
import type { RoomAssetStudioAsset, RoomAssetTone } from './RoomAssetStudio'

export type RoomAssetStudioBuildOptions = {
  roomLabel?: string
  memoryLabel?: string
  captureLabel?: string
  editLabel?: string
  notes?: readonly string[]
}

function toneFromTags(tags: readonly string[], fallback: RoomAssetTone = 'calm'): RoomAssetTone {
  if (tags.includes('mapped') || tags.includes('generated')) return 'ready'
  if (tags.includes('artifact') || tags.includes('portal') || tags.includes('capture')) return 'attention'
  return fallback
}

function zoneTone(locus: RoomAssetLocus): RoomAssetTone {
  if (locus.zoneId === 'control_surface' || locus.zoneId === 'phone_checkpoint') return 'attention'
  return toneFromTags(locus.tags, 'calm')
}

function portalTargetLabel(portal: RoomAssetPortal): string {
  return portal.target?.label ?? portal.target?.id ?? 'Unassigned target'
}

export function buildRoomAssetStudioAsset(
  asset: RoomAsset,
  options: RoomAssetStudioBuildOptions = {},
): RoomAssetStudioAsset {
  const notes = options.notes?.filter(Boolean) ?? []
  const editSurface = asset.mediaSurfaces.find((surface) => surface.tags.includes('edit'))

  return {
    id: asset.metadata.id,
    title: asset.metadata.title,
    summary: asset.metadata.summary,
    roomLabel: options.roomLabel,
    memoryLabel: options.memoryLabel,
    captureLabel: options.captureLabel ?? asset.captureSource.label,
    editLabel: options.editLabel ?? editSurface?.label,
    zones: asset.loci.map((locus) => ({
      id: locus.zoneId,
      label: locus.label,
      summary: locus.summary,
      tone: zoneTone(locus),
    })),
    portals: asset.portals.map((portal) => ({
      id: portal.id,
      label: portal.label,
      summary: portal.summary,
      target: portalTargetLabel(portal),
      tone: toneFromTags(portal.tags, 'ready'),
    })),
    loci: asset.loci.map((locus) => ({
      id: locus.id,
      label: locus.label,
      summary: locus.summary,
      tone: zoneTone(locus),
    })),
    props: asset.props.map((prop) => ({
      id: prop.id,
      label: prop.label,
      summary: prop.summary,
      tone: toneFromTags(prop.tags),
    })),
    mediaSurfaces: asset.mediaSurfaces.map((surface) => ({
      id: surface.id,
      label: surface.label,
      summary: surface.summary,
      format: surface.kind,
      tone: surface.active ? 'ready' : toneFromTags(surface.tags),
    })),
    notes:
      notes.length > 0
        ? [...notes]
        : [
            `Capture pipeline: ${asset.captureSource.captureStack.join(' -> ')}`,
            `Bounds: ${asset.bounds.width}w x ${asset.bounds.depth}d x ${asset.bounds.height}h`,
          ],
  }
}
