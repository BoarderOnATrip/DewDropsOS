import { buildProblemSessionBlueprint } from './sessionBlueprint'
import { agentsInProblemSwarm } from './swarmAgents'
import type { BoardWire, WorkflowCard } from './types'
import { openQuestionsForCard } from './openQuestions'
import type { DewDropsWorkspaceMode } from './types'

export function buildProblemSwarmObjective(
  problem: WorkflowCard,
  cards: WorkflowCard[],
  wires: BoardWire[],
  workspaceMode: DewDropsWorkspaceMode = 'desktop',
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

  const blueprint = buildProblemSessionBlueprint(problem, workspaceMode)
  sections.push(
    [
      'Memory palace context:',
      `- Wing: ${blueprint.memoryWing}`,
      `- Room: ${blueprint.memoryRoom}`,
      `- Summary: ${blueprint.contextSummary}`,
      ...(blueprint.anchors.length > 0 ? [`- Anchors: ${blueprint.anchors.join(', ')}`] : []),
      ...(blueprint.visualLoci.length > 0
        ? [`- Visual loci: ${blueprint.visualLoci.map((locus) => `${locus.title} (${locus.kind})`).join(', ')}`]
        : []),
    ].join('\n'),
  )

  sections.push(
    [
      'Device handoff packet:',
      `- Workspace: ${blueprint.workspaceLabel}`,
      `- Launch surface: ${blueprint.launchSurfaceLabel}`,
      `- Target: ${blueprint.target}`,
      ...(blueprint.phoneBrief ? [`- Phone brief: ${blueprint.phoneBrief}`] : []),
      ...(blueprint.desktopBrief ? [`- Desktop brief: ${blueprint.desktopBrief}`] : []),
    ].join('\n'),
  )

  if (problem.paperclipCompanyId || problem.paperclipProjectId || (problem.paperclipAgentIds?.length ?? 0) > 0) {
    sections.push(
      [
        'Paperclip routing:',
        ...(problem.paperclipCompanyId ? [`- Company: ${problem.paperclipCompanyId}`] : []),
        ...(problem.paperclipProjectId ? [`- Project: ${problem.paperclipProjectId}`] : []),
        ...(problem.paperclipLeadAgentId ? [`- Lead agent: ${problem.paperclipLeadAgentId}`] : []),
        ...(problem.paperclipAgentIds?.length
          ? [`- Swarm agents: ${problem.paperclipAgentIds.join(', ')}`]
          : []),
      ].join('\n'),
    )
  }

  sections.push(
    'Operate from the DewDrops problem room and leave a resumable swarm report in the active execution control plane.',
  )
  return sections.filter(Boolean).join('\n\n')
}
