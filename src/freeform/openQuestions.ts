import { agentsInProblemSwarm } from './swarmAgents'
import type { BoardWire, WorkflowCard } from './types'

/** Explicit card.openQuestions plus structural opens (e.g. isolated problem hub). */
export function openQuestionsForCard(
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

export function descendantHasOpenQuestions(
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
