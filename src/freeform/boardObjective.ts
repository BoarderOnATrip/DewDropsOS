import { agentsInProblemSwarm } from './swarmAgents'
import type { BoardWire, WorkflowCard } from './types'
import { openQuestionsForCard } from './openQuestions'

export function buildProblemSwarmObjective(
  problem: WorkflowCard,
  cards: WorkflowCard[],
  wires: BoardWire[],
): string {
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
