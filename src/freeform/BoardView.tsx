import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { flushSync } from 'react-dom'
import type { BoardCamera, BoardWire, WorkflowCard } from './types'
import { hedgerowsDeltaSquadCards, hedgerowsPresetAgentCount } from './presets/hedgerowsDeltaSquad'
import {
  ButlerBridgeError,
  createSwarmContract,
  getButlerBridgeHealth,
  launchSwarmContract,
  listSwarmRuns,
  loadButlerBridgeSettings,
  pairLocalBridge,
  saveButlerBridgeSettings,
  type ButlerBridgeHealth,
  type ButlerBridgeSettings,
  type ButlerSwarmRun,
  type ButlerSwarmTemplate,
} from '../lib/butlerBridge'
import {
  clearPersistedBoard,
  inferAgentSummonCount,
  loadPersistedBoard,
  parseBoardJsonString,
  savePersistedBoard,
  stringifyBoard,
  type PersistedBoardV1,
} from './persistBoard'
import './board.css'

let cardId = 0
function newCardId(): string {
  cardId += 1
  return `wf-${cardId}`
}

function cardDisplayHeight(c: WorkflowCard): number {
  return c.expanded ? c.height : 44
}

/** `pointerdown`/`mousedown` target is often a Text node — it has no `.closest`. */
function pointerEventTargetEl(e: { target: EventTarget | null }): Element | null {
  const n = e.target
  if (n instanceof Element) return n
  if (n instanceof Text) return n.parentElement
  return null
}

/**
 * Legacy: used only to infer `problemBase*` when shrinking cards that were inflated by an older
 * swarm-mass rule (width/height += mass × step).
 */
const SWARM_SIZE_DW = 22
const SWARM_SIZE_DH = 14

/** Pixels past the tight union (hub + drops) where an assigned agent may move without detaching. */
const ENVELOPE_STAY_SLACK = 48

/** Visual padding for the drawn water envelope stroke (world px). */
const ENVELOPE_VISUAL_PAD = 12

/** Kanban strip under the hub + magnetic interaction (world px). */
const KANBAN_GAP = 14
/** Horizontal inset from hub/parent edges; 0 so the lineup matches the anchor width edge-to-edge. */
const KANBAN_INSET = 0
/** Reflow won’t pack more agents per row than fit at this minimum width (matches resize floor). */
const KANBAN_MIN_AGENT_WIDTH = 120
const MAG_GRID = 12
const MAG_EDGE = 16

function kanbanInnerTrackWidth(anchorWidth: number): number {
  return Math.max(0, anchorWidth - 2 * KANBAN_INSET)
}

/** Largest k such that k agents each ≥ minW fit in track with gaps. */
function kanbanMaxAgentsPerRow(track: number, gap: number, minW: number): number {
  if (track <= 0) return 1
  const k = Math.floor((track + gap) / (minW + gap))
  return Math.max(1, k)
}

/** Integer widths summing to track − (n−1)·gap (remainder spread across first cells). */
function distributeKanbanCellWidths(n: number, track: number, gap: number): number[] {
  if (n <= 0) return []
  const gapTotal = (n - 1) * gap
  const totalW = Math.max(0, track - gapTotal)
  const base = Math.floor(totalW / n)
  const extra = totalW - base * n
  return Array.from({ length: n }, (_, i) => base + (i < extra ? 1 : 0))
}

type KanbanCellLayout = { x: number; y: number; width: number }

/** Equal-fill rows under a hub or parent agent: row span matches anchor width (symmetric insets). */
function layoutKanbanStrip(
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

function swarmMassForProblem(
  problemId: string,
  cards: WorkflowCard[],
  wires: BoardWire[],
): number {
  return agentsInProblemSwarm(problemId, cards, wires).length
}

/** Root-assigned agents, plus every nested subagent under them (fractal swarm). */
function agentsInProblemSwarm(
  problemId: string,
  cards: WorkflowCard[],
  wires: BoardWire[],
): WorkflowCard[] {
  void wires
  const seen = new Set<string>()
  const out: WorkflowCard[] = []
  const push = (a: WorkflowCard) => {
    if (seen.has(a.id)) return
    seen.add(a.id)
    out.push(a)
  }
  for (const c of cards) {
    if (c.kind === 'agent' && c.assignedToProblemId === problemId) push(c)
  }
  let growing = true
  while (growing) {
    growing = false
    for (const c of cards) {
      if (c.kind !== 'agent' || !c.parentAgentId || seen.has(c.id)) continue
      if (seen.has(c.parentAgentId)) {
        push(c)
        growing = true
      }
    }
  }
  return out
}

function swarmUnionBounds(
  problemId: string,
  cards: WorkflowCard[],
  wires: BoardWire[],
): { minX: number; minY: number; maxX: number; maxY: number } | null {
  const p = cards.find((c) => c.id === problemId && c.kind === 'problem')
  if (!p) return null
  const ph = cardDisplayHeight(p)
  let minX = p.x
  let minY = p.y
  let maxX = p.x + p.width
  let maxY = p.y + ph
  for (const a of agentsInProblemSwarm(problemId, cards, wires)) {
    const h = cardDisplayHeight(a)
    minX = Math.min(minX, a.x)
    minY = Math.min(minY, a.y)
    maxX = Math.max(maxX, a.x + a.width)
    maxY = Math.max(maxY, a.y + h)
  }
  return { minX, minY, maxX, maxY }
}

function expandBounds(
  b: { minX: number; minY: number; maxX: number; maxY: number },
  m: number,
): { minX: number; minY: number; maxX: number; maxY: number } {
  return {
    minX: b.minX - m,
    minY: b.minY - m,
    maxX: b.maxX + m,
    maxY: b.maxY + m,
  }
}

function pointInBounds(
  cx: number,
  cy: number,
  b: { minX: number; minY: number; maxX: number; maxY: number },
): boolean {
  return cx >= b.minX && cx <= b.maxX && cy >= b.minY && cy <= b.maxY
}

/** Hub card stays at its footprint; swarm “surface” is the SVG envelope around hub + boards. */
function normalizeProblemFootprint(cards: WorkflowCard[], wires: BoardWire[]): WorkflowCard[] {
  let changed = false
  const next = cards.map((c) => {
    if (c.kind !== 'problem') return c
    const mass = swarmMassForProblem(c.id, cards, wires)
    const bw =
      c.problemBaseWidth ?? Math.max(120, c.width - mass * SWARM_SIZE_DW)
    const bh =
      c.problemBaseHeight ?? Math.max(80, c.height - mass * SWARM_SIZE_DH)
    if (
      c.width === bw &&
      c.height === bh &&
      c.problemBaseWidth === bw &&
      c.problemBaseHeight === bh
    ) {
      return c
    }
    changed = true
    return { ...c, problemBaseWidth: bw, problemBaseHeight: bh, width: bw, height: bh }
  })
  return changed ? next : cards
}

/** Assigned-only: row(s) under the hub; each row exactly fills hub inner width with equal tiles. */
function reflowHubKanbanLayout(cards: WorkflowCard[], problemId: string): WorkflowCard[] {
  const p = cards.find((c) => c.id === problemId && c.kind === 'problem')
  if (!p) return cards
  const assigned = cards
    .filter(
      (a) => a.kind === 'agent' && a.assignedToProblemId === problemId && !a.parentAgentId,
    )
    .sort((a, b) => {
      if (a.y !== b.y) return a.y - b.y
      if (a.x !== b.x) return a.x - b.x
      return a.id.localeCompare(b.id)
    })
  if (assigned.length === 0) return cards

  const ph = cardDisplayHeight(p)
  const layouts = layoutKanbanStrip(assigned, p.x, p.width, p.y + ph)

  return cards.map((c) => {
    if (c.kind !== 'agent' || c.assignedToProblemId !== problemId || c.parentAgentId) return c
    const pr = layouts.get(c.id)
    if (!pr) return c
    return { ...c, x: pr.x, y: pr.y, width: pr.width }
  })
}

/** Dock strip under a problem hub or a parent agent (subagents). */
function magneticKanbanDockPosition(
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

/** Explicit card.openQuestions plus structural opens (e.g. isolated problem hub). */
function applyReleaseNod(
  list: WorkflowCard[],
  agentId: string,
  which: 'specialist' | 'lead',
): { next: WorkflowCard[]; wireRemove?: { from: string; to: string } } {
  const agent = list.find((c) => c.id === agentId && c.kind === 'agent')
  if (!agent?.assignedToProblemId) return { next: list }

  let next = list.map((c) => {
    if (c.id !== agentId || c.kind !== 'agent') return c
    if (which === 'specialist') {
      return { ...c, releaseNodFromSpecialist: !c.releaseNodFromSpecialist }
    }
    return { ...c, releaseNodFromLead: !c.releaseNodFromLead }
  })

  const a = next.find((c) => c.id === agentId && c.kind === 'agent')
  if (
    !a ||
    a.kind !== 'agent' ||
    !a.assignedToProblemId ||
    !a.releaseNodFromSpecialist ||
    !a.releaseNodFromLead
  ) {
    return { next }
  }

  const pid = a.assignedToProblemId
  const prob = next.find((p) => p.id === pid)
  const recall = `Marble in the pool — recall: last sack was “${prob?.title ?? 'project'}”.`
  next = next.map((c) =>
    c.id === agentId && c.kind === 'agent'
      ? {
          ...c,
          assignedToProblemId: null,
          parentAgentId: null,
          releaseNodFromSpecialist: false,
          releaseNodFromLead: false,
          lastProjectRecall: recall,
        }
      : c,
  )
  return { next, wireRemove: { from: pid, to: agentId } }
}

function openQuestionsForCard(
  card: WorkflowCard,
  cards: WorkflowCard[],
  wires: BoardWire[],
): string[] {
  const ex = (card.openQuestions ?? []).map((s) => s.trim()).filter(Boolean)
  if (card.kind === 'problem') {
    const hasSwarm = agentsInProblemSwarm(card.id, cards, wires).length > 0
    if (!hasSwarm) {
      const structural =
        'No specialists combined with this hub yet — drop in the first agent and let the swarm form.'
      return ex.length > 0 ? [...ex, structural] : [structural]
    }
  }
  return ex
}

function rectIntersectionArea(
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  bx: number,
  by: number,
  bw: number,
  bh: number,
): number {
  const x1 = Math.max(ax, bx)
  const y1 = Math.max(ay, by)
  const x2 = Math.min(ax + aw, bx + bw)
  const y2 = Math.min(ay + ah, by + bh)
  const w = x2 - x1
  const h = y2 - y1
  return w > 0 && h > 0 ? w * h : 0
}

function bestProblemOverlap(
  agent: WorkflowCard,
  problems: WorkflowCard[],
): { id: string; area: number } | null {
  let best: { id: string; area: number } | null = null
  const ah = cardDisplayHeight(agent)
  for (const p of problems) {
    const ph = cardDisplayHeight(p)
    const area = rectIntersectionArea(
      agent.x,
      agent.y,
      agent.width,
      ah,
      p.x,
      p.y,
      p.width,
      ph,
    )
    if (area > 0 && (!best || area > best.area)) best = { id: p.id, area }
  }
  return best
}

function isDescendantAgent(descId: string, ancestorId: string, cards: WorkflowCard[]): boolean {
  let cur: WorkflowCard | undefined = cards.find((c) => c.id === descId && c.kind === 'agent')
  const visited = new Set<string>()
  while (cur && cur.parentAgentId && !visited.has(cur.id)) {
    visited.add(cur.id)
    if (cur.parentAgentId === ancestorId) return true
    const pid = cur.parentAgentId
    cur = cards.find((c) => c.id === pid && c.kind === 'agent')
  }
  return false
}

function wouldCreateParentCycle(childId: string, parentId: string, cards: WorkflowCard[]): boolean {
  if (childId === parentId) return true
  return isDescendantAgent(parentId, childId, cards)
}

function bestParentAgentTarget(agent: WorkflowCard, cards: WorkflowCard[]): { id: string; area: number } | null {
  let best: { id: string; area: number } | null = null
  const ah = cardDisplayHeight(agent)
  for (const o of cards) {
    if (o.kind !== 'agent' || o.id === agent.id) continue
    if (wouldCreateParentCycle(agent.id, o.id, cards)) continue
    const oh = cardDisplayHeight(o)
    const area = rectIntersectionArea(
      agent.x,
      agent.y,
      agent.width,
      ah,
      o.x,
      o.y,
      o.width,
      oh,
    )
    if (area > 0 && (!best || area > best.area)) best = { id: o.id, area }
  }
  return best
}

function agentSubUnionBounds(
  parentAgentId: string,
  cards: WorkflowCard[],
): { minX: number; minY: number; maxX: number; maxY: number } | null {
  const p = cards.find((c) => c.id === parentAgentId && c.kind === 'agent')
  if (!p) return null
  const ph = cardDisplayHeight(p)
  let minX = p.x
  let minY = p.y
  let maxX = p.x + p.width
  let maxY = p.y + ph
  for (const s of cards) {
    if (s.kind !== 'agent' || s.parentAgentId !== parentAgentId) continue
    const h = cardDisplayHeight(s)
    minX = Math.min(minX, s.x)
    minY = Math.min(minY, s.y)
    maxX = Math.max(maxX, s.x + s.width)
    maxY = Math.max(maxY, s.y + h)
  }
  return { minX, minY, maxX, maxY }
}

function reflowSubagentLayout(cards: WorkflowCard[], parentAgentId: string): WorkflowCard[] {
  const p = cards.find((c) => c.id === parentAgentId && c.kind === 'agent')
  if (!p) return cards
  const subs = cards
    .filter((a) => a.kind === 'agent' && a.parentAgentId === parentAgentId)
    .sort((a, b) => {
      if (a.y !== b.y) return a.y - b.y
      if (a.x !== b.x) return a.x - b.x
      return a.id.localeCompare(b.id)
    })
  if (subs.length === 0) return cards

  const ph = cardDisplayHeight(p)
  const layouts = layoutKanbanStrip(subs, p.x, p.width, p.y + ph)

  return cards.map((c) => {
    if (c.kind !== 'agent' || c.parentAgentId !== parentAgentId) return c
    const pr = layouts.get(c.id)
    if (!pr) return c
    return { ...c, x: pr.x, y: pr.y, width: pr.width }
  })
}

function countSubagents(agentId: string, cards: WorkflowCard[]): number {
  return cards.filter((c) => c.kind === 'agent' && c.parentAgentId === agentId).length
}

function descendantHasOpenQuestions(
  agentId: string,
  cards: WorkflowCard[],
  wires: BoardWire[],
): boolean {
  for (const c of cards) {
    if (c.kind !== 'agent' || c.parentAgentId !== agentId) continue
    if (openQuestionsForCard(c, cards, wires).length > 0) return true
    if (descendantHasOpenQuestions(c.id, cards, wires)) return true
  }
  return false
}

function zoomAtPoint(
  cam: BoardCamera,
  vw: number,
  vh: number,
  sx: number,
  sy: number,
  factor: number,
): BoardCamera {
  const z = Math.max(0.12, Math.min(2.8, cam.zoom * factor))
  const worldX = (sx - vw / 2) / cam.zoom + cam.x
  const worldY = (sy - vh / 2) / cam.zoom + cam.y
  return {
    zoom: z,
    x: worldX - (sx - vw / 2) / z,
    y: worldY - (sy - vh / 2) / z,
  }
}

function screenToWorldFlat(
  sx: number,
  sy: number,
  vw: number,
  vh: number,
  cam: BoardCamera,
): { x: number; y: number } {
  return {
    x: (sx - vw / 2) / cam.zoom + cam.x,
    y: (sy - vh / 2) / cam.zoom + cam.y,
  }
}

/** Viewport-axis-aligned marquee → world AABB (handles rotation-free camera). */
function marqueeViewportToWorldAabb(
  vx: number,
  vy: number,
  wv: number,
  hv: number,
  vw: number,
  vh: number,
  cam: BoardCamera,
): { l: number; t: number; r: number; b: number } {
  const pts = [
    screenToWorldFlat(vx, vy, vw, vh, cam),
    screenToWorldFlat(vx + wv, vy, vw, vh, cam),
    screenToWorldFlat(vx + wv, vy + hv, vw, vh, cam),
    screenToWorldFlat(vx, vy + hv, vw, vh, cam),
  ]
  return {
    l: Math.min(...pts.map((p) => p.x)),
    r: Math.max(...pts.map((p) => p.x)),
    t: Math.min(...pts.map((p) => p.y)),
    b: Math.max(...pts.map((p) => p.y)),
  }
}

function cardWorldBounds(c: WorkflowCard): { l: number; t: number; r: number; b: number } {
  const h = cardDisplayHeight(c)
  return { l: c.x, t: c.y, r: c.x + c.width, b: c.y + h }
}

function worldRectsIntersect(
  a: { l: number; t: number; r: number; b: number },
  b: { l: number; t: number; r: number; b: number },
): boolean {
  return !(a.r < b.l || a.l > b.r || a.b < b.t || a.t > b.b)
}

/** World px/sec — cards not in the swarm drift off overlapping problem hubs. */
const PROBLEM_OVERLAP_EJECT_SPEED = 48
/** Tiny gap once overlap resolves so we don’t re-enter next frame. */
const PROBLEM_EJECT_SLACK = 2
/** Slight bias toward horizontal “slide to the side” vs vertical. */
const PROBLEM_EJECT_SIDE_BIAS = 1.12

function swarmAgentIdsForProblem(
  problemId: string,
  cards: WorkflowCard[],
  wires: BoardWire[],
): Set<string> {
  return new Set(agentsInProblemSwarm(problemId, cards, wires).map((a) => a.id))
}

/** Push mover out of fixedBounds along the shorter overlap axis (prefer sideways). */
function problemOverlapEjectDelta(
  mover: WorkflowCard,
  moverX: number,
  moverY: number,
  fixedBounds: { l: number; t: number; r: number; b: number },
  maxStep: number,
): { dx: number; dy: number } {
  const mb = {
    l: moverX,
    t: moverY,
    r: moverX + mover.width,
    b: moverY + cardDisplayHeight(mover),
  }
  if (!worldRectsIntersect(mb, fixedBounds)) return { dx: 0, dy: 0 }
  const ox = Math.min(mb.r, fixedBounds.r) - Math.max(mb.l, fixedBounds.l)
  const oy = Math.min(mb.b, fixedBounds.b) - Math.max(mb.t, fixedBounds.t)
  if (ox <= 0 || oy <= 0) return { dx: 0, dy: 0 }
  const preferSide = ox * PROBLEM_EJECT_SIDE_BIAS <= oy
  if (preferSide) {
    const mcx = (mb.l + mb.r) / 2
    const fcx = (fixedBounds.l + fixedBounds.r) / 2
    const sign = mcx >= fcx ? 1 : -1
    return { dx: sign * Math.min(maxStep, ox + PROBLEM_EJECT_SLACK), dy: 0 }
  }
  const mcy = (mb.t + mb.b) / 2
  const fcy = (fixedBounds.t + fixedBounds.b) / 2
  const sign = mcy >= fcy ? 1 : -1
  return { dx: 0, dy: sign * Math.min(maxStep, oy + PROBLEM_EJECT_SLACK) }
}

function stepProblemOverlapEjection(
  cards: WorkflowCard[],
  wires: BoardWire[],
  dtSec: number,
  draggingIds: ReadonlySet<string>,
): WorkflowCard[] {
  const maxStep = PROBLEM_OVERLAP_EJECT_SPEED * dtSec
  if (maxStep <= 0) return cards

  const problems = cards.filter((c) => c.kind === 'problem')
  if (problems.length === 0) return cards

  const pos = new Map<string, { x: number; y: number }>()
  for (const c of cards) pos.set(c.id, { x: c.x, y: c.y })

  for (const p of problems) {
    if (draggingIds.has(p.id)) continue
    const pb = cardWorldBounds(p)
    const swarm = swarmAgentIdsForProblem(p.id, cards, wires)

    for (const c of cards) {
      if (c.id === p.id) continue
      if (swarm.has(c.id)) continue
      if (draggingIds.has(c.id)) continue

      const cur = pos.get(c.id)!
      const d = problemOverlapEjectDelta(c, cur.x, cur.y, pb, maxStep)
      if (d.dx !== 0 || d.dy !== 0) {
        cur.x += d.dx
        cur.y += d.dy
      }
    }
  }

  let changed = false
  const next = cards.map((c) => {
    const p = pos.get(c.id)!
    if (p.x !== c.x || p.y !== c.y) {
      changed = true
      return { ...c, x: p.x, y: p.y }
    }
    return c
  })
  return changed ? next : cards
}

function touchPairMetrics(
  t0: Touch,
  t1: Touch,
  rect: DOMRect,
): { cx: number; cy: number; dist: number } {
  const x1 = t0.clientX - rect.left
  const y1 = t0.clientY - rect.top
  const x2 = t1.clientX - rect.left
  const y2 = t1.clientY - rect.top
  return {
    cx: (x1 + x2) / 2,
    cy: (y1 + y2) / 2,
    dist: Math.hypot(x2 - x1, y2 - y1),
  }
}

/** Default board = Hedgerows 2.0 Δ squad (virtual company preset). */
const SEED_CARDS: WorkflowCard[] = hedgerowsDeltaSquadCards()

type BootState = { cards: WorkflowCard[]; camera: BoardCamera; wires: BoardWire[] }
let bootStateMemo: BootState | null = null

function getBootStateOnce(): BootState {
  if (!bootStateMemo) {
    const p = loadPersistedBoard()
    bootStateMemo = {
      cards: p?.cards ?? SEED_CARDS,
      camera: p?.camera ?? { x: 0, y: 0, zoom: 1 },
      wires: p?.wires ?? [],
    }
  }
  return bootStateMemo
}

function buildProblemSwarmObjective(problem: WorkflowCard, cards: WorkflowCard[], wires: BoardWire[]): string {
  const sections: string[] = [problem.title.trim()]
  if (problem.mission?.trim()) {
    sections.push(problem.mission.trim())
  }

  const openItems = openQuestionsForCard(problem, cards, wires)
  if (openItems.length > 0) {
    sections.push(`Open questions:\n- ${openItems.join('\n- ')}`)
  }

  const assignedAgents = agentsInProblemSwarm(problem.id, cards, wires)
  if (assignedAgents.length > 0) {
    sections.push(`Current swarm:\n- ${assignedAgents.map((agent) => agent.title).join('\n- ')}`)
  }

  sections.push('Operate from the DewDrops problem room and leave a resumable Butler swarm report.')
  return sections.filter(Boolean).join('\n\n')
}

function swarmRunIsActive(status: string | undefined): boolean {
  return status === 'queued' || status === 'running' || status === 'staged'
}

function formatRunStatus(status: string | undefined): string {
  if (!status) return 'unknown'
  return status.replace(/_/g, ' ')
}

const SWARM_TEMPLATE_OPTIONS: Array<{ value: ButlerSwarmTemplate; label: string }> = [
  { value: 'planning', label: 'Planning' },
  { value: 'build', label: 'Build' },
  { value: 'research', label: 'Research' },
  { value: 'operator', label: 'Operator' },
  { value: 'relationship', label: 'Relationship' },
]

export default function BoardView() {
  const viewportRef = useRef<HTMLDivElement>(null)
  const importFileRef = useRef<HTMLInputElement>(null)
  const [size, setSize] = useState({ w: 960, h: 640 })
  const [camera, setCamera] = useState<BoardCamera>(() => getBootStateOnce().camera)
  const [cards, setCards] = useState<WorkflowCard[]>(() => getBootStateOnce().cards)
  const [wires, setWires] = useState<BoardWire[]>(() => getBootStateOnce().wires)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [handshakeFocus, setHandshakeFocus] = useState<{ agentId: string; problemId: string } | null>(
    null,
  )
  const [boardNotice, setBoardNotice] = useState<{ text: string; tone: 'ok' | 'error' } | null>(null)
  const [bridgeSettings, setBridgeSettings] = useState<ButlerBridgeSettings>(() => loadButlerBridgeSettings())
  const [bridgeHealth, setBridgeHealth] = useState<ButlerBridgeHealth | null>(null)
  const [bridgeBusy, setBridgeBusy] = useState(false)
  const [launchBusy, setLaunchBusy] = useState(false)
  const [recentRuns, setRecentRuns] = useState<ButlerSwarmRun[]>([])
  const [launchTemplate, setLaunchTemplate] = useState<ButlerSwarmTemplate>('planning')
  const [launchObjective, setLaunchObjective] = useState('')

  const cardsRef = useRef(cards)
  const wiresRef = useRef(wires)
  /** Hub overlap ejection pauses while these cards are being dragged or resized. */
  const ejectionDragIdsRef = useRef<Set<string>>(new Set())
  /** Any pointer down on a card — pauses ejection so clicks/drags don’t fight the sim. */
  const suppressOverlapEjectionRef = useRef(false)
  const markUserMovingCard = useCallback((id: string) => {
    ejectionDragIdsRef.current.add(id)
  }, [])
  const beginCardPointerSession = useCallback(() => {
    suppressOverlapEjectionRef.current = true
  }, [])
  const handshakeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const persistBridgeSettings = useCallback((next: ButlerBridgeSettings) => {
    const normalized = saveButlerBridgeSettings(next)
    setBridgeSettings(normalized)
    return normalized
  }, [])

  const fireConnectHandshake = useCallback((agentId: string, problemId: string) => {
    if (handshakeTimerRef.current) clearTimeout(handshakeTimerRef.current)
    setHandshakeFocus({ agentId, problemId })
    handshakeTimerRef.current = setTimeout(() => {
      setHandshakeFocus(null)
      handshakeTimerRef.current = null
    }, 14000)
  }, [])

  useEffect(
    () => () => {
      if (handshakeTimerRef.current) clearTimeout(handshakeTimerRef.current)
    },
    [],
  )

  useEffect(() => {
    const clearEjectionDrag = () => {
      ejectionDragIdsRef.current.clear()
      suppressOverlapEjectionRef.current = false
    }
    window.addEventListener('pointerup', clearEjectionDrag)
    window.addEventListener('pointercancel', clearEjectionDrag)
    return () => {
      window.removeEventListener('pointerup', clearEjectionDrag)
      window.removeEventListener('pointercancel', clearEjectionDrag)
    }
  }, [])

  useEffect(() => {
    let raf = 0
    let last = performance.now()
    const loop = (now: number) => {
      const dt = Math.min(0.055, (now - last) / 1000)
      last = now
      const dragging = new Set(ejectionDragIdsRef.current)
      setCards((prev) => {
        if (suppressOverlapEjectionRef.current || dragging.size > 0) return prev
        const next = stepProblemOverlapEjection(prev, wiresRef.current, dt, dragging)
        return next === prev ? prev : next
      })
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  const swarmLayoutKey = useMemo(() => {
    const agentBits = cards
      .filter((c) => c.kind === 'agent')
      .map((c) => `${c.id}:${c.assignedToProblemId ?? ''}`)
      .sort()
      .join(',')
    const wireBits = wires
      .map((w) => `${w.fromCardId}->${w.toCardId}`)
      .sort()
      .join(',')
    const baseBits = cards
      .filter((c) => c.kind === 'problem')
      .map((p) => `${p.id}:${p.problemBaseWidth ?? ''}:${p.problemBaseHeight ?? ''}`)
      .sort()
      .join(',')
    return `${agentBits}|${wireBits}|${baseBits}`
  }, [cards, wires])

  useEffect(() => {
    /* Footprint reflow when swarm membership / wires change — keep problem hubs sized to mass. */
    setCards((prev) => {
      const next = normalizeProblemFootprint(prev, wires)
      return next === prev ? prev : next
    })
  }, [swarmLayoutKey, wires])

  useEffect(() => {
    const id = window.setTimeout(() => {
      savePersistedBoard(camera, cards, wires)
    }, 500)
    return () => window.clearTimeout(id)
  }, [camera, cards, wires])

  const agentSummon = useRef(inferAgentSummonCount(getBootStateOnce().cards))
  const [isPanning, setIsPanning] = useState(false)
  const [spaceHeld, setSpaceHeld] = useState(false)

  const spaceDown = useRef(false)
  const panRef = useRef<{ pointerId: number; lastX: number; lastY: number } | null>(null)
  /** Marquee selection on empty board (viewport coords). */
  const marqueePointerRef = useRef<{
    pointerId: number
    ox: number
    oy: number
  } | null>(null)
  const [marquee, setMarquee] = useState<{
    x: number
    y: number
    w: number
    h: number
  } | null>(null)
  const sizeRef = useRef(size)
  const cameraRef = useRef(camera)

  useEffect(() => {
    cardsRef.current = cards
    wiresRef.current = wires
    sizeRef.current = size
    cameraRef.current = camera
  }, [cards, wires, size, camera])

  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect()
      setSize({ w: r.width, h: r.height })
    })
    ro.observe(el)
    setSize({ w: el.clientWidth, h: el.clientHeight })
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return
      const t = e.target as HTMLElement
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable) return
      e.preventDefault()
      spaceDown.current = true
      setSpaceHeld(true)
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        spaceDown.current = false
        setSpaceHeld(false)
      }
    }
    window.addEventListener('keydown', onKeyDown, { passive: false })
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Escape') return
      setSelectedIds([])
      setMarquee(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const screenToWorld = useCallback(
    (sx: number, sy: number) => ({
      x: (sx - size.w / 2) / camera.zoom + camera.x,
      y: (sy - size.h / 2) / camera.zoom + camera.y,
    }),
    [camera.x, camera.y, camera.zoom, size.h, size.w],
  )

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault()
      const rect = viewportRef.current?.getBoundingClientRect()
      if (!rect) return
      const sx = e.clientX - rect.left
      const sy = e.clientY - rect.top
      const pinchZoom = e.ctrlKey || e.metaKey
      if (pinchZoom) {
        const factor = Math.exp(-e.deltaY * 0.0022)
        setCamera((c) => zoomAtPoint(c, size.w, size.h, sx, sy, factor))
        return
      }
      setCamera((c) => {
        const panX = (e.shiftKey ? e.deltaY : e.deltaX) / c.zoom
        const panY = (e.shiftKey ? 0 : e.deltaY) / c.zoom
        return { ...c, x: c.x + panX, y: c.y + panY }
      })
    },
    [size.h, size.w],
  )

  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    let pinch: { lastD: number; lastCx: number; lastCy: number } | null = null

    const onTouchStart = (ev: TouchEvent) => {
      if (ev.touches.length === 2) {
        ev.preventDefault()
        const r = el.getBoundingClientRect()
        const m = touchPairMetrics(ev.touches[0], ev.touches[1], r)
        pinch = { lastD: m.dist, lastCx: m.cx, lastCy: m.cy }
      }
    }

    const onTouchMove = (ev: TouchEvent) => {
      if (ev.touches.length !== 2 || !pinch) return
      ev.preventDefault()
      const r = el.getBoundingClientRect()
      const m = touchPairMetrics(ev.touches[0], ev.touches[1], r)
      const factor = m.dist / pinch.lastD
      const { w, h } = sizeRef.current
      setCamera((c) => {
        const c1 = zoomAtPoint(c, w, h, m.cx, m.cy, factor)
        return {
          ...c1,
          x: c1.x + (m.cx - pinch!.lastCx) / c1.zoom,
          y: c1.y + (m.cy - pinch!.lastCy) / c1.zoom,
        }
      })
      pinch = { lastD: m.dist, lastCx: m.cx, lastCy: m.cy }
    }

    const onTouchEnd = (ev: TouchEvent) => {
      if (ev.touches.length < 2) pinch = null
    }

    el.addEventListener('touchstart', onTouchStart, { passive: false })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd)
    el.addEventListener('touchcancel', onTouchEnd)
    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
      el.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [])

  const MARQUEE_MIN = 4

  const onViewportPointerDown = (e: React.PointerEvent) => {
    const el = pointerEventTargetEl(e)
    if (!el) return
    /** React 19 may deliver parent handlers before child stopPropagation runs — never steal card hits. */
    if (el.closest('.freeform-card') || el.closest('[data-board-card]')) return
    /** Grid is pointer-events:none; empty canvas usually hits `.freeform-world` (not the viewport node). */
    const onBoard =
      el === e.currentTarget ||
      el.classList.contains('freeform-grid') ||
      el.classList.contains('freeform-world')
    if (!onBoard) return

    const immediatePan = e.button === 1 || (e.button === 0 && spaceDown.current)
    if (immediatePan) {
      e.preventDefault()
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
      panRef.current = { pointerId: e.pointerId, lastX: e.clientX, lastY: e.clientY }
      setIsPanning(true)
      return
    }

    if (e.button === 0) {
      e.preventDefault()
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
      const rect = viewportRef.current?.getBoundingClientRect()
      if (rect) {
        marqueePointerRef.current = {
          pointerId: e.pointerId,
          ox: e.clientX - rect.left,
          oy: e.clientY - rect.top,
        }
        setMarquee(null)
      }
    }
  }

  const onViewportPointerMove = (e: React.PointerEvent) => {
    if (panRef.current && panRef.current.pointerId === e.pointerId) {
      const dx = e.clientX - panRef.current.lastX
      const dy = e.clientY - panRef.current.lastY
      panRef.current.lastX = e.clientX
      panRef.current.lastY = e.clientY
      setCamera((c) => ({
        ...c,
        x: c.x - dx / c.zoom,
        y: c.y - dy / c.zoom,
      }))
      return
    }

    const mp = marqueePointerRef.current
    if (!mp || mp.pointerId !== e.pointerId) return
    const rect = viewportRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const x0 = Math.min(mp.ox, x)
    const y0 = Math.min(mp.oy, y)
    const w = Math.abs(x - mp.ox)
    const h = Math.abs(y - mp.oy)
    if (w > 1 || h > 1) {
      setMarquee({ x: x0, y: y0, w, h })
    }
  }

  const endViewportPointer = (e: React.PointerEvent) => {
    const mp = marqueePointerRef.current
    if (mp && mp.pointerId === e.pointerId) {
      const rect = viewportRef.current?.getBoundingClientRect()
      if (rect) {
        const x = e.clientX - rect.left
        const y = e.clientY - rect.top
        const x0 = Math.min(mp.ox, x)
        const y0 = Math.min(mp.oy, y)
        const w = Math.abs(x - mp.ox)
        const h = Math.abs(y - mp.oy)
        if (w >= MARQUEE_MIN || h >= MARQUEE_MIN) {
          const { w: vw, h: vh } = sizeRef.current
          const cam = cameraRef.current
          const wr = marqueeViewportToWorldAabb(x0, y0, w, h, vw, vh, cam)
          const hits = cardsRef.current
            .filter((c) => worldRectsIntersect(cardWorldBounds(c), wr))
            .map((c) => c.id)
          flushSync(() => {
            setSelectedIds((prev) =>
              e.shiftKey ? [...new Set([...prev, ...hits])] : hits,
            )
          })
        } else if (!e.shiftKey) {
          flushSync(() => setSelectedIds([]))
        }
      }
      setMarquee(null)
      marqueePointerRef.current = null
    }
    if (panRef.current?.pointerId === e.pointerId) {
      panRef.current = null
      setIsPanning(false)
    }
  }

  const addAgentAt = (wx: number, wy: number) => {
    agentSummon.current += 1
    const n = agentSummon.current
    const w = 176
    const h = 112
    setCards((list) => [
      ...list,
      {
        id: newCardId(),
        x: wx - w / 2,
        y: wy - h / 2,
        width: w,
        height: h,
        title: `Agent ${n}`,
        expanded: true,
        color: '#af52de',
        kind: 'agent',
        assignedToProblemId: null,
        parentAgentId: null,
        management: 'manual',
      },
    ])
  }

  const resolveAgentAssignment = useCallback((agentId: string) => {
    let handshakeProblemId: string | null = null
    setCards((list) => {
      const agent = list.find((c) => c.id === agentId && c.kind === 'agent')
      if (!agent) return list
      const prevPid = agent.assignedToProblemId ?? null
      const prevParent = agent.parentAgentId ?? null
      const problems = list.filter((c) => c.kind === 'problem')
      const wiresNow = wiresRef.current

      const cx = agent.x + agent.width / 2
      const cy = agent.y + cardDisplayHeight(agent) / 2
      const probHit = bestProblemOverlap(agent, problems)
      const parHit = bestParentAgentTarget(agent, list)

      const subSticky =
        !!prevParent &&
        (() => {
          const u = agentSubUnionBounds(prevParent, list)
          return !!(u && pointInBounds(cx, cy, expandBounds(u, ENVELOPE_STAY_SLACK)))
        })()

      let nextParent: string | null
      let nextPid: string | null

      if (subSticky && prevParent) {
        nextParent = prevParent
        const par = list.find((c) => c.id === prevParent && c.kind === 'agent')
        nextPid = par?.assignedToProblemId ?? null
      } else if (prevPid && !prevParent) {
        const union = swarmUnionBounds(prevPid, list, wiresNow)
        if (union && pointInBounds(cx, cy, expandBounds(union, ENVELOPE_STAY_SLACK))) {
          nextPid = prevPid
          nextParent = null
        } else {
          const pArea = probHit?.area ?? 0
          const nArea = parHit?.area ?? 0
          if (pArea === 0 && nArea === 0) {
            nextParent = null
            nextPid = null
          } else if (nArea >= pArea && parHit) {
            nextParent = parHit.id
            const par = list.find((c) => c.id === parHit.id && c.kind === 'agent')
            nextPid = par?.assignedToProblemId ?? null
          } else if (probHit) {
            nextParent = null
            nextPid = probHit.id
          } else {
            nextParent = null
            nextPid = null
          }
        }
      } else {
        const pArea = probHit?.area ?? 0
        const nArea = parHit?.area ?? 0
        if (pArea === 0 && nArea === 0) {
          nextParent = null
          nextPid = null
        } else if (nArea >= pArea && parHit) {
          nextParent = parHit.id
          const par = list.find((c) => c.id === parHit.id && c.kind === 'agent')
          nextPid = par?.assignedToProblemId ?? null
        } else if (probHit) {
          nextParent = null
          nextPid = probHit.id
        } else {
          nextParent = null
          nextPid = null
        }
      }

      if (prevPid === nextPid && prevParent === nextParent) {
        let next = list
        if (nextPid) next = reflowHubKanbanLayout(next, nextPid)
        if (nextParent) next = reflowSubagentLayout(next, nextParent)
        return next
      }

      let next = list.map((c) =>
        c.id === agentId && c.kind === 'agent'
          ? { ...c, assignedToProblemId: nextPid, parentAgentId: nextParent }
          : c,
      )
      const hubs = new Set<string>()
      if (prevPid) hubs.add(prevPid)
      if (nextPid) hubs.add(nextPid)
      const parents = new Set<string>()
      if (prevParent) parents.add(prevParent)
      if (nextParent) parents.add(nextParent)
      for (const hid of hubs) {
        next = reflowHubKanbanLayout(next, hid)
      }
      for (const pid of parents) {
        next = reflowSubagentLayout(next, pid)
      }
      if (prevPid !== nextPid && nextPid) {
        handshakeProblemId = nextPid
      }
      return next
    })
    if (handshakeProblemId) {
      fireConnectHandshake(agentId, handshakeProblemId)
    }
  }, [fireConnectHandshake])

  const onReleaseNod = useCallback((agentId: string, which: 'specialist' | 'lead') => {
    setCards((list) => applyReleaseNod(list, agentId, which).next)
  }, [])

  const resetBoardToPreset = useCallback(() => {
    if (handshakeTimerRef.current) {
      clearTimeout(handshakeTimerRef.current)
      handshakeTimerRef.current = null
    }
    clearPersistedBoard()
    setCards(hedgerowsDeltaSquadCards())
    setCamera({ x: 0, y: 0, zoom: 0.78 })
    setWires([])
    setSelectedIds([])
    setMarquee(null)
    setHandshakeFocus(null)
    agentSummon.current = hedgerowsPresetAgentCount()
  }, [])

  const applyImportedBoard = useCallback((parsed: PersistedBoardV1) => {
    if (handshakeTimerRef.current) {
      clearTimeout(handshakeTimerRef.current)
      handshakeTimerRef.current = null
    }
    setCamera(parsed.camera)
    setCards(parsed.cards)
    setWires(parsed.wires)
    setSelectedIds([])
    setMarquee(null)
    setHandshakeFocus(null)
    agentSummon.current = inferAgentSummonCount(parsed.cards)
    savePersistedBoard(parsed.camera, parsed.cards, parsed.wires)
  }, [])

  const exportBoardJson = useCallback(() => {
    const json = stringifyBoard(camera, cards, wires)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `dewdrops-board-${new Date().toISOString().slice(0, 10)}.json`
    a.rel = 'noopener'
    a.click()
    URL.revokeObjectURL(url)
    setBoardNotice({ text: `Exported ${cards.length} cards`, tone: 'ok' })
  }, [camera, cards, wires])

  const onImportFileChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      e.target.value = ''
      if (!file) return
      const reader = new FileReader()
      reader.onload = () => {
        const text = typeof reader.result === 'string' ? reader.result : null
        if (text === null) {
          setBoardNotice({ text: 'Could not read that file', tone: 'error' })
          return
        }
        const parsed = parseBoardJsonString(text)
        if (!parsed) {
          setBoardNotice({ text: 'Not a valid DewDrops board file (expected v1 JSON)', tone: 'error' })
          return
        }
        applyImportedBoard(parsed)
        setBoardNotice({ text: `Imported ${parsed.cards.length} cards`, tone: 'ok' })
      }
      reader.onerror = () => {
        setBoardNotice({ text: 'Could not read that file', tone: 'error' })
      }
      reader.readAsText(file, 'utf-8')
    },
    [applyImportedBoard],
  )

  useEffect(() => {
    if (!boardNotice) return
    const id = window.setTimeout(() => setBoardNotice(null), 5000)
    return () => window.clearTimeout(id)
  }, [boardNotice])

  const selectedProblems = useMemo(
    () =>
      selectedIds
        .map((id) => cards.find((card) => card.id === id && card.kind === 'problem'))
        .filter((card): card is WorkflowCard => !!card),
    [cards, selectedIds],
  )

  const selectedProblem = selectedProblems.length === 1 ? selectedProblems[0] : null

  const selectedProblemAgents = useMemo(
    () => (selectedProblem ? agentsInProblemSwarm(selectedProblem.id, cards, wires) : []),
    [cards, selectedProblem, wires],
  )

  const selectedProblemDraftKey = useMemo(() => {
    if (!selectedProblem) return ''
    return [
      selectedProblem.id,
      selectedProblem.title,
      selectedProblem.mission ?? '',
      selectedProblem.swarmTemplate ?? '',
      (selectedProblem.openQuestions ?? []).join('|'),
      selectedProblemAgents.map((agent) => `${agent.id}:${agent.title}`).join('|'),
    ].join('::')
  }, [selectedProblem, selectedProblemAgents])

  useEffect(() => {
    if (!selectedProblem) {
      setLaunchObjective('')
      return
    }
    setLaunchTemplate((selectedProblem.swarmTemplate as ButlerSwarmTemplate | undefined) ?? 'planning')
    setLaunchObjective(buildProblemSwarmObjective(selectedProblem, cards, wires))
  }, [cards, selectedProblem, selectedProblemDraftKey, wires])

  const visibleRuns = useMemo(() => {
    if (selectedProblem?.butlerRoomId) {
      const roomRuns = recentRuns.filter((run) => run.room_id === selectedProblem.butlerRoomId)
      if (roomRuns.length > 0) return roomRuns
    }
    return recentRuns.slice(0, 6)
  }, [recentRuns, selectedProblem?.butlerRoomId])

  const refreshRuns = useCallback(
    async (quiet = false) => {
      try {
        const runs = await listSwarmRuns(bridgeSettings, { limit: 12 })
        setRecentRuns(runs)
      } catch (error) {
        if (!quiet) {
          const message = error instanceof Error ? error.message : 'Could not load Butler swarm runs'
          setBoardNotice({ text: message, tone: 'error' })
        }
      }
    },
    [bridgeSettings],
  )

  const refreshBridgeState = useCallback(
    async (quiet = false) => {
      setBridgeBusy(true)
      try {
        const health = await getButlerBridgeHealth(bridgeSettings)
        setBridgeHealth(health)
        await refreshRuns(true)
        if (!quiet) {
          setBoardNotice({
            text: `Butler bridge online at ${bridgeSettings.url}`,
            tone: 'ok',
          })
        }
      } catch (error) {
        setBridgeHealth(null)
        if (!quiet) {
          const message = error instanceof Error ? error.message : 'Could not reach Butler bridge'
          setBoardNotice({ text: message, tone: 'error' })
        }
      } finally {
        setBridgeBusy(false)
      }
    },
    [bridgeSettings, refreshRuns],
  )

  const pairLocalBridgeAction = useCallback(async () => {
    setBridgeBusy(true)
    try {
      const nextSettings = await pairLocalBridge(bridgeSettings)
      setBridgeSettings(nextSettings)
      const health = await getButlerBridgeHealth(nextSettings)
      setBridgeHealth(health)
      await refreshRuns(true)
      setBoardNotice({
        text: `Paired local Butler bridge at ${nextSettings.url}`,
        tone: 'ok',
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not pair with local Butler bridge'
      setBoardNotice({ text: message, tone: 'error' })
    } finally {
      setBridgeBusy(false)
    }
  }, [bridgeSettings, refreshRuns])

  const launchSelectedProblemSwarm = useCallback(async () => {
    if (!selectedProblem) {
      setBoardNotice({ text: 'Select exactly one problem card to launch a Butler swarm.', tone: 'error' })
      return
    }
    if (!launchObjective.trim()) {
      setBoardNotice({ text: 'Swarm objective is empty.', tone: 'error' })
      return
    }

    setLaunchBusy(true)
    try {
      let nextSettings = bridgeSettings
      const isLocalBridge = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(bridgeSettings.url.trim())
      if (!nextSettings.token.trim() && isLocalBridge) {
        nextSettings = await pairLocalBridge(bridgeSettings)
        setBridgeSettings(nextSettings)
      }

      const contract = await createSwarmContract(nextSettings, {
        title: selectedProblem.title,
        objective: launchObjective.trim(),
        template: launchTemplate,
        room_id: selectedProblem.butlerRoomId,
        room_kind: 'project',
        target: 'local_desktop',
        launcher: 'desktop',
        metadata: {
          dewdrops_problem_id: selectedProblem.id,
          selected_agent_count: selectedProblemAgents.length,
          selected_agent_ids: selectedProblemAgents.map((agent) => agent.id),
        },
        source_refs: [`dewdrops/cards/${selectedProblem.id}`],
        created_by: 'dewdrops',
      })
      const launched = await launchSwarmContract(nextSettings, contract.id)
      const runId = launched.run?.id ?? launched.run?.run_id ?? ''

      setCards((list) =>
        list.map((card) =>
          card.id === selectedProblem.id
            ? {
                ...card,
                butlerRoomId: contract.room_id,
                lastSwarmContractId: contract.id,
                lastSwarmRunId: runId || card.lastSwarmRunId,
                swarmTemplate: launchTemplate,
              }
            : card,
        ),
      )
      await refreshRuns(true)
      setBoardNotice({
        text: `Launched Butler swarm for “${selectedProblem.title}”`,
        tone: 'ok',
      })
    } catch (error) {
      const message =
        error instanceof ButlerBridgeError || error instanceof Error
          ? error.message
          : 'Could not launch Butler swarm'
      setBoardNotice({ text: message, tone: 'error' })
    } finally {
      setLaunchBusy(false)
    }
  }, [bridgeSettings, launchObjective, launchTemplate, refreshRuns, selectedProblem, selectedProblemAgents])

  useEffect(() => {
    void refreshBridgeState(true)
  }, [refreshBridgeState])

  useEffect(() => {
    if (!recentRuns.some((run) => swarmRunIsActive(run.status))) return
    const id = window.setInterval(() => {
      void refreshRuns(true)
    }, 4000)
    return () => window.clearInterval(id)
  }, [recentRuns, refreshRuns])

  const onViewportDoubleClick = (e: React.MouseEvent) => {
    const el = pointerEventTargetEl(e)
    if (el?.closest('.freeform-card')) return
    const rect = viewportRef.current?.getBoundingClientRect()
    if (!rect) return
    const sx = e.clientX - rect.left
    const sy = e.clientY - rect.top
    const { x, y } = screenToWorld(sx, sy)
    addAgentAt(x, y)
  }

  const worldTransform = `translate(${size.w / 2}px, ${size.h / 2}px) scale(${camera.zoom}) translate(${-camera.x}px, ${-camera.y}px)`

  const totalOpenQuestionCount = useMemo(
    () =>
      cards.reduce((acc, c) => acc + openQuestionsForCard(c, cards, wires).length, 0),
    [cards, wires],
  )

  const engagedAgentCount = useMemo(
    () => cards.filter((c) => c.kind === 'agent' && !!c.assignedToProblemId).length,
    [cards],
  )

  const availableAgentCount = useMemo(
    () => cards.filter((c) => c.kind === 'agent' && !c.assignedToProblemId && !c.parentAgentId).length,
    [cards],
  )

  return (
    <div className="freeform-root">
      <header className="freeform-toolbar freeform-toolbar--minimal">
        <div className="freeform-toolbar-meta">
          <h1>DewDrops</h1>
          <p>Double-click empty space to summon an agent. Drag agents into a problem to form a swarm.</p>
        </div>
        <div className="freeform-toolbar-actions">
          <button
            type="button"
            className="freeform-btn freeform-btn--tool is-active"
            title="Select and move cards — drag on empty canvas to marquee"
            onClick={() => {
              viewportRef.current?.focus()
            }}
          >
            Select
          </button>
          <button
            type="button"
            className="freeform-btn freeform-btn--tool"
            title="Restore the Hedgerows preset and clear saved board data from this browser"
            onClick={resetBoardToPreset}
          >
            Reset hub
          </button>
          <button
            type="button"
            className="freeform-btn freeform-btn--tool"
            title="Download the current board as JSON (backup, git, or share)"
            onClick={exportBoardJson}
          >
            Export
          </button>
          <button
            type="button"
            className="freeform-btn freeform-btn--tool"
            title="Load a board from a DewDrops JSON file"
            onClick={() => importFileRef.current?.click()}
          >
            Import
          </button>
          <input
            ref={importFileRef}
            type="file"
            accept=".json,application/json"
            className="freeform-sr-only"
            aria-label="Import board JSON file"
            onChange={onImportFileChange}
          />
        </div>
        <div className="freeform-toolbar-status" aria-label="Board status">
          <span>{engagedAgentCount} engaged</span>
          <span>{availableAgentCount} available</span>
          <span>{totalOpenQuestionCount} open</span>
        </div>
        <section className="freeform-toolbar-panel" aria-label="Butler swarm launcher">
          <div className="freeform-toolbar-panel-header">
            <div>
              <h2>Butler bridge</h2>
              <p>Launch a real swarm from one selected problem bubble.</p>
            </div>
            <div className="freeform-toolbar-panel-status">
              <span
                className={`freeform-run-pill${bridgeHealth?.ok ? ' is-online' : ' is-offline'}`}
              >
                {bridgeBusy ? 'checking' : bridgeHealth?.ok ? 'online' : 'offline'}
              </span>
              {bridgeHealth?.service ? <span>{bridgeHealth.service}</span> : null}
              {bridgeHealth?.version ? <span>v{bridgeHealth.version}</span> : null}
            </div>
          </div>

          <div className="freeform-toolbar-panel-grid">
            <div className="freeform-toolbar-panel-section">
              <label className="freeform-field">
                <span>Bridge URL</span>
                <input
                  type="url"
                  value={bridgeSettings.url}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => {
                    persistBridgeSettings({ ...bridgeSettings, url: e.target.value })
                  }}
                  placeholder="http://127.0.0.1:8765"
                />
              </label>
              <label className="freeform-field">
                <span>Token</span>
                <input
                  type="password"
                  value={bridgeSettings.token}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => {
                    persistBridgeSettings({ ...bridgeSettings, token: e.target.value })
                  }}
                  placeholder="Optional on localhost"
                />
              </label>
              <div className="freeform-toolbar-panel-actions">
                <button
                  type="button"
                  className="freeform-btn freeform-btn--tool"
                  onClick={() => {
                    void pairLocalBridgeAction()
                  }}
                  disabled={bridgeBusy}
                >
                  {bridgeBusy ? 'Pairing…' : 'Pair local'}
                </button>
                <button
                  type="button"
                  className="freeform-btn freeform-btn--tool"
                  onClick={() => {
                    void refreshBridgeState(false)
                  }}
                  disabled={bridgeBusy}
                >
                  Check bridge
                </button>
                <button
                  type="button"
                  className="freeform-btn freeform-btn--tool"
                  onClick={() => {
                    void refreshRuns(false)
                  }}
                  disabled={bridgeBusy}
                >
                  Refresh runs
                </button>
              </div>
              <p className="freeform-toolbar-panel-hint">
                Localhost browser calls can use the local Butler bridge without a manual token.
              </p>
            </div>

            <div className="freeform-toolbar-panel-section">
              <div className="freeform-toolbar-panel-problem">
                <div>
                  <h3>{selectedProblem ? selectedProblem.title : 'No problem selected'}</h3>
                  <p>
                    {selectedProblem
                      ? `${selectedProblemAgents.length} agent${selectedProblemAgents.length === 1 ? '' : 's'} in the swarm envelope`
                      : 'Select exactly one problem bubble to launch a swarm.'}
                  </p>
                </div>
                {selectedProblem?.lastSwarmRunId ? (
                  <span className="freeform-run-pill">
                    Last run {selectedProblem.lastSwarmRunId.slice(-6)}
                  </span>
                ) : null}
              </div>

              <div className="freeform-toolbar-panel-form-row">
                <label className="freeform-field">
                  <span>Template</span>
                  <select
                    value={launchTemplate}
                    onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                      setLaunchTemplate(e.target.value as ButlerSwarmTemplate)
                    }
                    disabled={!selectedProblem || launchBusy}
                  >
                    {SWARM_TEMPLATE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="freeform-field">
                <span>Objective</span>
                <textarea
                  value={launchObjective}
                  onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setLaunchObjective(e.target.value)}
                  placeholder="Describe what this swarm should do."
                  disabled={!selectedProblem || launchBusy}
                  rows={5}
                />
              </label>

              <div className="freeform-toolbar-panel-actions">
                <button
                  type="button"
                  className="freeform-btn freeform-btn--tool is-active"
                  onClick={() => {
                    void launchSelectedProblemSwarm()
                  }}
                  disabled={!selectedProblem || launchBusy}
                >
                  {launchBusy ? 'Launching…' : 'Launch swarm'}
                </button>
              </div>
            </div>

            <div className="freeform-toolbar-panel-section">
              <div className="freeform-toolbar-panel-problem">
                <div>
                  <h3>{selectedProblem?.butlerRoomId ? 'Room runs' : 'Recent runs'}</h3>
                  <p>
                    {selectedProblem?.butlerRoomId
                      ? 'Runs attached to the selected problem room.'
                      : 'Latest runs seen by the Butler bridge.'}
                  </p>
                </div>
              </div>

              {visibleRuns.length > 0 ? (
                <ul className="freeform-run-list">
                  {visibleRuns.map((run) => {
                    const isCurrent = selectedProblem?.lastSwarmRunId === run.id || selectedProblem?.lastSwarmRunId === run.run_id
                    return (
                      <li
                        key={run.id || run.run_id}
                        className={`freeform-run-list-item${isCurrent ? ' is-current' : ''}`}
                      >
                        <div className="freeform-run-list-head">
                          <strong>{run.title}</strong>
                          <span
                            className={`freeform-run-pill${swarmRunIsActive(run.status) ? ' is-active' : ''}`}
                          >
                            {formatRunStatus(run.status)}
                          </span>
                        </div>
                        {run.summary ? <p>{run.summary}</p> : null}
                        <div className="freeform-run-list-meta">
                          <span>{run.run_id || run.id}</span>
                          {run.updated_at ? <span>{run.updated_at.slice(11, 19)} UTC</span> : null}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <p className="freeform-toolbar-panel-hint">No swarm runs yet.</p>
              )}
            </div>
          </div>
        </section>
        {boardNotice ? (
          <p
            className={`freeform-toolbar-notice${boardNotice.tone === 'error' ? ' freeform-toolbar-notice--error' : ''}`}
            role="status"
            aria-live="polite"
          >
            {boardNotice.text}
          </p>
        ) : null}
      </header>

      <div
        ref={viewportRef}
        className={`freeform-viewport${isPanning ? ' is-panning' : ''}${spaceHeld ? ' is-space-down' : ''}`}
        tabIndex={0}
        onWheel={onWheel}
        onPointerDown={onViewportPointerDown}
        onPointerMove={onViewportPointerMove}
        onPointerUp={endViewportPointer}
        onPointerCancel={endViewportPointer}
        onDoubleClick={onViewportDoubleClick}
      >
        {marquee ? (
          <div className="freeform-marquee-layer" aria-hidden>
            <div
              className="freeform-marquee-rect"
              style={{
                left: marquee.x,
                top: marquee.y,
                width: marquee.w,
                height: marquee.h,
              }}
            />
          </div>
        ) : null}
        <div className="freeform-world" style={{ transform: worldTransform }}>
          <div className="freeform-grid" aria-hidden />
          <SwarmEnvelopeLayer cards={cards} wires={wires} />
          {cards.map((c) => (
            <WorkflowCardView
              key={c.id}
              card={c}
              cards={cards}
              wires={wires}
              handshakeFocus={handshakeFocus}
              selected={selectedIds.includes(c.id)}
              camera={camera}
              onSelect={(shiftKey) =>
                flushSync(() => {
                  setSelectedIds((prev) => {
                    if (shiftKey) {
                      if (prev.includes(c.id)) return prev.filter((x) => x !== c.id)
                      return [...prev, c.id]
                    }
                    return [c.id]
                  })
                })
              }
              onMove={(nx, ny) =>
                setCards((list) => {
                  const cur = list.find((x) => x.id === c.id)
                  if (!cur || cur.kind !== 'agent') {
                    return list.map((x) => (x.id === c.id ? { ...x, x: nx, y: ny } : x))
                  }
                  const inSwarm = !!(cur.assignedToProblemId || cur.parentAgentId)
                  if (!inSwarm) {
                    return list.map((x) => (x.id === c.id ? { ...x, x: nx, y: ny } : x))
                  }
                  let anchor: WorkflowCard | undefined
                  let siblings: WorkflowCard[]
                  if (cur.parentAgentId) {
                    anchor = list.find((p) => p.id === cur.parentAgentId && p.kind === 'agent')
                    siblings = list.filter(
                      (a) =>
                        a.kind === 'agent' &&
                        a.parentAgentId === cur.parentAgentId &&
                        a.id !== c.id,
                    )
                  } else if (cur.assignedToProblemId) {
                    const pid = cur.assignedToProblemId
                    anchor = list.find((p) => p.id === pid && p.kind === 'problem')
                    siblings = list.filter(
                      (a) =>
                        a.kind === 'agent' &&
                        a.assignedToProblemId === pid &&
                        !a.parentAgentId &&
                        a.id !== c.id,
                    )
                  } else {
                    return list.map((x) => (x.id === c.id ? { ...x, x: nx, y: ny } : x))
                  }
                  if (!anchor) {
                    return list.map((x) => (x.id === c.id ? { ...x, x: nx, y: ny } : x))
                  }
                  const { x, y } = magneticKanbanDockPosition(nx, ny, cur, anchor, siblings)
                  return list.map((x0) => (x0.id === c.id ? { ...x0, x, y } : x0))
                })
              }
              onResize={(nw, nh) =>
                setCards((list) => {
                  const cur = list.find((x) => x.id === c.id)
                  if (!cur) return list
                  if (cur.kind === 'problem') {
                    let next = list.map((x) =>
                      x.id === c.id
                        ? {
                            ...x,
                            width: nw,
                            height: nh,
                            problemBaseWidth: nw,
                            problemBaseHeight: nh,
                          }
                        : x,
                    )
                    next = reflowHubKanbanLayout(next, c.id)
                    return next
                  }
                  if (cur.kind === 'agent') {
                    let next = list.map((x) =>
                      x.id === c.id ? { ...x, width: nw, height: nh } : x,
                    )
                    const ag = next.find((x) => x.id === c.id && x.kind === 'agent')
                    if (ag?.parentAgentId) {
                      next = reflowSubagentLayout(next, ag.parentAgentId)
                    } else if (ag?.assignedToProblemId) {
                      next = reflowHubKanbanLayout(next, ag.assignedToProblemId)
                    }
                    return next
                  }
                  return list.map((x) => (x.id === c.id ? { ...x, width: nw, height: nh } : x))
                })
              }
              onDragEnd={() => {
                if (c.kind === 'agent') resolveAgentAssignment(c.id)
              }}
              onToggleExpand={() =>
                setCards((list) => {
                  let next = list.map((x) => (x.id === c.id ? { ...x, expanded: !x.expanded } : x))
                  const card = next.find((x) => x.id === c.id)
                  if (card?.kind === 'agent') {
                    if (card.parentAgentId) {
                      next = reflowSubagentLayout(next, card.parentAgentId)
                    } else if (card.assignedToProblemId) {
                      next = reflowHubKanbanLayout(next, card.assignedToProblemId)
                    }
                  }
                  if (card?.kind === 'problem') {
                    next = reflowHubKanbanLayout(next, card.id)
                  }
                  return next
                })
              }
              onReleaseNod={onReleaseNod}
              onMarkUserMovingCard={() => markUserMovingCard(c.id)}
              onCardPointerSession={beginCardPointerSession}
              onMakeAgentReadable={
                c.kind === 'agent'
                  ? () => {
                      const AGENT_READ_MIN_W = 288
                      const AGENT_READ_MIN_H = 272
                      setCards((list) => {
                        let next = list.map((x) =>
                          x.id === c.id && x.kind === 'agent'
                            ? {
                                ...x,
                                expanded: true,
                                width: Math.max(x.width, AGENT_READ_MIN_W),
                                height: Math.max(x.height, AGENT_READ_MIN_H),
                              }
                            : x,
                        )
                        const agent = next.find((x) => x.id === c.id && x.kind === 'agent')
                        if (agent?.parentAgentId) {
                          next = reflowSubagentLayout(next, agent.parentAgentId)
                        } else if (agent?.assignedToProblemId) {
                          next = reflowHubKanbanLayout(next, agent.assignedToProblemId)
                        }
                        return next
                      })
                    }
                  : undefined
              }
            />
          ))}
        </div>
      </div>
    </div>
  )
}

/** Half-size of wire canvas in world px; must cover card positions (paths use same coords as cards). */
const WIRE_CANVAS_EXTENT = 12000

function SwarmEnvelopeLayer({
  cards,
  wires,
}: {
  cards: WorkflowCard[]
  wires: BoardWire[]
}) {
  const problems = cards.filter((c) => c.kind === 'problem')
  const ex = WIRE_CANVAS_EXTENT
  const wh = ex * 2
  return (
    <svg
      className="freeform-envelope-svg"
      aria-hidden
      viewBox={`${-ex} ${-ex} ${wh} ${wh}`}
      preserveAspectRatio="xMinYMin meet"
      width={wh}
      height={wh}
      style={{
        position: 'absolute',
        left: -ex,
        top: -ex,
      }}
    >
      <defs>
        <linearGradient id="freeform-envelope-water" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="rgba(120, 200, 255, 0.14)" />
          <stop offset="45%" stopColor="rgba(255, 120, 110, 0.1)" />
          <stop offset="100%" stopColor="rgba(180, 230, 255, 0.12)" />
        </linearGradient>
      </defs>
      {problems.map((p) => {
        if (swarmMassForProblem(p.id, cards, wires) === 0) return null
        const u = swarmUnionBounds(p.id, cards, wires)
        if (!u) return null
        const pad = ENVELOPE_VISUAL_PAD
        const x = u.minX - pad
        const y = u.minY - pad
        const w = u.maxX - u.minX + pad * 2
        const h = u.maxY - u.minY + pad * 2
        const rx = Math.min(44, w * 0.14, h * 0.14)
        return (
          <rect
            key={p.id}
            className="freeform-swarm-envelope-rect"
            x={x}
            y={y}
            width={w}
            height={h}
            rx={rx}
            ry={rx}
            fill="url(#freeform-envelope-water)"
          />
        )
      })}
    </svg>
  )
}

type CardViewProps = {
  card: WorkflowCard
  cards: WorkflowCard[]
  wires: BoardWire[]
  handshakeFocus: { agentId: string; problemId: string } | null
  selected: boolean
  camera: BoardCamera
  onSelect: (shiftKey?: boolean) => void
  onMove: (x: number, y: number) => void
  onResize: (width: number, height: number) => void
  onDragEnd: () => void
  onToggleExpand: () => void
  onReleaseNod: (agentId: string, which: 'specialist' | 'lead') => void
  /** Agent only: expand + grow body for reading when user clicks the body (not header). */
  onMakeAgentReadable?: () => void
  /** Pause hub overlap ejection while this card is being moved or resized. */
  onMarkUserMovingCard?: () => void
  /** First contact on card — pause overlap sim before drag/selection handlers run. */
  onCardPointerSession?: () => void
}

function OpenQuestionsBlock({ items }: { items: string[] }) {
  if (items.length === 0) return null
  return (
    <div className="freeform-open-questions" role="status" aria-live="polite">
      <div className="freeform-open-questions-title">Open questions — check and steer</div>
      <ul className="freeform-open-questions-list">
        {items.map((q, i) => (
          <li key={i}>{q}</li>
        ))}
      </ul>
    </div>
  )
}

function WorkflowCardView({
  card,
  cards,
  wires,
  handshakeFocus,
  selected,
  camera,
  onSelect,
  onMove,
  onResize,
  onDragEnd,
  onToggleExpand,
  onReleaseNod,
  onMakeAgentReadable,
  onMarkUserMovingCard,
  onCardPointerSession,
}: CardViewProps) {
  const drag = useRef<{ sx: number; sy: number; cx: number; cy: number } | null>(null)
  const resize = useRef<{ sx: number; sy: number; w: number; h: number } | null>(null)
  const agentDragHandleRef = useRef<HTMLDivElement>(null)

  const onAgentBodyPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    const el = pointerEventTargetEl(e)
    if (!el) return
    if (el.closest('button, a, [role="button"]')) return
    e.stopPropagation()
    onMakeAgentReadable?.()
  }

  /** Problem / surface: whole header drags; selection comes from card capture. */
  const onHeaderPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || resize.current) return
    const el = pointerEventTargetEl(e)
    if (!el) return
    e.stopPropagation()
    onCardPointerSession?.()
    onMarkUserMovingCard?.()
    drag.current = { sx: e.clientX, sy: e.clientY, cx: card.x, cy: card.y }
    if (el instanceof HTMLElement) {
      el.setPointerCapture(e.pointerId)
    }
  }

  const onAgentHeaderPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || resize.current) return
    const el = pointerEventTargetEl(e)
    if (!el) return
    e.stopPropagation()
    onCardPointerSession?.()
    onMarkUserMovingCard?.()
    if (el.closest('.freeform-agent-drag-handle') && agentDragHandleRef.current) {
      drag.current = { sx: e.clientX, sy: e.clientY, cx: card.x, cy: card.y }
      agentDragHandleRef.current.setPointerCapture(e.pointerId)
    }
  }

  const selectNow = (shiftKey?: boolean) => {
    flushSync(() => onSelect(shiftKey))
  }

  /** Runs in capture phase so it wins over React 19 root ordering and viewport marquee stealing. */
  const shouldIgnoreSelectTarget = (el: Element | null) => {
    if (!el) return true
    if (el.closest('button, a, [role="button"]')) return true
    if (el.closest('.freeform-card-resize-handle')) return true
    return false
  }

  const onCardPointerDownCapture = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    const el = pointerEventTargetEl(e)
    if (shouldIgnoreSelectTarget(el)) return
    onCardPointerSession?.()
    selectNow(e.shiftKey)
  }

  const onCardMouseDownCapture = (e: React.MouseEvent) => {
    if (e.button !== 0) return
    const el = pointerEventTargetEl(e)
    if (shouldIgnoreSelectTarget(el)) return
    onCardPointerSession?.()
    selectNow(e.shiftKey)
  }

  const onHeaderPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return
    const z = camera.zoom
    const dx = (e.clientX - drag.current.sx) / z
    const dy = (e.clientY - drag.current.sy) / z
    onMove(drag.current.cx + dx, drag.current.cy + dy)
  }

  const onHeaderPointerUp = () => {
    const wasDragging = drag.current !== null
    drag.current = null
    if (wasDragging) onDragEnd()
  }

  const onResizePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    e.stopPropagation()
    onCardPointerSession?.()
    onMarkUserMovingCard?.()
    selectNow(e.shiftKey)
    const h = card.expanded ? card.height : 44
    resize.current = { sx: e.clientX, sy: e.clientY, w: card.width, h }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  const onResizePointerMove = (e: React.PointerEvent) => {
    if (!resize.current) return
    const z = camera.zoom
    const dx = (e.clientX - resize.current.sx) / z
    const dy = (e.clientY - resize.current.sy) / z
    const minW = 120
    if (card.expanded) {
      const minH = 80
      onResize(
        Math.max(minW, resize.current.w + dx),
        Math.max(minH, resize.current.h + dy),
      )
    } else {
      onResize(Math.max(minW, resize.current.w + dx), card.height)
    }
  }

  const onResizePointerUp = () => {
    const wasResizing = resize.current !== null
    resize.current = null
    if (wasResizing) onDragEnd()
  }

  const kindClass =
    card.kind === 'problem' ? ' kind-problem' : card.kind === 'agent' ? ' kind-agent' : ''

  const assignedAgents =
    card.kind === 'problem'
      ? cards.filter(
          (a) => a.kind === 'agent' && a.assignedToProblemId === card.id && !a.parentAgentId,
        )
      : []

  const subagentCount = card.kind === 'agent' ? countSubagents(card.id, cards) : 0
  const subtreeNeedsHelp =
    card.kind === 'agent' && descendantHasOpenQuestions(card.id, cards, wires)

  const assignedClass =
    card.kind === 'agent' && (card.assignedToProblemId || card.parentAgentId)
      ? ' assigned freeform-agent-kanban-dock'
      : ''
  const nestedClass = card.kind === 'agent' && card.parentAgentId ? ' freeform-agent-nested' : ''
  const subtreeClass = subtreeNeedsHelp ? ' freeform-agent-subtree-needs-help' : ''

  const swarmMass =
    card.kind === 'problem' ? swarmMassForProblem(card.id, cards, wires) : 0

  const assignedProblem =
    card.kind === 'agent' && card.assignedToProblemId
      ? cards.find((p) => p.id === card.assignedToProblemId)
      : undefined

  const handshakeProblem = assignedProblem
  const handshakePulse =
    !!handshakeFocus &&
    handshakeFocus.agentId === card.id &&
    handshakeProblem &&
    handshakeFocus.problemId === handshakeProblem.id

  const opens = openQuestionsForCard(card, cards, wires)
  const hasOpenQuestions = opens.length > 0
  const isAgent = card.kind === 'agent'
  const agentQuestionGlow = isAgent && hasOpenQuestions
  /** Blue = pool/prepared, green = in swarm/working, orange = open questions (matches toolbar legend). */
  const agentInSwarm =
    isAgent && !agentQuestionGlow && (!!card.assignedToProblemId || !!card.parentAgentId)
  const agentGlowClass = agentQuestionGlow
    ? ' freeform-agent-glow-questions'
    : agentInSwarm
      ? ' freeform-agent-glow-working'
      : isAgent
        ? ' freeform-agent-glow-prepared'
        : ''
  const swarmLinked = isAgent && (!!card.assignedToProblemId || !!card.parentAgentId)
  const showGlobalOpenFlash = hasOpenQuestions && !isAgent
  const problemBubble = card.kind === 'problem' && card.problemShape === 'bubble'

  const titleFrameClass =
    card.kind === 'agent'
      ? 'freeform-card-title-frame freeform-card-title-frame--agent'
      : card.kind === 'problem'
        ? 'freeform-card-title-frame freeform-card-title-frame--problem'
        : 'freeform-card-title-frame freeform-card-title-frame--surface'

  return (
    <div
      data-board-card={card.id}
      className={`freeform-card${kindClass}${assignedClass}${nestedClass}${subtreeClass}${
        problemBubble ? ' freeform-problem-bubble' : ''
      }${card.kind === 'problem' && swarmMass > 0 ? ' freeform-problem-swarm-active' : ''}${
        swarmLinked ? ' freeform-agent-swarm-linked' : ''
      }${selected ? ' selected' : ''}${showGlobalOpenFlash ? ' has-open-questions' : ''}${agentGlowClass}${
        card.expanded ? '' : ' collapsed'
      }`}
      style={{
        left: card.x,
        top: card.y,
        width: card.width,
        height: card.expanded ? card.height : 44,
      }}
      onPointerDownCapture={onCardPointerDownCapture}
      onMouseDownCapture={onCardMouseDownCapture}
      onPointerDown={(e) => {
        e.stopPropagation()
      }}
      onDoubleClick={(e) => {
        e.stopPropagation()
        onToggleExpand()
      }}
    >
      {card.kind === 'agent' ? (
        <div className="freeform-card-header freeform-card-header--agent" onPointerDown={onAgentHeaderPointerDown}>
          <div
            ref={agentDragHandleRef}
            className="freeform-agent-drag-handle"
            onPointerMove={onHeaderPointerMove}
            onPointerUp={onHeaderPointerUp}
            onPointerCancel={onHeaderPointerUp}
          >
            <span className="freeform-card-dot" style={{ background: card.color }} />
            <span className={titleFrameClass}>
              <span className="freeform-card-title">{card.title}</span>
            </span>
            {subagentCount > 0 ? (
              <span
                className="freeform-subagent-count-badge"
                title="Subagents nested under this board — drop more boards here to add capacity"
              >
                ↳{subagentCount}
              </span>
            ) : null}
          </div>
          {hasOpenQuestions && !card.expanded ? (
            <span
              className={`freeform-open-pin${isAgent ? ' freeform-open-pin-agent' : ''}`}
              title="Open questions — expand card"
            >
              ?
            </span>
          ) : null}
        </div>
      ) : (
        <div
          className="freeform-card-header"
          onPointerDown={onHeaderPointerDown}
          onPointerMove={onHeaderPointerMove}
          onPointerUp={onHeaderPointerUp}
          onPointerCancel={onHeaderPointerUp}
        >
          <span className="freeform-card-dot" style={{ background: card.color }} />
          <span className={titleFrameClass}>
            <span className="freeform-card-title">{card.title}</span>
          </span>
          {card.kind === 'problem' && swarmMass > 0 ? (
            <span className="freeform-swarm-mass-badge" title="Swarm mass — specialists on this hub">
              ×{swarmMass}
            </span>
          ) : null}
          {hasOpenQuestions && !card.expanded ? (
            <span
              className={`freeform-open-pin${isAgent ? ' freeform-open-pin-agent' : ''}`}
              title="Open questions — expand card"
            >
              ?
            </span>
          ) : null}
        </div>
      )}
      {card.expanded ? (
        <div
          className={`freeform-card-body${card.kind === 'agent' ? ' freeform-card-body--agent' : ''}`}
          onPointerDown={card.kind === 'agent' ? onAgentBodyPointerDown : undefined}
        >
          {card.kind === 'problem' ? (
            <>
              <OpenQuestionsBlock items={opens} />
              {card.mission ? (
                <div
                  style={{
                    marginBottom: 10,
                    fontSize: '0.78rem',
                    lineHeight: 1.48,
                    color: 'rgba(255,255,255,0.78)',
                  }}
                >
                  {card.mission.split(/\n\n+/).map((para, i) => (
                    <p key={i} style={{ margin: i === 0 ? '0 0 0.55em' : '0.55em 0 0' }}>
                      {para}
                    </p>
                  ))}
                </div>
              ) : (
                <p style={{ margin: '0 0 8px' }}>
                  Keep the goal, constraints, and next decision here. Drop agents into this problem
                  and the swarm forms around the bottleneck automatically.
                </p>
              )}
              {assignedAgents.length ? (
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>
                    Combined agents
                  </div>
                  {assignedAgents.map((a) => (
                    <div key={a.id} className="freeform-agent-pill freeform-agent-pill-with-actions">
                      <span className="dot" style={{ background: a.color }} />
                      <span className="freeform-agent-pill-label">
                        {a.title}
                      </span>
                      <button
                        type="button"
                        className={`freeform-mini-btn${a.releaseNodFromLead ? ' is-on' : ''}`}
                        title="Lead agrees this marble can leave the sack (needs specialist nod too)"
                        onClick={(e) => {
                          e.stopPropagation()
                          onReleaseNod(a.id, 'lead')
                        }}
                        onPointerDown={(e) => e.stopPropagation()}
                      >
                        {a.releaseNodFromLead ? 'Lead ✓ release' : 'Lead: release'}
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ margin: 0, color: 'rgba(255,255,255,0.38)' }}>
                  No agents in the swarm yet. Double-click empty space to summon one, then drop it
                  into this bubble and let the envelope pull it in.
                </p>
              )}
              {assignedAgents.length > 0 ? (
                <div className="freeform-swarm-loop">
                  <div className="freeform-swarm-loop-title">Swarm loop</div>
                  <p>
                    Agents attack the bottleneck in parallel, reconnect to the whole problem after
                    each chunk, and surface you only when they hit a real decision.
                  </p>
                </div>
              ) : null}
              {assignedAgents.length > 0 ? (
                <div
                  className={`freeform-problem-lead-brief${
                    handshakeFocus?.problemId === card.id ? ' is-pulse' : ''
                  }`}
                >
                  <strong>Lead loop</strong> — Keep the swarm pointed at the choke point, then eject
                  finished agents back to the surface so they are ready for the next problem.
                </div>
              ) : null}
            </>
          ) : card.kind === 'agent' ? (
            <>
              <OpenQuestionsBlock items={opens} />
              <p style={{ margin: '0 0 8px' }}>
                {card.parentAgentId
                  ? (() => {
                      const par = cards.find(
                        (x) => x.id === card.parentAgentId && x.kind === 'agent',
                      )
                      const parName = par?.title ?? 'parent board'
                      return assignedProblem
                        ? `Nested under “${parName}” inside “${assignedProblem.title}” — stay in the swarm until the lead releases you.`
                        : `Nested under “${parName}” — drag free when this branch is done.`
                    })()
                  : assignedProblem
                    ? `Working inside “${assignedProblem.title}” — overlap another agent to grow a sub-swarm, or peel out when the work is done.`
                    : 'Free marble — drag this into any problem bubble to deploy it.'}
              </p>
              {!assignedProblem && card.lastProjectRecall ? (
                <p className="freeform-recall-line">{card.lastProjectRecall}</p>
              ) : null}
              {assignedProblem ? (
                <div className="freeform-release-row">
                  <button
                    type="button"
                    className={`freeform-mini-btn${card.releaseNodFromSpecialist ? ' is-on' : ''}`}
                    title="No useful work left — needs lead nod to leave the sack"
                    onClick={(e) => {
                      e.stopPropagation()
                      onReleaseNod(card.id, 'specialist')
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    {card.releaseNodFromSpecialist ? '✓ I’m done here' : 'I’m done — no useful work'}
                  </button>
                  {card.releaseNodFromSpecialist && !card.releaseNodFromLead ? (
                    <span className="freeform-release-hint">Waiting for lead release on problem…</span>
                  ) : null}
                </div>
              ) : null}
              {handshakeProblem ? (
                <div
                  className={`freeform-connect-handshake${handshakePulse ? ' is-pulse' : ''}`}
                  role="status"
                >
                  <p className="freeform-handshake-line">
                    <span className="freeform-handshake-role">Swarm</span>
                    Deployed into “{handshakeProblem.title}”.
                  </p>
                  <p className="freeform-handshake-line">
                    <span className="freeform-handshake-role">Lead</span>
                    Attack the current bottleneck, sync back to the whole goal when your chunk lands,
                    and escalate only when you hit a decision that needs oversight.
                  </p>
                </div>
              ) : null}
            </>
          ) : (
            <>
              <OpenQuestionsBlock items={opens} />
              <p style={{ margin: 0 }}>
                Generic surface for notes and links. Problems and agents use swarm combine rules
                above.
              </p>
            </>
          )}
          <p style={{ margin: '10px 0 0', fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)' }}>
            {card.kind === 'agent'
              ? 'Drag the top strip to move. Click the body to open it up. Double-click to collapse.'
              : 'Drag the header to move. Double-click to collapse.'}
          </p>
        </div>
      ) : null}
      <div
        className="freeform-card-resize-handle"
        title="Resize"
        aria-label="Resize card"
        onPointerDown={onResizePointerDown}
        onPointerMove={onResizePointerMove}
        onPointerUp={onResizePointerUp}
        onPointerCancel={onResizePointerUp}
      />
    </div>
  )
}
