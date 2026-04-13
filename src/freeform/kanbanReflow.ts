import {
  DEFAULT_KANBAN_MIN_AGENT_WIDTH,
  cardDisplayHeight,
  layoutKanbanStrip,
} from './kanbanGeometry'
import type { WorkflowCard } from './types'

/** Assigned-only: row(s) under the hub; each row exactly fills hub inner width with equal tiles. */
export function reflowHubKanbanLayout(cards: WorkflowCard[], problemId: string): WorkflowCard[] {
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
  const layouts = layoutKanbanStrip(
    assigned,
    p.x,
    p.width,
    p.y + ph,
    p.swarmAgentMinWidth ?? DEFAULT_KANBAN_MIN_AGENT_WIDTH,
  )

  return cards.map((c) => {
    if (c.kind !== 'agent' || c.assignedToProblemId !== problemId || c.parentAgentId) return c
    const pr = layouts.get(c.id)
    if (!pr) return c
    return { ...c, x: pr.x, y: pr.y, width: pr.width }
  })
}

export function reflowSubagentLayout(cards: WorkflowCard[], parentAgentId: string): WorkflowCard[] {
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
