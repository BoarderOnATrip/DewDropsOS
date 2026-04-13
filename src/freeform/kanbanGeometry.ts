import type { WorkflowCard } from './types'

export function cardDisplayHeight(c: WorkflowCard): number {
  return c.expanded ? c.height : 44
}

/** Kanban strip under the hub + magnetic interaction (world px). */
const KANBAN_GAP = 14
/** Horizontal inset from hub/parent edges; 0 so the lineup matches the anchor width edge-to-edge. */
const KANBAN_INSET = 0
/** Reflow won’t pack more agents per row than fit at this minimum width (matches resize floor). */
const KANBAN_MIN_AGENT_WIDTH = 120
const MAG_GRID = 12
const MAG_EDGE = 16

export function kanbanInnerTrackWidth(anchorWidth: number): number {
  return Math.max(0, anchorWidth - 2 * KANBAN_INSET)
}

/** Largest k such that k agents each ≥ minW fit in track with gaps. */
export function kanbanMaxAgentsPerRow(track: number, gap: number, minW: number): number {
  if (track <= 0) return 1
  const k = Math.floor((track + gap) / (minW + gap))
  return Math.max(1, k)
}

/** Integer widths summing to track − (n−1)·gap (remainder spread across first cells). */
export function distributeKanbanCellWidths(n: number, track: number, gap: number): number[] {
  if (n <= 0) return []
  const gapTotal = (n - 1) * gap
  const totalW = Math.max(0, track - gapTotal)
  const base = Math.floor(totalW / n)
  const extra = totalW - base * n
  return Array.from({ length: n }, (_, i) => base + (i < extra ? 1 : 0))
}

export type KanbanCellLayout = { x: number; y: number; width: number }

/** Equal-fill rows under a hub or parent agent: row span matches anchor width (symmetric insets). */
export function layoutKanbanStrip(
  rowAgents: WorkflowCard[],
  anchorX: number,
  anchorWidth: number,
  anchorContentBottomY: number,
): Map<string, KanbanCellLayout> {
  const track = kanbanInnerTrackWidth(anchorWidth)
  const startX = anchorX + KANBAN_INSET
  let y = anchorContentBottomY + KANBAN_GAP
  const maxPer = kanbanMaxAgentsPerRow(track, KANBAN_GAP, KANBAN_MIN_AGENT_WIDTH)

  const rowCounts: number[] = []
  let rem = rowAgents.length
  while (rem > 0) {
    const k = Math.min(rem, maxPer)
    rowCounts.push(k)
    rem -= k
  }

  const out = new Map<string, KanbanCellLayout>()
  let idx = 0
  for (const rc of rowCounts) {
    const slice = rowAgents.slice(idx, idx + rc)
    idx += rc
    const widths = distributeKanbanCellWidths(rc, track, KANBAN_GAP)
    let x = startX
    let rowH = 0
    for (let i = 0; i < slice.length; i++) {
      const a = slice[i]
      const w = widths[i]
      out.set(a.id, { x, y, width: w })
      rowH = Math.max(rowH, cardDisplayHeight(a))
      x += w + KANBAN_GAP
    }
    y += rowH + KANBAN_GAP
  }
  return out
}

/** Dock strip under a problem hub or a parent agent (subagents). */
export function magneticKanbanDockPosition(
  nx: number,
  ny: number,
  agent: WorkflowCard,
  anchor: WorkflowCard,
  siblings: WorkflowCard[],
): { x: number; y: number } {
  let x = Math.round(nx / MAG_GRID) * MAG_GRID
  let y = Math.round(ny / MAG_GRID) * MAG_GRID
  const ah = cardDisplayHeight(agent)
  const aw = agent.width
  const ph = cardDisplayHeight(anchor)

  const dockY = anchor.y + ph + KANBAN_GAP
  if (Math.abs(y - dockY) <= MAG_EDGE * 2) y = dockY

  const alignLeft = anchor.x + KANBAN_INSET
  if (Math.abs(x - alignLeft) <= MAG_EDGE * 2) x = alignLeft

  for (const s of siblings) {
    const sh = cardDisplayHeight(s)
    if (Math.abs(x - s.x) <= MAG_EDGE) x = s.x
    if (Math.abs(x + aw - (s.x + s.width)) <= MAG_EDGE) x = s.x + s.width - aw
    if (Math.abs(x + aw - s.x) <= MAG_EDGE) x = s.x - aw
    if (Math.abs(x - (s.x + s.width)) <= MAG_EDGE) x = s.x + s.width
    if (Math.abs(y - s.y) <= MAG_EDGE) y = s.y
    if (Math.abs(y + ah - (s.y + sh)) <= MAG_EDGE) y = s.y + sh - ah
    if (Math.abs(y + ah - s.y) <= MAG_EDGE) y = s.y - ah
  }

  return { x, y }
}
