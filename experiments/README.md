## Experiments

This directory holds non-shipping DewDrops Swarm OS experiments and dormant integration sketches.

Current contents:

- `LiquidGlobeView.tsx`
  Archived visual experiment. Not mounted by the app.
- `butlerApi.ts`
  Optional Butler bridge client draft. Not imported by the live board.

Rules for this directory:

- Nothing here should be treated as part of the current product unless it is explicitly wired into [src/App.tsx](../src/App.tsx).
- If a file here needs production attention, move it back into `src/` only when the UI actually depends on it.
- If you use `VITE_BUTLER_BRIDGE_URL` or `VITE_BUTLER_BRIDGE_TOKEN`, treat them as dev-only values. `VITE_*` variables are exposed in the client bundle.
