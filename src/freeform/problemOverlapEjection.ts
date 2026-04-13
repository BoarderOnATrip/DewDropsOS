import { cardDisplayHeight } from './kanbanGeometry'
import type { BoardWire, WorkflowCard } from './types'
import { cardWorldBounds, worldRectsIntersect, type WorldRect } from './viewportGeometry'

/** World px/sec — cards not in the swarm drift off overlapping problem hubs. */
const PROBLEM_OVERLAP_EJECT_SPEED = 48
/** Tiny gap once overlap resolves so we don’t re-enter next frame. */
const PROBLEM_EJECT_SLACK = 2
/** Slight bias toward horizontal “slide to the side” vs vertical. */
const PROBLEM_EJECT_SIDE_BIAS = 1.12

/** Push mover out of fixedBounds along the shorter overlap axis (prefer sideways). */
export function problemOverlapEjectDelta(
  mover: WorkflowCard,
  moverX: number,
  moverY: number,
  fixedBounds: WorldRect,
  maxStep: number,
): { dx: number; dy: number } {
  const mb: WorldRect = {
    l: moverX,
    t: moverY,
    r: moverX + mover.width,
    b: moverY + cardDisplayHeight(mover),
  }
  if (!worldRectsIntersect(mb, fixedBounds)) return { dx: 0, dy: 0 }
  const mcx = (mb.l + mb.r) / 2
  const fcx = (fixedBounds.l + fixedBounds.r) / 2
  const moveRight = fixedBounds.r - mb.l + PROBLEM_EJECT_SLACK
  const moveLeft = mb.r - fixedBounds.l + PROBLEM_EJECT_SLACK
  const escapeX = mcx >= fcx ? moveRight : moveLeft

  const mcy = (mb.t + mb.b) / 2
  const fcy = (fixedBounds.t + fixedBounds.b) / 2
  const moveDown = fixedBounds.b - mb.t + PROBLEM_EJECT_SLACK
  const moveUp = mb.b - fixedBounds.t + PROBLEM_EJECT_SLACK
  const escapeY = mcy >= fcy ? moveDown : moveUp

  const preferSide = escapeX <= escapeY * PROBLEM_EJECT_SIDE_BIAS
  if (preferSide) {
    const sign = mcx >= fcx ? 1 : -1
    return { dx: sign * Math.min(maxStep, escapeX), dy: 0 }
  }
  const sign = mcy >= fcy ? 1 : -1
  return { dx: 0, dy: sign * Math.min(maxStep, escapeY) }
}

export function stepProblemOverlapEjection(
  cards: WorkflowCard[],
  wires: BoardWire[],
  dtSec: number,
  draggingIds: ReadonlySet<string>,
): WorkflowCard[] {
  void wires
  const maxStep = PROBLEM_OVERLAP_EJECT_SPEED * dtSec
  if (maxStep <= 0) return cards

  const problems = cards.filter((c) => c.kind === 'problem')
  if (problems.length === 0) return cards

  const pos = new Map<string, { x: number; y: number }>()
  for (const c of cards) pos.set(c.id, { x: c.x, y: c.y })

  for (const p of problems) {
    if (draggingIds.has(p.id)) continue
    const pb = cardWorldBounds(p)

    for (const c of cards) {
      if (c.id === p.id) continue
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
