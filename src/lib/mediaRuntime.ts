export type MediaRuntimeTone = 'ready' | 'attention' | 'calm'

export type MediaRuntimeCapability =
  | 'camera'
  | 'lidar'
  | 'microphone'
  | 'speaker'
  | 'spatial_mesh'
  | 'room_editing'
  | 'playback'
  | 'streaming'
  | 'presence'

export type MediaRuntimeLaneId =
  | 'iphone_capture'
  | 'desktop_forge'
  | 'local_room_hub'
  | 'ambient_edge'

export type MediaRuntimeLane = {
  id: MediaRuntimeLaneId
  label: string
  platform: string
  summary: string
  tone: MediaRuntimeTone
  capabilities: MediaRuntimeCapability[]
}

export type MediaRuntimeBlueprint = {
  title: string
  summary: string
  captureLabel: string
  editLabel: string
  orchestrationLabel: string
  captureStack: string[]
  lanes: MediaRuntimeLane[]
}

export type MediaRuntimeBlueprintInput = {
  roomTitle?: string
  surfaceLabel?: string
  hasPhoneBrief?: boolean
  hasDesktopBrief?: boolean
  hasLoci?: boolean
  wantsAmbientMesh?: boolean
}

function normalize(value: string | undefined): string {
  return value?.trim() ?? ''
}

export function buildMediaRuntimeBlueprint(
  input: MediaRuntimeBlueprintInput = {},
): MediaRuntimeBlueprint {
  const roomTitle = normalize(input.roomTitle) || 'room'
  const surfaceLabel = normalize(input.surfaceLabel) || 'Hybrid'
  const hasPhoneBrief = !!input.hasPhoneBrief
  const hasDesktopBrief = !!input.hasDesktopBrief
  const hasLoci = !!input.hasLoci
  const wantsAmbientMesh = input.wantsAmbientMesh !== false

  const lanes: MediaRuntimeLane[] = [
    {
      id: 'iphone_capture',
      label: 'iPhone capture',
      platform: 'RoomPlan + ARKit + AVFoundation',
      summary:
        'Scan the room with LiDAR, record camera and microphone context, and emit a native room asset.',
      tone: hasPhoneBrief ? 'ready' : 'attention',
      capabilities: ['camera', 'lidar', 'microphone', 'spatial_mesh', 'streaming'],
    },
    {
      id: 'desktop_forge',
      label: 'Desktop forge',
      platform: 'Editable room studio',
      summary:
        'Tune portals, props, loci, and agent surfaces without flattening the room back into folders.',
      tone: hasDesktopBrief ? 'ready' : 'attention',
      capabilities: ['room_editing', 'playback', 'speaker', 'streaming'],
    },
    {
      id: 'local_room_hub',
      label: 'Local room hub',
      platform: 'Linux media node',
      summary:
        'Route low-latency camera, microphone, and speaker streams into local agent runtimes and room memory.',
      tone: hasLoci ? 'ready' : 'calm',
      capabilities: ['camera', 'microphone', 'speaker', 'streaming', 'presence'],
    },
    {
      id: 'ambient_edge',
      label: 'Ambient edge',
      platform: 'Zephyr companion nodes',
      summary:
        'Small always-on companions for presence, buttons, beacons, and spatial cues around the room.',
      tone: wantsAmbientMesh ? 'calm' : 'attention',
      capabilities: ['presence', 'speaker'],
    },
  ]

  return {
    title: 'Native media runtime',
    summary: `Capture ${roomTitle} on iPhone, refine it on desktop, and keep media orchestration local to the room.`,
    captureLabel: 'Editable LiDAR room asset',
    editLabel: `${surfaceLabel} room forge`,
    orchestrationLabel: 'Camera, microphone, and speaker stay native',
    captureStack: [
      'RoomPlan capture',
      'ARKit scene mesh',
      'AVFoundation media stream',
      'OpenUSD room asset',
    ],
    lanes,
  }
}
