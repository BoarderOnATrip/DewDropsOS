import type { BoardWire, WorkflowCard } from '../freeform/types'
import { buildVisualMemoryPalace } from '../freeform/visualMemoryPalace'
import type {
  Actor,
  Agent,
  Artifact,
  Locus,
  LocusKind,
  Person,
  Room,
  Tunnel,
  Wing,
  WorldGraph,
} from './model'
import { worldRef } from './model'

function slugToken(input: string, fallback: string): string {
  const normalized = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return normalized || fallback
}

function firstLine(value: string | undefined): string {
  return (
    value
      ?.split(/\n+/)
      .map((line) => line.trim())
      .find(Boolean) ?? ''
  )
}

function summarizeProblem(problem: WorkflowCard): string {
  return (
    problem.memoryContextSummary?.trim() ||
    firstLine(problem.desktopSessionBrief) ||
    firstLine(problem.phoneRelayBrief) ||
    firstLine(problem.mission) ||
    `Context room for ${problem.title}.`
  )
}

function roomTone(problem: WorkflowCard): string {
  if ((problem.openQuestions?.length ?? 0) > 0) return 'attention'
  if (problem.lastPaperclipRunId || problem.lastSwarmRunId) return 'ready'
  return 'calm'
}

function locusKindForMemoryKind(kind: string): LocusKind {
  if (kind === 'north_star') return 'platform'
  if (kind === 'portal') return 'door'
  if (kind === 'artifact') return 'drawer'
  if (kind === 'checkpoint') return 'console'
  return 'table'
}

export function buildWorkspaceWorldGraph(
  workspaceName: string,
  cards: readonly WorkflowCard[],
  wires: readonly BoardWire[] = [],
): WorldGraph {
  const wingId = `wing-${slugToken(workspaceName, 'workspace')}`
  const operatorId = `person-${slugToken(workspaceName, 'operator')}`
  const problems = cards.filter((card) => card.kind === 'problem')
  const agentCards = cards.filter((card) => card.kind === 'agent')

  const operator: Person = {
    kind: 'person',
    id: operatorId,
    title: 'Operator',
    summary: `Primary operator anchor for ${workspaceName}.`,
    wingId,
    roomIds: problems.map((problem) => problem.id),
    position: { x: -120, y: 0, z: 0 },
    tags: ['operator', 'anchor', 'synthetic'],
  }

  const agents: Agent[] = agentCards.map((card, index) => ({
    kind: 'agent',
    id: card.id,
    title: card.title,
    summary: `Workspace agent card for ${card.title}.`,
    wingId,
    roomIds: card.assignedToProblemId ? [card.assignedToProblemId] : [],
    provider: 'custom',
    active: true,
    position: { x: 120 + (index % 4) * 70, y: Math.floor(index / 4) * 70, z: 0 },
    tags: ['workspace-agent'],
  }))

  const artifacts: Artifact[] = []
  const loci: Locus[] = []

  const rooms: Room[] = problems.map((problem, problemIndex) => {
    const roomActorIds = [
      operatorId,
      ...agents
        .filter((agent) => agent.roomIds.includes(problem.id))
        .map((agent) => agent.id),
    ]

    const roomLoci: Locus[] = buildVisualMemoryPalace(problem).map((locus, locusIndex) => {
      const locusId = `${problem.id}-locus-${locus.id}`
      return {
        kind: 'locus' as const,
        id: locusId,
        title: locus.title,
        summary: locus.detail,
        roomId: problem.id,
        locusKind: locusKindForMemoryKind(locus.kind),
        actorIds: roomActorIds,
        artifactIds: [],
        position: {
          x: -180 + locusIndex * 92,
          y: problemIndex * 80,
          z: 0,
        },
        tags: ['memory-palace', locus.kind],
      }
    })

    loci.push(...roomLoci)

    const roomArtifacts: Artifact[] = []
    if (problem.mission?.trim() || problem.memoryContextSummary?.trim()) {
      roomArtifacts.push({
        kind: 'artifact',
        id: `${problem.id}-artifact-brief`,
        title: `${problem.title} brief`,
        summary: summarizeProblem(problem),
        roomId: problem.id,
        locusId: roomLoci[0]?.id,
        artifactKind: 'document',
        actorIds: roomActorIds,
        position: { x: 0, y: problemIndex * 60, z: 0 },
        tags: ['brief', 'room'],
      })
    }
    if (problem.phoneRelayBrief?.trim() || problem.desktopSessionBrief?.trim()) {
      roomArtifacts.push({
        kind: 'artifact',
        id: `${problem.id}-artifact-handoff`,
        title: `${problem.title} handoff`,
        summary:
          problem.phoneRelayBrief?.trim() ||
          problem.desktopSessionBrief?.trim() ||
          `Handoff packet for ${problem.title}.`,
        roomId: problem.id,
        locusId: roomLoci[1]?.id ?? roomLoci[0]?.id,
        artifactKind: 'plan',
        actorIds: roomActorIds,
        position: { x: 70, y: problemIndex * 60 + 20, z: 0 },
        tags: ['handoff', 'projection'],
      })
    }

    artifacts.push(...roomArtifacts)

    for (const roomLocus of roomLoci) {
      roomLocus.artifactIds = roomArtifacts
        .filter((artifact) => artifact.locusId === roomLocus.id)
        .map((artifact) => artifact.id)
    }

    return {
      kind: 'room',
      id: problem.id,
      title: problem.title,
      summary: summarizeProblem(problem),
      wingId,
      actorIds: roomActorIds,
      locusIds: roomLoci.map((locus) => locus.id),
      artifactIds: roomArtifacts.map((artifact) => artifact.id),
      tunnelIds: [],
      position: {
        x: problem.x,
        y: problem.y,
        z: 0,
      },
      tone: roomTone(problem),
      tags: [
        'workspace-room',
        problem.preferredLaunchSurface ?? 'desktop',
      ],
    }
  })

  const tunnels: Tunnel[] = []
  const roomById = new Map(rooms.map((room) => [room.id, room]))
  for (const wire of wires) {
    const fromRoom = roomById.get(wire.fromCardId)
    const toRoom = roomById.get(wire.toCardId)
    if (!fromRoom || !toRoom) continue
    tunnels.push({
      kind: 'tunnel',
      id: `tunnel-${wire.id}`,
      from: worldRef('room', fromRoom.id),
      to: worldRef('room', toRoom.id),
      label: 'context tunnel',
      summary: `${fromRoom.title} flows into ${toRoom.title}.`,
      tunnelKind: 'route',
      tags: ['workspace-wire', 'context-tunnel'],
    })
  }

  const wing: Wing = {
    kind: 'wing',
    id: wingId,
    title: workspaceName,
    summary: 'Live workspace wing generated from DewDrops rooms and assigned agents.',
    color: '#4f8cff',
    roomIds: rooms.map((room) => room.id),
    actorIds: [operatorId, ...agents.map((agent) => agent.id)],
    position: { x: 0, y: 0, z: 0 },
    tags: ['workspace', 'generated', 'world-shell'],
  }

  return {
    id: `world-${slugToken(workspaceName, 'workspace')}`,
    title: workspaceName,
    summary: 'Generated world graph from the active DewDrops workspace.',
    entryWingId: wing.id,
    entryRoomId: rooms[0]?.id,
    wings: [wing],
    actors: [operator, ...agents] as Actor[],
    rooms: rooms.map((room) => {
      const tunnelIds = tunnels
        .filter((tunnel) => tunnel.from.id === room.id || tunnel.to.id === room.id)
        .map((tunnel) => tunnel.id)
      return { ...room, tunnelIds }
    }),
    loci,
    artifacts,
    tunnels,
  }
}
