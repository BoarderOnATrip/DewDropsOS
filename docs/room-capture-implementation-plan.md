# Room Capture Implementation Plan

This is how the editable room system should be built from here:

## 1. Canonical Room Asset

Make `src/spatial/roomAsset.ts` the canonical editable room model.

- Native capture should land in one asset shape.
- World shell, phone relay, and future desktop forge should all project from that shape.
- The room asset should own:
  - metadata
  - capture source
  - bounds
  - portals
  - loci
  - props
  - media surfaces

## 2. iPhone Capture Target

Build a native iPhone app that does this:

1. Capture room structure with `RoomPlan`.
2. Capture mesh/context with `ARKit`.
3. Capture camera, microphone, and speaker context with `AVFoundation`.
4. Export a normalized room asset payload plus media references.
5. Hand the result to DewDrops / World shell for editing.

The scan is not the final product. It is the seed of the room asset.

## 3. Desktop Forge

The desktop forge should edit the room asset directly.

- portals
- locus placement
- props
- media surfaces
- room notes
- tunnel routing

The current `RoomAssetStudio` is the first UI surface for this.

## 4. Shared Projections

All projections should be adapters over the same room asset:

- `SpatialRoomStage`: fast visual room projection
- `RoomAssetStudio`: editable room projection
- `Phone relay`: compact pocket projection
- `World shell`: Earth / Wing / Room navigation

## 5. Local Media Runtime

Keep camera, mic, and speaker native.

- iPhone handles capture
- desktop handles deep editing
- a future local room hub handles low-latency routing
- tiny companion nodes can sit on Zephyr later

## 6. Next Build Steps

1. Build the actual iPhone capture target.
2. Import real scan payloads into `roomAsset.ts`.
3. Make `SpatialRoomStage` derive from the room asset instead of a separate scene builder.
4. Make the phone relay consume the same room asset directly.
5. Add save/load for room assets and portal graph editing.
