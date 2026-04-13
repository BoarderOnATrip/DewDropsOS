import type { WorkflowCard } from './types'

export function applyReleaseNod(
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
