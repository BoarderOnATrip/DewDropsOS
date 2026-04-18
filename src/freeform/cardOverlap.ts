import { cardDisplayHeight } from './kanbanGeometry'
import type { AxisAlignedBounds } from './swarmAgents'
import type { WorkflowCard } from './types'

export function rectIntersectionArea(
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

export function bestProblemOverlap(
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

export function bestGroupProblemTarget(
  draggedIds: ReadonlySet<string>,
  cards: WorkflowCard[],
): { id: string; area: number } | null {
  const problems = cards.filter((card) => card.kind === 'problem')
  if (problems.length === 0) return null

  const totals = new Map<string, number>()
  for (const card of cards) {
    if (card.kind !== 'agent' || !draggedIds.has(card.id)) continue
    const hit = bestProblemOverlap(card, problems)
    if (!hit) continue
    totals.set(hit.id, (totals.get(hit.id) ?? 0) + hit.area)
  }

  let best: { id: string; area: number } | null = null
  for (const [id, area] of totals) {
    if (!best || area > best.area) best = { id, area }
  }
  return best
}

export function isDescendantAgent(descId: string, ancestorId: string, cards: WorkflowCard[]): boolean {
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

export function wouldCreateParentCycle(childId: string, parentId: string, cards: WorkflowCard[]): boolean {
  if (childId === parentId) return true
  return isDescendantAgent(parentId, childId, cards)
}

export function bestParentAgentTarget(
  agent: WorkflowCard,
  cards: WorkflowCard[],
): { id: string; area: number } | null {
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

export function agentSubUnionBounds(
  parentAgentId: string,
  cards: WorkflowCard[],
): AxisAlignedBounds | null {
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

export function countSubagents(agentId: string, cards: WorkflowCard[]): number {
  return cards.filter((c) => c.kind === 'agent' && c.parentAgentId === agentId).length
}
