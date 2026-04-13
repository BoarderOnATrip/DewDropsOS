# DewDrops — Cursor vs Codex work split

**Purpose:** Explicit routing so two coding agents do not thrash the same surfaces.  
**Product / sync truth:** See [`../BOUNDARY_SPEC.md`](../BOUNDARY_SPEC.md) (Butler ↔ DewDrops ↔ Lifegirdle). This file is **only** about **who edits what in this repo**.

---

## Default rule

- **One active owner per file per change set.** If both agents need the same file, **sequence**: first merge a refactor that splits concerns, then parallelize.

---

## Cursor (IDE assistant) — preferred ownership

| Area | Rationale |
|------|------------|
| **Pure TS extraction** from `BoardView.tsx` → `src/freeform/*.ts` (layout, overlap, assignment helpers) | Shrinks merge target; easy to test in isolation. *(Done so far: `kanbanGeometry`, `viewportGeometry`, `problemOverlapEjection`, `swarmAgents` + matching `*.test.ts`.)* |
| **Unit tests** (`*.test.ts`), **Vitest** config, **CI** workflows | Keeps Codex free for feature wiring. |
| **ESLint / tsconfig** hygiene that applies repo-wide | Low product opinion, high consistency. |
| **Accessibility** (keyboard, `aria-*`, focus) on existing UI | Incremental, review-friendly patches. |
| **Import/export & persistence** hardening (`persistBoard.ts`, validation, edge cases) | Contract stability; tests lock behavior. |
| **`experiments/README.md`** and **non-shipping** experiment hygiene | Clarifies what is not product. |

**Avoid (unless sequenced after a split):** Large **new product features** that require many new UI flows inside `BoardView.tsx` in the same week Codex is editing it.

---

## Codex (CLI / batch agent) — preferred ownership

| Area | Rationale |
|------|------------|
| **Butler bridge integration** — UI that calls `src/lib/butlerBridge.ts` and the Butler-os swarm runtime | Vertical feature; matches Butler side in `BOUNDARY_SPEC.md`. |
| **New presets**, **card copy**, **in-product ritual text** (handshake, mission hints) | Product voice; touches preset + JSX copy. |
| **Toolbar / panel features** that **add** components (e.g. room picker, swarm launch) **if** Cursor has not scheduled a `BoardView` extraction that week | Ship vertical slices quickly. |
| **`README.md`** product narrative, `.env.example` for bridge vars | Onboarding for Butler users. |

**Avoid:** Rewriting **large pure-math** sections without tests — pair with Cursor adding tests in the same PR, or add tests in the same change set.

---

## `src/freeform/BoardView.tsx` (~2k lines)

**Hot zone.** Parallel edits here cause painful merges.

- **Cursor** should **reduce** this file (extract hooks, `WorkflowCardView`, math modules) **before** or **instead of** Codex growing it further.
- **Codex** should **prefer new files** (`src/freeform/components/*`, `src/freeform/hooks/*`) and **thin imports** into `BoardView` over pasting hundreds of lines inline.

If both must touch `BoardView` in one iteration: **Codex** takes **toolbar + new panels**; **Cursor** takes **extract + tests** in the **same PR with agreed order** (extract first, then feature), or **stop one agent** until the other lands.

---

## `experiments/`

- **Not shipped** unless imported from `src/App.tsx` (see `experiments/README.md`).
- **Codex:** Butler client drafts, archived visuals — OK to extend here first.
- **Cursor:** Keep README accurate; optionally add lint/tsconfig **ignore** if experiments break strict rules (prefer fixing experiments over weakening `src/`).

---

## Checks before merge (either agent)

- `npm run lint`
- `npm test`
- `npm run build`

---

## Revision

Butler bridge integration now lives in **`src/lib/butlerBridge.ts`**. If `BoardView` gets split into smaller modules, narrow the hot-zone rule accordingly and reassign ownership by file instead of by feature band.
