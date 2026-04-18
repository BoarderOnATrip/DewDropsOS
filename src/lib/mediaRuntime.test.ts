import { describe, expect, it } from 'vitest'
import { buildMediaRuntimeBlueprint } from './mediaRuntime'

describe('buildMediaRuntimeBlueprint', () => {
  it('builds the native capture and editing lanes for a room', () => {
    const blueprint = buildMediaRuntimeBlueprint({
      roomTitle: 'Tyler office',
      surfaceLabel: 'Hybrid',
      hasPhoneBrief: true,
      hasDesktopBrief: true,
      hasLoci: true,
    })

    expect(blueprint.captureLabel).toBe('Editable LiDAR room asset')
    expect(blueprint.editLabel).toBe('Hybrid room forge')
    expect(blueprint.captureStack).toEqual([
      'RoomPlan capture',
      'ARKit scene mesh',
      'AVFoundation media stream',
      'OpenUSD room asset',
    ])
    expect(blueprint.lanes.map((lane) => lane.id)).toEqual([
      'iphone_capture',
      'desktop_forge',
      'local_room_hub',
      'ambient_edge',
    ])
    expect(blueprint.lanes[0].tone).toBe('ready')
    expect(blueprint.lanes[1].tone).toBe('ready')
    expect(blueprint.lanes[2].capabilities).toContain('speaker')
  })

  it('marks missing briefs as attention signals', () => {
    const blueprint = buildMediaRuntimeBlueprint({
      roomTitle: 'Relay room',
      hasPhoneBrief: false,
      hasDesktopBrief: false,
      hasLoci: false,
      wantsAmbientMesh: false,
    })

    expect(blueprint.lanes[0].tone).toBe('attention')
    expect(blueprint.lanes[1].tone).toBe('attention')
    expect(blueprint.lanes[2].tone).toBe('calm')
    expect(blueprint.lanes[3].tone).toBe('attention')
  })
})
