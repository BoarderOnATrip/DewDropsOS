import { cardDisplayHeight } from './kanbanGeometry'
import type { BoardWire, WorkflowCard } from './types'

/**
 * Legacy: used only to infer `problemBase*` when shrinking cards that were inflated by an older
 * swarm-mass rule (width/height += mass × step).
 */
const SWARM_SIZE_DW = 22
const SWARM_SIZE_DH = 14

/** Pixels past the tight union (hub + drops) where an assigned agent may move without detaching. */
export const ENVELOPE_STAY_SLACK = 48

/** Visual padding for the drawn water envelope stroke (world px). */
export const ENVELOPE_VISUAL_PAD = 12
export const DEFAULT_SWARM_ENVELOPE_PAD = ENVELOPE_VISUAL_PAD

export type AxisAlignedBounds = {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export function swarmMassForProblem(
  problemId: string,
  cards: WorkflowCard[],
  wires: BoardWire[],
): number {
  return agentsInProblemSwarm(problemId, cards, wires).length
}

/** Root-assigned agents, plus every nested subagent under them (fractal swarm). */
export function agentsInProblemSwarm(
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

export function swarmUnionBounds(
  problemId: string,
  cards: WorkflowCard[],
  wires: BoardWire[],
): AxisAlignedBounds | null {
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

export function expandBounds(b: AxisAlignedBounds, m: number): AxisAlignedBounds {
  return {
    minX: b.minX - m,
    minY: b.minY - m,
    maxX: b.maxX + m,
    maxY: b.maxY + m,
  }
}

export function pointInBounds(cx: number, cy: number, b: AxisAlignedBounds): boolean {
  return cx >= b.minX && cx <= b.maxX && cy >= b.minY && cy <= b.maxY
}

/** Hub card stays at its footprint; swarm “surface” is the SVG envelope around hub + boards. */
export function normalizeProblemFootprint(
  cards: WorkflowCard[],
  wires: BoardWire[],
): WorkflowCard[] {
  let changed = false
  const next = cards.map((c) => {
    if (c.kind !== 'problem') return c
    const mass = swarmMassForProblem(c.id, cards, wires)
    const bw = c.problemBaseWidth ?? Math.max(120, c.width - mass * SWARM_SIZE_DW)
    const bh = c.problemBaseHeight ?? Math.max(80, c.height - mass * SWARM_SIZE_DH)
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

export function problemEnvelopePad(problem: WorkflowCard): number {
  return Math.max(0, problem.swarmEnvelopePad ?? DEFAULT_SWARM_ENVELOPE_PAD)
}

export function problemEnvelopeStaySlack(problem: WorkflowCard): number {
  return Math.max(ENVELOPE_STAY_SLACK, problemEnvelopePad(problem) + 24)
}
