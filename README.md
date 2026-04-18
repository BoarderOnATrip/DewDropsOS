# DewDrops

Interactive **freeform board** for orchestrating problem hubs and agent cards: pan/zoom, drag-to-combine swarms, marquee selection, local persistence in the browser, and optional swarm launch into a local Butler bridge.

The shipped app surface is the freeform board in [src/freeform](./src/freeform). Older or dormant explorations live under [experiments](./experiments) so they do not read like active product code.

The app now also includes a first `World OS` shell in [src/world](./src/world): an Earth -> Wing -> Actor -> Room entry surface that frames DewDrops as a spatial operating system instead of a board-only tool. The higher-level product direction is captured in [docs/world-os.md](./docs/world-os.md).

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

## AI / multi-agent contributors

If **Cursor** and **Codex** (or any two agents) both touch this tree, read **[`AGENTS.md`](./AGENTS.md)** for an explicit file-level work split. Product sync rules for Butler ↔ DewDrops live in the repo root **[`BOUNDARY_SPEC.md`](../BOUNDARY_SPEC.md)**.

## Butler bridge prototype

If Butler-os is running its local bridge on `http://127.0.0.1:8765`, the toolbar exposes a small swarm launcher:

- select one problem bubble
- review or edit the generated swarm objective
- choose a template
- launch into Butler
- inspect recent runs for the selected room

For local browser development, the Butler bridge accepts `localhost` requests without a manual token unless local token enforcement has been explicitly enabled. DewDrops persists any bridge URL/token you enter in browser storage.

## Surface Routes

- `/` opens the World OS shell
- `/?surface=desktop` opens the board directly
- `/?surface=phone` opens the phone relay

## What this is

A **desktop prototype with a live local execution seam**. The board is still local-first, but it can now launch Butler swarms when a compatible local bridge is available. It is suitable for demos, design iteration, and early operator workflows.

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
