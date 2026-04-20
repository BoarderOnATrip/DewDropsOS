import { describe, expect, it } from 'vitest'
import { buildMediaRuntimeBlueprint } from '../lib/mediaRuntime'
import { buildRoomPalaceMapping } from '../world/roomPalace'
import { buildSpatialRoomScene } from './spatialRoom'

describe('buildSpatialRoomScene', () => {
  it('turns a palace mapping into an office-like room scene', () => {
    const palace = buildRoomPalaceMapping({
      title: 'Founder office',
      summary: 'Keep the company memory visible.',
      actors: ['Tyler', 'Codex'],
      loci: ['Desk edge', 'Back shelf'],
      artifacts: ['Voice memo'],
      tunnels: ['Castle corridor'],
      anchors: ['entity/tyler'],
      briefs: ['Phone relay brief'],
      openQuestions: ['Need more portals?'],
      latestRun: 'Run-9',
    })

    const scene = buildSpatialRoomScene({
      palace,
      surfaceLabel: 'Hybrid',
      memoryLabel: 'founder/office',
      phoneBrief: 'Capture and relay the room.',
      desktopBrief: 'Edit the room deeply.',
      mediaRuntime: buildMediaRuntimeBlueprint({
        roomTitle: 'Founder office',
        surfaceLabel: 'Hybrid',
        hasPhoneBrief: true,
        hasDesktopBrief: true,
        hasLoci: true,
      }),
    })

    expect(scene.subtitle).toBe('Walk into Founder office')
    expect(scene.captureLabel).toBe('Editable LiDAR room asset')
    expect(scene.nodes.map((node) => node.zoneId)).toEqual(
      expect.arrayContaining([
        'north_star',
        'door',
        'table',
        'wall',
        'shelf',
        'compartment',
        'window',
        'floor',
        'console',
        'checkpoint',
        'portal',
      ]),
    )
    expect(scene.walk.map((item) => item.label)).toEqual(['Desk edge', 'Back shelf'])
    expect(scene.nodes.find((node) => node.zoneId === 'portal')?.tone).toBe('ready')
  })

  it('creates an attention walk when no loci are present', () => {
    const palace = buildRoomPalaceMapping({
      title: 'Empty room',
      summary: 'Add some structure.',
    })

    const scene = buildSpatialRoomScene({
      palace,
      surfaceLabel: 'Desktop',
      memoryLabel: 'empty/room',
      mediaRuntime: buildMediaRuntimeBlueprint({ roomTitle: 'Empty room' }),
    })

    expect(scene.walk).toEqual([{ id: 'walk-empty', label: 'Add a locus', tone: 'attention' }])
    expect(scene.nodes.find((node) => node.zoneId === 'portal')?.title).toBe('Portal opening')
  })
})
