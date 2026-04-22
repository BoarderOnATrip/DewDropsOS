import { describe, expect, it } from 'vitest'
import { buildRoomAssetFromSpatialContext } from './roomAsset'
import { buildRoomAssetStudioAsset } from './roomAssetStudioModel'

describe('buildRoomAssetStudioAsset', () => {
  it('projects a room asset into the room asset studio shape', () => {
    const asset = buildRoomAssetFromSpatialContext({
      title: 'Launch Garden',
      summary: 'A room asset for active customer work.',
      memoryLabel: 'revenue/launch-garden',
      captureLabel: 'Editable LiDAR room asset',
      editLabel: 'Hybrid room forge',
      tunnelLabels: ['Retention Vault'],
      artifactLabels: ['Launch brief'],
      anchorLabels: ['entity/avery'],
    })

    const studio = buildRoomAssetStudioAsset(asset, {
      roomLabel: 'Revenue wing',
      memoryLabel: 'revenue/launch-garden',
    })

    expect(studio.title).toBe('Launch Garden')
    expect(studio.captureLabel).toBe('Editable LiDAR room asset')
    expect(studio.editLabel).toBe('Hybrid room forge')
    expect(studio.zones.some((zone) => zone.label === 'North Star')).toBe(true)
    expect(studio.portals.map((portal) => portal.label)).toEqual(['Retention Vault'])
    expect(studio.props.some((prop) => prop.label === 'Launch brief')).toBe(true)
    expect(studio.notes?.[0]).toMatch(/Capture pipeline:/)
  })
})
