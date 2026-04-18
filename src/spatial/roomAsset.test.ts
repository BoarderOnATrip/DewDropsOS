import { describe, expect, it } from 'vitest'
import {
  CANONICAL_ROOM_ASSET_LOCI,
  buildRoomAssetFromSpatialContext,
  createDefaultOfficeRoomAsset,
  normalizeImportedRoomAsset,
} from './roomAsset'

describe('roomAsset', () => {
  it('builds a default office room asset with canonical loci', () => {
    const asset = createDefaultOfficeRoomAsset({
      title: 'Founder Office',
      summary: 'A remembered founder room.',
    })

    expect(asset.metadata.title).toBe('Founder Office')
    expect(asset.metadata.editable).toBe(true)
    expect(asset.captureSource.pipeline).toBe('roomplan')
    expect(asset.loci).toHaveLength(CANONICAL_ROOM_ASSET_LOCI.length)
    expect(asset.portals.map((portal) => portal.label)).toEqual(['Main Door', 'Window Cut'])
    expect(asset.mediaSurfaces.map((surface) => surface.label)).toContain('Main Screen')
  })

  it('normalizes imported assets and restores missing canonical loci', () => {
    const asset = normalizeImportedRoomAsset({
      metadata: {
        title: 'Imported Room',
        summary: 'Imported scan',
      },
      bounds: {
        width: 8,
        depth: 5,
        height: 3,
        origin: { x: 0, y: 0, z: 0 },
      },
      loci: [
        {
          id: 'north-star',
          zoneId: 'north_star',
          label: 'Mission plaque',
          summary: 'Imported mission anchor.',
          position: { x: 0, y: -1, z: 0 },
          size: { width: 0.6, depth: 0.2, height: 0.2 },
          propIds: [],
          portalIds: [],
          mediaSurfaceIds: [],
          tags: ['imported'],
        },
      ],
    })

    expect(asset.metadata.title).toBe('Imported Room')
    expect(asset.captureSource.kind).toBe('imported')
    expect(asset.bounds.width).toBe(8)
    expect(asset.loci.length).toBe(CANONICAL_ROOM_ASSET_LOCI.length)
    expect(asset.loci.some((locus) => locus.zoneId === 'work_table')).toBe(true)
  })

  it('builds a contextual room asset for capture, editing, and portals', () => {
    const asset = buildRoomAssetFromSpatialContext({
      title: 'Launch Garden',
      summary: 'An operating room for customer work.',
      memoryLabel: 'revenue/launch-garden',
      surfaceLabel: 'Hybrid',
      captureLabel: 'Editable LiDAR room asset',
      editLabel: 'Hybrid room forge',
      locusLabels: ['North Star', 'Entry Threshold', 'People Wall'],
      artifactLabels: ['Launch brief', 'Voice memo'],
      tunnelLabels: ['Retention Vault', 'Earth return'],
      anchorLabels: ['entity/avery'],
    })

    expect(asset.metadata.title).toBe('Launch Garden')
    expect(asset.metadata.labels).toContain('revenue/launch-garden')
    expect(asset.captureSource.label).toBe('Editable LiDAR room asset')
    expect(asset.portals.map((portal) => portal.label)).toEqual(['Retention Vault', 'Earth return'])
    expect(asset.mediaSurfaces[0]?.label).toBe('Hybrid room forge')
    expect(asset.props.some((prop) => prop.label === 'Launch brief')).toBe(true)
  })
})
