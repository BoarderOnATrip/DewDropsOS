# DewDrops

Interactive **freeform board** for orchestrating problem hubs and agent cards: pan/zoom, drag-to-combine swarms, marquee selection, and local persistence in the browser.

The shipped app surface is the freeform board in [src/freeform](./src/freeform). Older or dormant explorations live under [experiments](./experiments) so they do not read like active product code.

## Run

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Test

```bash
npm test
```

## Controls

- **Pan**: middle mouse, or hold **Space** + drag, or two-finger drag on trackpad
- **Zoom**: pinch, or **⌃ / Ctrl + scroll**
- **Summon agent**: double-click empty canvas
- **Select**: click a card; **⇧** for multi-select; drag on empty area to **marquee**
- **Reset hub**: toolbar — restores the Hedgerows preset and clears **saved** board data (`localStorage`)

Board layout, camera, and card positions are **auto-saved** (debounced) under the key `dewdrops-board-state`.

**Export** downloads a versioned JSON snapshot (same schema as local storage): use it for backups, pasting into issues, or checking boards into git. **Import** replaces the live board after validation so a bad file cannot corrupt state.

## What this is

A **front-end prototype**: no auth, no server sync, no live agent execution. Suitable for demos, design iteration, and as a shell for a future backend.

## Experimental Surfaces

- [experiments/LiquidGlobeView.tsx](./experiments/LiquidGlobeView.tsx) is an archived visual experiment, not part of the live app.
- [experiments/butlerApi.ts](./experiments/butlerApi.ts) is a dormant Butler bridge client sketch. It is not wired into the UI today.

If you revive the Butler bridge client, treat these env vars as local development settings only:

- `VITE_BUTLER_BRIDGE_URL`
- `VITE_BUTLER_BRIDGE_TOKEN`

`VITE_*` values are bundled into the client. Do not use a long-lived production secret here.

## Next steps (if “going real”)

- Account + cloud persistence (or team sync)
- Real-time agent / run integration and audit trail
- Automated tests for interaction and layout helpers
- Accessibility pass (keyboard-first canvas, ARIA live regions for status)
