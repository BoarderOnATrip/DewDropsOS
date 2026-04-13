import { agentSubUnionBounds } from './cardOverlap'
import { cardDisplayHeight } from './kanbanGeometry'
import {
  ENVELOPE_STAY_SLACK,
  expandBounds,
  pointInBounds,
  problemEnvelopeStaySlack,
  swarmUnionBounds,
} from './swarmAgents'
import type { BoardWire, WorkflowCard } from './types'

export function shouldDraggedAgentStayAttached(
  agent: WorkflowCard,
  nextX: number,
  nextY: number,
  cards: WorkflowCard[],
  wires: BoardWire[],
  draggingIds: ReadonlySet<string>,
): boolean {
  if (agent.kind !== 'agent') return false
  const stationaryCards = cards.filter(
    (card) => !(card.kind === 'agent' && draggingIds.has(card.id)),
  )
  const cx = nextX + agent.width / 2
  const cy = nextY + cardDisplayHeight(agent) / 2

  if (agent.parentAgentId) {
    const union = agentSubUnionBounds(agent.parentAgentId, stationaryCards)
    return !!(union && pointInBounds(cx, cy, expandBounds(union, ENVELOPE_STAY_SLACK)))
  }

  if (agent.assignedToProblemId) {
    const problem = cards.find(
      (card) => card.id === agent.assignedToProblemId && card.kind === 'problem',
    )
    if (!problem) return false
    const union = swarmUnionBounds(agent.assignedToProblemId, stationaryCards, wires)
    return !!(
      union &&
      pointInBounds(cx, cy, expandBounds(union, problemEnvelopeStaySlack(problem)))
    )
  }

  return false
}
