import type { BoardWire, DewDropsWorkspaceMode, WorkflowCard } from './types'
import { buildProblemModelPacket } from './modelPacket'

export function buildProblemSwarmObjective(
  problem: WorkflowCard,
  cards: WorkflowCard[],
  wires: BoardWire[],
  workspaceMode: DewDropsWorkspaceMode = 'desktop',
): string {
  return buildProblemModelPacket(problem, cards, wires, workspaceMode).objectiveText
}
