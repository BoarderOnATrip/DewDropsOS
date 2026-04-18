# Native Media Room Stack

This product should not move the main UI onto an RTOS. The product stack should split by job:

- `iPhone capture app`: RoomPlan + ARKit + AVFoundation
- `Desktop forge`: edit the room asset, portals, loci, props, and agent surfaces
- `Local room hub`: Linux media node for camera, microphone, speaker, and local agent routing
- `Ambient edge`: optional Zephyr companions for presence, buttons, beacons, and room cues

## Capture Path

1. Scan a room on iPhone Pro hardware with LiDAR.
2. Produce an editable room asset based on RoomPlan and ARKit scene reconstruction.
3. Attach synchronized media context from AVFoundation capture.
4. Move the room into an editable asset format centered on OpenUSD / USDZ.
5. Open the room in the desktop forge, add portals, drawers, loci, and runtime surfaces.

## Product Direction

- A room is the primary interaction surface.
- A scan is not the end product; it is the seed of a living room asset.
- Portals let one room unfold into other rooms, castles, and larger worlds.
- Camera, microphone, and speaker stay native. The web surface should orchestrate them, not impersonate them.
- The phone projection is for capture, relay, and presence.
- The desktop projection is for deep editing, orchestration, and room design.

## Why This Stack

- `RoomPlan` gives a native Apple room-capture path on supported iPhone and iPad devices.
- `ARKit` provides scene reconstruction and mesh context around the room.
- `AVFoundation` handles camera, microphone, and speaker media flows.
- `OpenUSD / USDZ` is the right asset direction for editable spatial rooms.
- `Linux + PREEMPT_RT` remains the best future fit for a local room hub.
- `Zephyr` is the right future fit for tiny always-on companion nodes.
