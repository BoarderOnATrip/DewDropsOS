import {
  buildProjection,
  buildWorldIndex,
  getParentWorldRefFromIndex,
  listDrillTargetsFromIndex,
  resolveWorldNodeFromIndex,
  listActorsForRoom,
  listArtifactsForRoom,
  listLociForRoom,
  listTunnelsForNode,
  worldRef,
  type Actor,
  type Locus,
  type ProjectionMode,
  type WorldGraph,
  type WorldNodeKind,
  type WorldRef,
} from './model'
import { buildProblemSessionBlueprint } from '../freeform/sessionBlueprint'
import type { WorkflowCard } from '../freeform/types'
import { memoryPalaceKindLabel } from '../freeform/visualMemoryPalace'
import type {
  WorldClosetCard,
  WorldClosetDrawer,
  WorldDrillStage,
  WorldDrillStageId,
  WorldHierarchy,
  WorldLocusCard,
  WorldLocusPreview,
  WorldProjectionStage,
  WorldProjectionStageItem,
  WorldProjectionStageVector,
  WorldProjectionChip,
  WorldRoomCard,
  WorldRoomPreview,
} from './WorldShell'

export type WorldShellWorkspaceSnapshot = {
  workspaceName: string
  cards?: readonly WorkflowCard[]
  focusedProblemId?: string | null
  selectedProjectionId?: ProjectionMode | null
  selectedFocusRef?: WorldRef | null
  earthLabel?: string
}

export type WorldShellData = {
  title: string
  subtitle?: string
  heroCopy?: string
  hierarchy: WorldHierarchy
  projectionChips: WorldProjectionChip[]
  activeProjection: WorldProjectionStage
  roomCards: WorldRoomCard[]
  roomPreview?: WorldRoomPreview
  selectedProjectionId: ProjectionMode
  selectedRoomId: string | null
  drillStages: WorldDrillStage[]
  selectedDrillStageId: WorldDrillStageId
  locusCards: WorldLocusCard[]
  selectedLocusId: string | null
  locusPreview?: WorldLocusPreview
  closetCards: WorldClosetCard[]
  selectedClosetId: string | null
}

const PROJECTION_CHIPS: Record<ProjectionMode, WorldProjectionChip> = {
  earth: {
    id: 'earth',
    label: 'Earth',
    detail: 'Planetary shell and wing map',
    tone: 'calm',
  },
  wing: {
    id: 'wing',
    label: 'Wing',
    detail: 'Territory and active actor field',
    tone: 'ready',
  },
  room: {
    id: 'room',
    label: 'Room',
    detail: 'Focused operator depth surface',
    tone: 'ready',
  },
  fold: {
    id: 'fold',
    label: 'Fold',
    detail: 'Compressed 2D origami view',
    tone: 'attention',
  },
  outline: {
    id: 'outline',
    label: 'Outline',
    detail: 'Readable summary and audit frame',
    tone: 'calm',
  },
  packet: {
    id: 'packet',
    label: 'Packet',
    detail: 'Agent and phone relay context',
    tone: 'ready',
  },
}

function roomTone(value: string): WorldProjectionChip['tone'] {
  if (value === 'attention' || value === 'ready' || value === 'missing' || value === 'calm') {
    return value
  }
  return 'calm'
}

function compactLabel(value: string): string {
  const prefixes = [
    'entity/',
    'room/',
    'dewdrops/cards/',
    'lifegirdle/wings/',
    'drawer/',
  ]
  let compact = value.trim()
  for (const prefix of prefixes) {
    if (compact.startsWith(prefix)) {
      compact = compact.slice(prefix.length)
      break
    }
  }
  if (compact.length <= 56) return compact
  return `${compact.slice(0, 24)}...${compact.slice(-20)}`
}

function buildStageItem(
  id: string,
  label: string,
  focusRef?: WorldRef,
  drillStageId?: WorldDrillStageId,
): WorldProjectionStageItem {
  return {
    id,
    label,
    focusRef,
    drillStageId,
  }
}

function uniqueStageItems(items: readonly WorldProjectionStageItem[]): WorldProjectionStageItem[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    const label = item.label.trim()
    if (!label) return false
    const focusKey = item.focusRef ? `${item.focusRef.kind}:${item.focusRef.id}` : 'none'
    const key = `${label}:${focusKey}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function limitStageItems(
  items: readonly WorldProjectionStageItem[],
  limit = 4,
): WorldProjectionStageItem[] {
  const list = uniqueStageItems(items)
  if (list.length <= limit) return list
  return [
    ...list.slice(0, limit),
    buildStageItem(`overflow-${limit}-${list.length}`, `+${list.length - limit} more`),
  ]
}

function kindLabel(kind: WorldNodeKind): string {
  if (kind === 'person') return 'Person'
  if (kind === 'animal') return 'Animal'
  if (kind === 'plant') return 'Plant'
  if (kind === 'organization') return 'Organization'
  if (kind === 'agent') return 'Agent'
  if (kind === 'room') return 'Room'
  if (kind === 'locus') return 'Locus'
  if (kind === 'artifact') return 'Artifact'
  return 'Wing'
}

function resolveWorldRefById(
  index: ReturnType<typeof buildWorldIndex>,
  id: string,
): WorldRef | undefined {
  if (index.wingById.has(id)) return worldRef('wing', id)
  const actor = index.actorById.get(id)
  if (actor) return worldRef(actor.kind, actor.id)
  if (index.roomById.has(id)) return worldRef('room', id)
  if (index.locusById.has(id)) return worldRef('locus', id)
  if (index.artifactById.has(id)) return worldRef('artifact', id)
  return undefined
}

function locusRefForBlueprint(
  index: ReturnType<typeof buildWorldIndex>,
  roomId: string | null,
  locusId: string,
): WorldRef | undefined {
  if (!roomId) return undefined
  const resolvedId = `${roomId}-locus-${locusId}`
  return index.locusById.has(resolvedId) ? worldRef('locus', resolvedId) : undefined
}

function buildReturnVector(
  id: string,
  label: string,
  detail: string,
  options: {
    tone?: WorldProjectionChip['tone']
    orbit?: 'inner' | 'outer'
    focusRef?: WorldRef
    drillStageId?: WorldDrillStageId
  } = {},
): WorldProjectionStageVector {
  return {
    id,
    label,
    detail,
    tone: options.tone,
    orbit: options.orbit,
    focusRef: options.focusRef,
    drillStageId: options.drillStageId,
  }
}

function vectorDetailForRef(
  index: ReturnType<typeof buildWorldIndex>,
  ref: WorldRef,
): string {
  const node = resolveWorldNodeFromIndex(index, ref)
  if (!node) return `${kindLabel(ref.kind)} vector`

  switch (node.kind) {
    case 'wing':
      return `${index.roomsByWingId.get(node.id)?.length ?? 0} rooms in territory`
    case 'room':
      return `${displayActorsForRoom(index, node.id).length} actors • ${listLociForRoom(index, node.id).length} loci`
    case 'locus':
      return `${locusKindLabel(node.locusKind)} • ${node.artifactIds.length} artifacts`
    case 'artifact':
      return compactLabel(node.summary)
    case 'agent':
      return `${node.provider} agent`
    case 'organization':
      return `${node.memberActorIds.length} members`
    case 'person':
    case 'animal':
    case 'plant':
      return `${node.roomIds.length} rooms attached`
  }
}

function buildReturnVectors(
  index: ReturnType<typeof buildWorldIndex>,
  graph: WorldGraph,
  snapshot: WorldShellWorkspaceSnapshot,
  focusRef: WorldRef | null,
  roomId: string | null,
  locusId: string | null,
): WorldProjectionStageVector[] {
  const vectors: WorldProjectionStageVector[] = []
  const seen = new Set<string>()
  const selectedRoom = roomId ? index.roomById.get(roomId) ?? null : null
  const selectedLocus = locusId ? index.locusById.get(locusId) ?? null : null
  const selectedWing =
    selectedRoom
      ? index.wingById.get(selectedRoom.wingId) ?? null
      : focusRef?.kind === 'wing'
        ? index.wingById.get(focusRef.id) ?? null
        : graph.entryWingId
          ? index.wingById.get(graph.entryWingId) ?? null
          : graph.wings[0] ?? null

  const pushVector = (vector: WorldProjectionStageVector) => {
    const focusKey = vector.focusRef ? `${vector.focusRef.kind}:${vector.focusRef.id}` : `stage:${vector.drillStageId ?? 'none'}`
    if (seen.has(focusKey)) return
    seen.add(focusKey)
    vectors.push(vector)
  }

  pushVector(
    buildReturnVector(
      'return-earth',
      snapshot.earthLabel ?? 'Planet Earth',
      'Reset to the planetary shell and last known territory.',
      {
        tone: 'calm',
        orbit: 'outer',
        drillStageId: 'earth',
      },
    ),
  )

  if (selectedWing) {
    pushVector(
      buildReturnVector(
        `return-wing-${selectedWing.id}`,
        selectedWing.title,
        `${selectedWing.roomIds.length} rooms in territory`,
        {
          tone: 'ready',
          orbit: 'outer',
          focusRef: worldRef('wing', selectedWing.id),
        },
      ),
    )
  }

  if (selectedRoom) {
    pushVector(
      buildReturnVector(
        `return-room-${selectedRoom.id}`,
        selectedRoom.title,
        `${displayActorsForRoom(index, selectedRoom.id).length} actors • ${selectedRoom.locusIds.length} loci`,
        {
          tone: 'ready',
          orbit: 'inner',
          focusRef: worldRef('room', selectedRoom.id),
        },
      ),
    )
  }

  if (selectedLocus) {
    pushVector(
      buildReturnVector(
        `return-locus-${selectedLocus.id}`,
        selectedLocus.title,
        `${locusKindLabel(selectedLocus.locusKind)} • ${selectedLocus.artifactIds.length} artifacts`,
        {
          tone: 'attention',
          orbit: 'inner',
          focusRef: worldRef('locus', selectedLocus.id),
        },
      ),
    )
  }

  const drillAnchor =
    focusRef ??
    (selectedLocus
      ? worldRef('locus', selectedLocus.id)
      : selectedRoom
        ? worldRef('room', selectedRoom.id)
        : selectedWing
          ? worldRef('wing', selectedWing.id)
          : null)

  for (const ref of listDrillTargetsFromIndex(index, drillAnchor).slice(0, 4)) {
    const node = resolveWorldNodeFromIndex(index, ref)
    if (!node) continue
    pushVector(
      buildReturnVector(
        `return-drill-${ref.kind}-${ref.id}`,
        node.title,
        vectorDetailForRef(index, ref),
        {
          tone: ref.kind === 'locus' || ref.kind === 'artifact' ? 'attention' : 'calm',
          orbit: ref.kind === 'locus' || ref.kind === 'room' ? 'inner' : 'outer',
          focusRef: ref,
        },
      ),
    )
  }

  if (selectedRoom) {
    for (const tunnel of listTunnelsForNode(index, selectedRoom.id).slice(0, 3)) {
      const other = tunnel.from.id === selectedRoom.id ? tunnel.to : tunnel.from
      const otherNode = resolveWorldNodeFromIndex(index, other)
      if (!otherNode) continue
      pushVector(
        buildReturnVector(
          `return-tunnel-${tunnel.id}`,
          otherNode.title,
          tunnel.label,
          {
            tone: 'attention',
            orbit: 'outer',
            focusRef: worldRef(other.kind, other.id),
          },
        ),
      )
    }
  }

  return vectors.slice(0, 7)
}

function buildBreadcrumbItems(
  index: ReturnType<typeof buildWorldIndex>,
  graph: WorldGraph,
  snapshot: WorldShellWorkspaceSnapshot,
  focusRef: WorldRef | null,
  fallbackRoomId: string | null,
): WorldProjectionStageItem[] {
  const earthLabel = snapshot.earthLabel ?? 'Planet Earth'
  const items: WorldProjectionStageItem[] = [buildStageItem('breadcrumb-earth', earthLabel, undefined, 'earth')]
  const trail: WorldRef[] = []
  const seen = new Set<string>()

  let cursor =
    focusRef ??
    (fallbackRoomId
      ? worldRef('room', fallbackRoomId)
      : graph.entryWingId
        ? worldRef('wing', graph.entryWingId)
        : graph.wings[0]
          ? worldRef('wing', graph.wings[0].id)
          : null)

  while (cursor) {
    const key = `${cursor.kind}:${cursor.id}`
    if (seen.has(key)) break
    seen.add(key)
    trail.unshift(cursor)
    cursor = getParentWorldRefFromIndex(index, cursor)
  }

  for (const [indexPosition, ref] of trail.entries()) {
    const node = resolveWorldNodeFromIndex(index, ref)
    items.push(
      buildStageItem(
        `breadcrumb-${indexPosition}-${ref.kind}-${ref.id}`,
        node?.title ?? ref.id,
        ref,
        undefined,
      ),
    )
  }

  return items
}

function locusKindLabel(kind: Locus['locusKind']): string {
  if (kind === 'door') return 'Door'
  if (kind === 'table') return 'Table'
  if (kind === 'wall') return 'Wall'
  if (kind === 'drawer') return 'Drawer'
  if (kind === 'window') return 'Window'
  if (kind === 'floor') return 'Floor'
  if (kind === 'console') return 'Console'
  if (kind === 'archive') return 'Archive'
  return 'Platform'
}

function problemCards(cards: readonly WorkflowCard[] | undefined): WorkflowCard[] {
  return (cards ?? []).filter((card) => card.kind === 'problem')
}

function problemByRoomId(cards: readonly WorkflowCard[] | undefined): Map<string, WorkflowCard> {
  return new Map(problemCards(cards).map((card) => [card.id, card]))
}

function isSyntheticActor(actor: Actor): boolean {
  return actor.tags.includes('synthetic') || actor.tags.includes('operator')
}

function displayActors(actors: readonly Actor[]): Actor[] {
  const nonSynthetic = actors.filter((actor) => !isSyntheticActor(actor))
  return nonSynthetic.length > 0 ? nonSynthetic : [...actors]
}

function displayActorsForRoom(
  index: ReturnType<typeof buildWorldIndex>,
  roomId: string,
): Actor[] {
  return displayActors(listActorsForRoom(index, roomId))
}

function displayActorsForLocus(
  index: ReturnType<typeof buildWorldIndex>,
  locus: Locus,
): Actor[] {
  return displayActors(
    locus.actorIds
      .map((actorId) => index.actorById.get(actorId))
      .filter((actor): actor is Actor => actor !== undefined),
  )
}

function focusStageForRef(ref: WorldRef | null | undefined): WorldDrillStageId {
  if (!ref) return 'earth'
  if (ref.kind === 'wing') return 'wing'
  if (ref.kind === 'locus' || ref.kind === 'artifact') return 'locus'
  return 'room'
}

function defaultFocusRef(
  index: ReturnType<typeof buildWorldIndex>,
  graph: WorldGraph,
  preferredRoomId: string | null,
  projectionMode: ProjectionMode,
): WorldRef | null {
  if (projectionMode === 'earth') return null
  if (projectionMode === 'wing') {
    const preferredRoom = preferredRoomId ? index.roomById.get(preferredRoomId) ?? null : null
    const wingId = preferredRoom?.wingId ?? graph.entryWingId ?? graph.wings[0]?.id
    return wingId ? worldRef('wing', wingId) : null
  }
  const roomId = preferredRoomId ?? graph.entryRoomId ?? graph.rooms[0]?.id ?? null
  if (roomId) return worldRef('room', roomId)
  const wingId = graph.entryWingId ?? graph.wings[0]?.id
  return wingId ? worldRef('wing', wingId) : null
}

function normalizeFocusRef(
  index: ReturnType<typeof buildWorldIndex>,
  graph: WorldGraph,
  requestedFocusRef: WorldRef | null | undefined,
  preferredRoomId: string | null,
  projectionMode: ProjectionMode,
): WorldRef | null {
  const resolved = resolveWorldNodeFromIndex(index, requestedFocusRef)
  if (resolved) {
    return worldRef(resolved.kind, resolved.id)
  }
  return defaultFocusRef(index, graph, preferredRoomId, projectionMode)
}

function resolveRoomIdForFocus(
  index: ReturnType<typeof buildWorldIndex>,
  focusRef: WorldRef | null,
  fallbackRoomId: string | null,
): string | null {
  if (!focusRef) return fallbackRoomId

  switch (focusRef.kind) {
    case 'room':
      return focusRef.id
    case 'locus':
      return index.locusById.get(focusRef.id)?.roomId ?? fallbackRoomId
    case 'artifact':
      return index.artifactById.get(focusRef.id)?.roomId ?? fallbackRoomId
    case 'person':
    case 'animal':
    case 'plant':
    case 'organization':
    case 'agent':
      return index.actorById.get(focusRef.id)?.roomIds[0] ?? fallbackRoomId
    case 'wing':
      return graphRoomIdForWing(index, focusRef.id) ?? fallbackRoomId
    default:
      return fallbackRoomId
  }
}

function graphRoomIdForWing(
  index: ReturnType<typeof buildWorldIndex>,
  wingId: string,
): string | null {
  return index.roomsByWingId.get(wingId)?.[0]?.id ?? null
}

function resolveLocusIdForFocus(
  index: ReturnType<typeof buildWorldIndex>,
  focusRef: WorldRef | null,
  roomId: string | null,
): string | null {
  if (focusRef?.kind === 'locus' && index.locusById.has(focusRef.id)) {
    return focusRef.id
  }
  if (focusRef?.kind === 'artifact') {
    const artifact = index.artifactById.get(focusRef.id)
    if (artifact?.locusId && index.locusById.has(artifact.locusId)) {
      return artifact.locusId
    }
  }
  if (!roomId) return null
  return listLociForRoom(index, roomId)[0]?.id ?? null
}

function buildHierarchy(
  index: ReturnType<typeof buildWorldIndex>,
  graph: WorldGraph,
  snapshot: WorldShellWorkspaceSnapshot,
  selectedRoomCard: WorldRoomCard | null,
): WorldHierarchy {
  const wing =
    (graph.entryWingId ? index.wingById.get(graph.entryWingId) : null) ?? graph.wings[0] ?? null
  const selectedRoom =
    selectedRoomCard ? graph.rooms.find((room) => room.id === selectedRoomCard.id) ?? null : null
  const roomActors = selectedRoom
    ? displayActorsForRoom(index, selectedRoom.id)
    : []
  const primaryPerson =
    roomActors.find((actor) => actor.kind === 'person') ??
    graph.actors.find((actor) => actor.kind === 'person' && !isSyntheticActor(actor)) ??
    roomActors[0] ??
    graph.actors[0] ??
    null
  const activeAgentCount = roomActors.length > 0
    ? roomActors.filter((actor) => actor.kind === 'agent').length
    : graph.actors.filter((actor) => actor.kind === 'agent' && actor.active).length

  const actorLabel =
    primaryPerson && activeAgentCount > 0
      ? `${primaryPerson.title} + ${activeAgentCount} agents`
      : primaryPerson?.title ?? 'Active actors'

  return {
    earth: snapshot.earthLabel ?? 'Planet Earth',
    wing: wing?.title ?? snapshot.workspaceName,
    actor: actorLabel,
    room: selectedRoomCard?.title ?? wing?.title ?? snapshot.workspaceName,
  }
}

function buildRoomCards(
  index: ReturnType<typeof buildWorldIndex>,
  graph: WorldGraph,
  problemsById: Map<string, WorkflowCard>,
): WorldRoomCard[] {
  return graph.rooms.map((room, indexPosition) => ({
    id: room.id,
    title: room.title,
    summary: room.summary,
    meta: [
      problemsById.get(room.id)
        ? buildProblemSessionBlueprint(problemsById.get(room.id)!, 'palace').launchSurfaceLabel
        : 'Room',
      `${displayActorsForRoom(index, room.id).length} actors`,
      `${listLociForRoom(index, room.id).length} loci`,
      `${listArtifactsForRoom(index, room.id).length} artifacts`,
    ],
    tone: roomTone(room.tone),
    accent: indexPosition % 2 === 0 ? '#7dd3fc' : '#84cc16',
  }))
}

function buildRoomPreview(
  index: ReturnType<typeof buildWorldIndex>,
  graph: WorldGraph,
  problemsById: Map<string, WorkflowCard>,
  roomId: string | null | undefined,
): WorldRoomPreview | undefined {
  if (!roomId) return undefined
  const room = graph.rooms.find((entry) => entry.id === roomId)
  if (!room) return undefined
  const problem = problemsById.get(room.id)
  const blueprint = problem ? buildProblemSessionBlueprint(problem, 'palace') : null
  const roomActors = displayActorsForRoom(index, room.id)
  const roomLoci = listLociForRoom(index, room.id)
  const roomArtifacts = listArtifactsForRoom(index, room.id)
  const roomTunnels = listTunnelsForNode(index, room.id)
  const latestRunLabel = problem?.lastPaperclipRunId
    ? `Paperclip ${problem.lastPaperclipRunId}`
    : problem?.lastSwarmRunId
      ? `Swarm ${problem.lastSwarmRunId}`
      : undefined

  return {
    title: room.title,
    summary: room.summary,
    surfaceLabel: blueprint?.launchSurfaceLabel ?? 'Room',
    memoryLabel: blueprint ? `${blueprint.memoryWing}/${blueprint.memoryRoom}` : 'Memory not bound',
    actorLabels: roomActors.map((actor) => actor.title),
    actorItems: roomActors.map((actor) =>
      buildStageItem(`room-preview-actor-${actor.id}`, actor.title, worldRef(actor.kind, actor.id)),
    ),
    locusLabels: roomLoci.map((locus) => locus.title),
    locusItems: roomLoci.map((locus) =>
      buildStageItem(`room-preview-locus-${locus.id}`, locus.title, worldRef('locus', locus.id)),
    ),
    artifactLabels: roomArtifacts.map((artifact) => artifact.title),
    artifactItems: roomArtifacts.map((artifact) =>
      buildStageItem(
        `room-preview-artifact-${artifact.id}`,
        artifact.title,
        worldRef('artifact', artifact.id),
      ),
    ),
    tunnelLabels: roomTunnels.map((tunnel) => tunnel.label),
    tunnelItems: roomTunnels.map((tunnel) => {
      const other = tunnel.from.id === room.id ? tunnel.to : tunnel.from
      const otherNode = resolveWorldNodeFromIndex(index, other)
      return buildStageItem(
        `room-preview-tunnel-${tunnel.id}`,
        otherNode ? `${tunnel.label} -> ${otherNode.title}` : tunnel.label,
        worldRef(other.kind, other.id),
      )
    }),
    anchorLabels: blueprint?.anchors ?? [],
    anchorItems: (blueprint?.anchors ?? []).map((anchor, indexPosition) =>
      buildStageItem(`room-preview-anchor-${indexPosition + 1}`, anchor),
    ),
    openQuestionLabels: problem?.openQuestions?.filter(Boolean) ?? [],
    openQuestionItems: (problem?.openQuestions?.filter(Boolean) ?? []).map((question, indexPosition) =>
      buildStageItem(`room-preview-question-${indexPosition + 1}`, question),
    ),
    phoneBrief: blueprint?.phoneBrief || undefined,
    desktopBrief: blueprint?.desktopBrief || undefined,
    latestRunLabel,
  }
}

function buildLocusCards(
  index: ReturnType<typeof buildWorldIndex>,
  roomId: string | null,
): WorldLocusCard[] {
  if (!roomId) return []
  const room = index.roomById.get(roomId) ?? null
  return listLociForRoom(index, roomId).map((locus, indexPosition) => {
    const actorLabels = displayActorsForLocus(index, locus).map((actor) => actor.title)
    const artifactLabels = locus.artifactIds
      .map((artifactId) => index.artifactById.get(artifactId)?.title)
      .filter((title): title is string => Boolean(title))
    const actorCount = actorLabels.length
    const artifactCount = artifactLabels.length
    return {
      id: locus.id,
      title: locus.title,
      summary: locus.summary,
      kindLabel: locusKindLabel(locus.locusKind),
      roomLabel: room?.title ?? undefined,
      actorLabels,
      artifactLabels,
      tone: artifactCount > 0 ? 'ready' : actorCount > 0 ? 'calm' : 'missing',
      accent: indexPosition % 2 === 0 ? '#f59e0b' : '#38bdf8',
    }
  })
}

function buildLocusPreview(
  index: ReturnType<typeof buildWorldIndex>,
  locusId: string | null,
): WorldLocusPreview | undefined {
  if (!locusId) return undefined
  const locus = index.locusById.get(locusId)
  if (!locus) return undefined
  const locusActors = displayActorsForLocus(index, locus)
  const locusArtifacts = locus.artifactIds
    .map((artifactId) => index.artifactById.get(artifactId))
    .filter((artifact): artifact is NonNullable<typeof artifact> => artifact !== undefined)
  return {
    title: locus.title,
    summary: locus.summary,
    kindLabel: locusKindLabel(locus.locusKind),
    actorLabels: locusActors.map((actor) => actor.title),
    actorItems: locusActors.map((actor) =>
      buildStageItem(`locus-preview-actor-${actor.id}`, actor.title, worldRef(actor.kind, actor.id)),
    ),
    artifactLabels: locusArtifacts.map((artifact) => artifact.title),
    artifactItems: locusArtifacts.map((artifact) =>
      buildStageItem(
        `locus-preview-artifact-${artifact.id}`,
        artifact.title,
        worldRef('artifact', artifact.id),
      ),
    ),
  }
}

function buildDrawer(
  id: string,
  label: string,
  focusRef?: WorldRef,
): WorldClosetDrawer {
  return {
    id,
    label,
    focusRef,
  }
}

function flattenProjectionDrawers(
  activeProjection: WorldProjectionStage,
): WorldClosetDrawer[] {
  const actionDrawers = activeProjection.cards.map((card) =>
    buildDrawer(
      `projection-card-${card.id}`,
      `${card.kind} -> ${card.title}`,
      card.focusRef,
    ),
  )
  const detailDrawers = (activeProjection.detailSections ?? []).flatMap((section) =>
    (section.items ?? []).map((item, index) =>
      buildDrawer(
        `${section.id}-${index}`,
        `${section.title} -> ${item.label}`,
        item.focusRef,
      ),
    ),
  )
  return [...actionDrawers, ...detailDrawers].slice(0, 8)
}

function buildClosetCards(
  index: ReturnType<typeof buildWorldIndex>,
  roomId: string | null,
  locusId: string | null,
  roomPreview: WorldRoomPreview | undefined,
  locusPreview: WorldLocusPreview | undefined,
  activeProjection: WorldProjectionStage,
): WorldClosetCard[] {
  const room = roomId ? index.roomById.get(roomId) ?? null : null
  const roomLoci = room ? listLociForRoom(index, room.id) : []
  const roomArtifacts = room ? listArtifactsForRoom(index, room.id) : []
  const roomTunnels = room ? listTunnelsForNode(index, room.id) : []
  const locus = locusId ? index.locusById.get(locusId) ?? null : null

  if (!roomPreview) {
    return activeProjection.detailSections?.length
      ? [
          {
            id: `projection-${activeProjection.id}`,
            title: `${activeProjection.modeLabel} closet`,
            summary: activeProjection.summary,
            sourceLabel: `${activeProjection.modeLabel} view`,
            drawers: flattenProjectionDrawers(activeProjection),
            tone: 'ready',
            accent: '#7dd3fc',
          },
        ]
      : []
  }

  const cards: WorldClosetCard[] = [
    {
      id: `projection-${activeProjection.id}`,
      title: `${activeProjection.modeLabel} closet`,
      summary: activeProjection.summary,
      sourceLabel: `${activeProjection.modeLabel} view`,
      drawers: flattenProjectionDrawers(activeProjection),
      tone: activeProjection.id === 'packet' ? 'ready' : activeProjection.id === 'fold' ? 'attention' : 'calm',
      accent: '#7dd3fc',
    },
    {
      id: 'closet-briefs',
      title: 'Brief closet',
      summary: 'Primary room briefs, launch surface, and memory bindings kept together.',
      sourceLabel: 'Room memory',
      drawers: [
        buildDrawer('brief-surface', `surface -> ${roomPreview.surfaceLabel}`, room ? worldRef('room', room.id) : undefined),
        buildDrawer('brief-memory', `memory -> ${roomPreview.memoryLabel}`, room ? worldRef('room', room.id) : undefined),
        buildDrawer('brief-summary', roomPreview.summary, room ? worldRef('room', room.id) : undefined),
        ...(roomPreview.desktopBrief ? [buildDrawer('brief-desktop', `desktop -> ${roomPreview.desktopBrief}`, room ? worldRef('room', room.id) : undefined)] : []),
        ...(roomPreview.phoneBrief ? [buildDrawer('brief-phone', `phone -> ${roomPreview.phoneBrief}`, room ? worldRef('room', room.id) : undefined)] : []),
      ],
      tone: 'calm',
      accent: '#84cc16',
    },
    {
      id: 'closet-anchors',
      title: 'Anchor closet',
      summary: 'Stable refs and loci that let the room collapse and unfold without losing shape.',
      sourceLabel: 'Memory bind',
      drawers: [
        ...roomPreview.anchorLabels.map((anchor, index) => buildDrawer(`anchor-${index + 1}`, anchor)),
        ...roomLoci.map((entry) =>
          buildDrawer(`locus-${entry.id}`, `locus -> ${entry.title}`, worldRef('locus', entry.id)),
        ),
      ],
      tone: roomPreview.anchorLabels.length > 0 ? 'ready' : 'attention',
      accent: '#f59e0b',
    },
    {
      id: 'closet-artifacts',
      title: 'Artifact closet',
      summary: 'Documents, evidence, and durable work objects currently surfaced by the room.',
      sourceLabel: 'Evidence',
      drawers: roomArtifacts.map((artifact) =>
        buildDrawer(`artifact-${artifact.id}`, `artifact -> ${artifact.title}`, worldRef('artifact', artifact.id)),
      ),
      tone: roomPreview.artifactLabels.length > 0 ? 'ready' : 'missing',
      accent: '#38bdf8',
    },
    {
      id: 'closet-continuity',
      title: 'Continuity closet',
      summary: 'Tunnels, runs, and open questions that keep the room moving forward.',
      sourceLabel: 'Continuity',
      drawers: [
        ...(roomPreview.latestRunLabel ? [buildDrawer('continuity-run', roomPreview.latestRunLabel, room ? worldRef('room', room.id) : undefined)] : []),
        ...roomTunnels.map((tunnel) => {
          const other = tunnel.from.id === room?.id ? tunnel.to : tunnel.from
          return buildDrawer(
            `tunnel-${tunnel.id}`,
            `tunnel -> ${tunnel.label}`,
            other.kind !== 'artifact' ? worldRef(other.kind, other.id) : worldRef('artifact', other.id),
          )
        }),
        ...roomPreview.openQuestionLabels.map((question, index) => buildDrawer(`question-${index + 1}`, `question -> ${question}`)),
      ],
      tone: roomPreview.openQuestionLabels.length > 0 ? 'attention' : 'calm',
      accent: '#fb7185',
    },
  ]

  if (locusPreview) {
    cards.push({
      id: 'closet-locus',
      title: `${locusPreview.title} closet`,
      summary: 'The active locus unfolded into its actors and attached artifacts.',
      sourceLabel: locusPreview.kindLabel,
      drawers: [
        ...(locus
          ? displayActorsForLocus(index, locus).map((actor) =>
              buildDrawer(`actor-${actor.id}`, `actor -> ${actor.title}`, worldRef(actor.kind, actor.id)),
            )
          : locusPreview.actorLabels.map((actor, index) => buildDrawer(`actor-${index + 1}`, `actor -> ${actor}`))),
        ...(locus
          ? locus.artifactIds
              .map((artifactId) => index.artifactById.get(artifactId))
              .filter((artifact): artifact is NonNullable<typeof artifact> => artifact !== undefined)
              .map((artifact) =>
                buildDrawer(`artifact-${artifact.id}`, `artifact -> ${artifact.title}`, worldRef('artifact', artifact.id)),
              )
          : locusPreview.artifactLabels.map((artifact, index) => buildDrawer(`artifact-${index + 1}`, `artifact -> ${artifact}`))),
      ],
      tone: 'ready',
      accent: '#2dd4bf',
    })
  }

  return cards.filter((card) => card.summary.trim() || card.drawers.length > 0)
}

function buildDrillStages(
  index: ReturnType<typeof buildWorldIndex>,
  graph: WorldGraph,
  snapshot: WorldShellWorkspaceSnapshot,
  selectedRoomId: string | null,
  selectedLocusId: string | null,
): WorldDrillStage[] {
  const earthLabel = snapshot.earthLabel ?? 'Planet Earth'
  const selectedRoom = selectedRoomId ? index.roomById.get(selectedRoomId) ?? null : null
  const selectedWing =
    selectedRoom
      ? index.wingById.get(selectedRoom.wingId) ?? null
      : graph.entryWingId
        ? index.wingById.get(graph.entryWingId) ?? null
        : graph.wings[0] ?? null
  const selectedLocus = selectedLocusId ? index.locusById.get(selectedLocusId) ?? null : null

  return [
    {
      id: 'earth',
      label: 'Earth',
      value: earthLabel,
      detail: `${graph.wings.length} wings online`,
    },
    {
      id: 'wing',
      label: 'Wing',
      value: selectedWing?.title ?? snapshot.workspaceName,
      detail: selectedWing
        ? `${selectedWing.roomIds.length} rooms in territory`
        : 'No active wing yet',
      disabled: !selectedWing,
    },
    {
      id: 'room',
      label: 'Room',
      value: selectedRoom?.title ?? 'No room selected',
      detail: selectedRoom
        ? `${displayActorsForRoom(index, selectedRoom.id).length} actors, ${selectedRoom.locusIds.length} loci`
        : 'Select a room to enter the work surface',
      disabled: !selectedRoom,
    },
    {
      id: 'locus',
      label: 'Locus',
      value: selectedLocus?.title ?? 'No locus selected',
      detail: selectedLocus
        ? `${locusKindLabel(selectedLocus.locusKind)} • ${selectedLocus.artifactIds.length} artifacts`
        : 'Select a room locus to unfold the interior memory structure',
      disabled: !selectedLocus,
    },
  ]
}

function buildProjectionStage(
  index: ReturnType<typeof buildWorldIndex>,
  graph: WorldGraph,
  snapshot: WorldShellWorkspaceSnapshot,
  problemsById: Map<string, WorkflowCard>,
  roomId: string | null,
  locusId: string | null,
  focusRef: WorldRef | null,
  mode: ProjectionMode,
): WorldProjectionStage {
  const selectedChip = PROJECTION_CHIPS[mode]
  const selectedRoom = roomId ? index.roomById.get(roomId) ?? null : null
  const selectedLocus = locusId ? index.locusById.get(locusId) ?? null : null
  const selectedProblem = roomId ? problemsById.get(roomId) ?? null : null
  const selectedFocus = resolveWorldNodeFromIndex(index, focusRef)
  const blueprint = selectedProblem ? buildProblemSessionBlueprint(selectedProblem, 'palace') : null
  const roomTunnels = selectedRoom ? listTunnelsForNode(index, selectedRoom.id).map((tunnel) => tunnel.label) : []

  const projection = buildProjection(graph, focusRef, mode)
  const nodeTitleById = new Map(projection.cards.map((card) => [card.id, card.title]))
  const roomActorItems = selectedRoom
    ? displayActorsForRoom(index, selectedRoom.id).map((actor) =>
        buildStageItem(`actor-${actor.id}`, `actor -> ${actor.title}`, worldRef(actor.kind, actor.id)),
      )
    : []
  const roomLocusItems = selectedRoom
    ? listLociForRoom(index, selectedRoom.id).map((locus) =>
        buildStageItem(`locus-${locus.id}`, `locus -> ${locus.title}`, worldRef('locus', locus.id)),
      )
    : []
  const roomArtifactItems = selectedRoom
    ? listArtifactsForRoom(index, selectedRoom.id).map((artifact) =>
        buildStageItem(
          `artifact-${artifact.id}`,
          `artifact -> ${artifact.title}`,
          worldRef('artifact', artifact.id),
        ),
      )
    : []
  const roomTunnelItems = selectedRoom
    ? listTunnelsForNode(index, selectedRoom.id).map((tunnel) => {
        const other = tunnel.from.id === selectedRoom.id ? tunnel.to : tunnel.from
        return buildStageItem(
          `tunnel-${tunnel.id}`,
          `tunnel -> ${tunnel.label}`,
          worldRef(other.kind, other.id),
        )
      })
    : []
  const locusActorItems = selectedLocus
    ? displayActorsForLocus(index, selectedLocus).map((actor) =>
        buildStageItem(`locus-actor-${actor.id}`, `actor -> ${actor.title}`, worldRef(actor.kind, actor.id)),
      )
    : []
  const locusArtifactItems = selectedLocus
    ? selectedLocus.artifactIds
        .map((artifactId) => index.artifactById.get(artifactId))
        .filter((artifact): artifact is NonNullable<typeof artifact> => artifact !== undefined)
        .map((artifact) =>
          buildStageItem(
            `locus-artifact-${artifact.id}`,
            `artifact -> ${artifact.title}`,
            worldRef('artifact', artifact.id),
          ),
        )
    : []
  const trailheadItems = [
    ...(selectedProblem?.openQuestions ?? []).map((question, index) =>
      buildStageItem(`question-${index + 1}`, `question -> ${question}`),
    ),
    ...(blueprint && blueprint.anchors.length === 0
      ? [buildStageItem('anchor-missing', 'anchor -> add a memory anchor', selectedRoom ? worldRef('room', selectedRoom.id) : undefined)]
      : []),
    ...(roomTunnels.length > 1
      ? [
          buildStageItem(
            'tunnels-summary',
            `tunnels -> ${roomTunnels.length} routes cross this room`,
            selectedRoom ? worldRef('room', selectedRoom.id) : undefined,
          ),
        ]
      : []),
  ]
  const cards = projection.cards.slice(0, 6).map((card) => ({
    id: card.id,
    title: card.title,
    summary: card.summary,
    kind: kindLabel(card.kind),
    emphasis: card.emphasis,
    focusRef: worldRef(card.kind, card.id),
  }))
  const links = projection.links.slice(0, 5).map((link) => ({
    id: link.id,
    label: link.label,
    detail: `${nodeTitleById.get(link.fromId) ?? link.fromId} -> ${nodeTitleById.get(link.toId) ?? link.toId}`,
    kind: link.kind,
    focusRef: resolveWorldRefById(index, link.toId),
  }))

  const locusDetailSection = selectedLocus
    ? [
        {
          id: 'locus-focus',
          title: 'Locus focus',
          style: 'list' as const,
          tone: 'ready' as const,
          copy: `${selectedLocus.title} is the active ${locusKindLabel(selectedLocus.locusKind).toLowerCase()} in this room skeleton.`,
          items: limitStageItems([
            buildStageItem(
              'locus-kind',
              `kind -> ${locusKindLabel(selectedLocus.locusKind)}`,
              worldRef('locus', selectedLocus.id),
            ),
            ...locusActorItems,
            ...locusArtifactItems,
          ], 6),
        },
      ]
    : []

  const detailSections =
    mode === 'fold'
      ? [
          {
            id: 'crease-program',
            title: 'Crease program',
            style: 'bands' as const,
            tone: 'attention' as const,
            copy: blueprint
              ? 'Folded context stays compact, but every band still points back to a room, a locus, or a live brief.'
              : 'Select a room to generate a reversible fold program.',
            items: blueprint
              ? limitStageItems([
                  buildStageItem(
                    'fold-north-star',
                    `north star -> ${blueprint.contextSummary}`,
                    selectedRoom ? worldRef('room', selectedRoom.id) : undefined,
                  ),
                  buildStageItem(
                    'fold-room-bind',
                    `room bind -> ${blueprint.memoryWing}/${blueprint.memoryRoom}`,
                    selectedRoom ? worldRef('room', selectedRoom.id) : undefined,
                  ),
                  ...blueprint.visualLoci.map((locus) =>
                    buildStageItem(
                      `fold-locus-${locus.id}`,
                      `${memoryPalaceKindLabel(locus.kind).toLowerCase()} -> ${locus.title}: ${compactLabel(locus.detail)}`,
                      locusRefForBlueprint(index, selectedRoom?.id ?? null, locus.id),
                    ),
                  ),
                ], 5)
              : [],
          },
          {
            id: 'drawers',
            title: 'Closets and drawers',
            style: 'list' as const,
            copy: 'Summaries stay on the surface; the exact artifacts remain one unfold away.',
            items: blueprint
              ? limitStageItems([
                  ...blueprint.anchors.map((anchor, index) =>
                    buildStageItem(
                      `anchor-${index + 1}`,
                      `drawer -> ${compactLabel(anchor)}`,
                      selectedRoom ? worldRef('room', selectedRoom.id) : undefined,
                    ),
                  ),
                  ...roomArtifactItems,
                ])
              : [],
          },
          ...locusDetailSection,
        ]
      : mode === 'outline'
        ? [
            {
              id: 'outline-actors',
              title: 'Actors and loci',
              style: 'list' as const,
              items: limitStageItems([
                ...roomActorItems,
                ...roomLocusItems,
              ], 6),
            },
            {
              id: 'outline-room',
              title: 'Room outline',
              style: 'list' as const,
              copy: blueprint?.contextSummary ?? selectedRoom?.summary,
              items: limitStageItems([
                ...(blueprint
                  ? [
                      buildStageItem(
                        'outline-memory',
                        `memory -> ${blueprint.memoryWing}/${blueprint.memoryRoom}`,
                        selectedRoom ? worldRef('room', selectedRoom.id) : undefined,
                      ),
                    ]
                  : []),
                ...roomArtifactItems,
                ...trailheadItems,
              ], 6),
            },
            ...locusDetailSection,
          ]
        : mode === 'packet'
          ? [
              {
                id: 'packet-core',
                title: 'Relay packet',
                style: 'packet' as const,
                tone: 'ready' as const,
                copy: 'A compact machine-readable handoff with device, room, anchors, and continuity fields.',
                items: blueprint
                  ? limitStageItems([
                      buildStageItem(
                        'packet-focus-node',
                        `focus_node: ${selectedFocus?.title ?? snapshot.workspaceName}`,
                        focusRef ?? (selectedRoom ? worldRef('room', selectedRoom.id) : undefined),
                      ),
                      ...(selectedLocus
                        ? [
                            buildStageItem(
                              'packet-focus-locus',
                              `focus_locus: ${selectedLocus.title}`,
                              worldRef('locus', selectedLocus.id),
                            ),
                          ]
                        : []),
                      ...blueprint.handoffLines.map((line, lineIndex) => {
                        if (line.startsWith('room_id: ')) {
                          return buildStageItem(`packet-line-${lineIndex}`, line, selectedRoom ? worldRef('room', selectedRoom.id) : undefined)
                        }
                        if (line.startsWith('memory_wing: ')) {
                          return buildStageItem(`packet-line-${lineIndex}`, line, selectedRoom ? worldRef('wing', selectedRoom.wingId) : undefined)
                        }
                        if (line.startsWith('memory_room: ')) {
                          return buildStageItem(`packet-line-${lineIndex}`, line, selectedRoom ? worldRef('room', selectedRoom.id) : undefined)
                        }
                        if (line.startsWith('context_summary: ')) {
                          return buildStageItem(`packet-line-${lineIndex}`, line, selectedRoom ? worldRef('room', selectedRoom.id) : undefined)
                        }
                        if (line.startsWith('anchors: ')) {
                          return buildStageItem(`packet-line-${lineIndex}`, line, selectedRoom ? worldRef('room', selectedRoom.id) : undefined)
                        }
                        if (line.startsWith('phone_brief: ') || line.startsWith('desktop_brief: ')) {
                          return buildStageItem(`packet-line-${lineIndex}`, line, selectedRoom ? worldRef('room', selectedRoom.id) : undefined)
                        }
                        const palaceLocusMatch = line.match(/^palace_locus_(\d+): /)
                        if (palaceLocusMatch) {
                          const locusIndex = Number(palaceLocusMatch[1]) - 1
                          const packetLocus = blueprint.visualLoci[locusIndex]
                          return buildStageItem(
                            `packet-line-${lineIndex}`,
                            line,
                            packetLocus
                              ? locusRefForBlueprint(index, selectedRoom?.id ?? null, packetLocus.id)
                              : undefined,
                          )
                        }
                        return buildStageItem(`packet-line-${lineIndex}`, line)
                      }),
                      ...(selectedProblem?.openQuestions?.length
                        ? [
                            buildStageItem(
                              'packet-open-questions',
                              `open_questions: ${selectedProblem.openQuestions.join(' | ')}`,
                            ),
                          ]
                        : []),
                    ], 8)
                  : [],
              },
              {
                id: 'packet-refs',
                title: 'Source refs',
                style: 'list' as const,
                items: blueprint
                  ? limitStageItems(
                      blueprint.sourceRefs.map((ref, index) => {
                        const focusTarget =
                          ref.startsWith('dewdrops/cards/')
                            ? selectedRoom
                              ? worldRef('room', selectedRoom.id)
                              : undefined
                            : ref.startsWith('lifegirdle/wings/')
                              ? selectedRoom
                                ? worldRef('wing', selectedRoom.wingId)
                                : undefined
                              : undefined
                        return buildStageItem(`packet-ref-${index}`, compactLabel(ref), focusTarget)
                      }),
                    )
                  : [],
              },
            ]
          : mode === 'wing'
            ? [
                {
                  id: 'wing-map',
                  title: 'Wing map',
                  style: 'list' as const,
                  copy: 'Rooms, actors, and tunnels grouped as one territory.',
                  items: limitStageItems([
                    ...graph.rooms.map((room) =>
                      buildStageItem(`wing-room-${room.id}`, `room -> ${room.title}`, worldRef('room', room.id)),
                    ),
                    ...displayActors(graph.actors).slice(0, 4).map((actor) =>
                      buildStageItem(`wing-actor-${actor.id}`, `actor -> ${actor.title}`, worldRef(actor.kind, actor.id)),
                    ),
                  ], 6),
                },
              ]
            : mode === 'earth'
              ? [
                  {
                    id: 'earth-return',
                    title: 'Magnetic return',
                    style: 'list' as const,
                    copy: 'Earth remembers the last active territory and can drop back into the current room instantly.',
                    items: limitStageItems([
                      ...graph.wings.map((wing) =>
                        buildStageItem(`earth-wing-${wing.id}`, `wing -> ${wing.title}`, worldRef('wing', wing.id)),
                      ),
                      ...(selectedRoom
                        ? [
                            buildStageItem(
                              'earth-resume',
                              `resume -> ${selectedRoom.title}`,
                              worldRef('room', selectedRoom.id),
                            ),
                          ]
                        : []),
                    ], 5),
                  },
                ]
              : [
                  {
                    id: 'room-brief',
                    title: 'Room brief',
                    style: 'list' as const,
                    copy: blueprint?.contextSummary ?? selectedRoom?.summary,
                    items: limitStageItems([
                      ...roomActorItems,
                      ...roomTunnelItems,
                      ...trailheadItems,
                    ], 6),
                  },
                  ...locusDetailSection,
                ]

  if (mode === 'earth') {
    return {
      id: mode,
      modeLabel: selectedChip.label,
      modeDetail: selectedChip.detail,
      focusTitle: snapshot.earthLabel ?? 'Planet Earth',
      summary: `${graph.wings.length} wing${graph.wings.length === 1 ? '' : 's'} • ${graph.rooms.length} rooms • ${displayActors(graph.actors).length} actors`,
      breadcrumb: [snapshot.earthLabel ?? 'Planet Earth', snapshot.workspaceName],
      breadcrumbItems: buildBreadcrumbItems(index, graph, snapshot, null, selectedRoom?.id ?? null),
      stats: [`${cards.length} nodes`, `${links.length} links`, `${graph.rooms.length} rooms online`],
      cards,
      links,
      returnVectors: buildReturnVectors(index, graph, snapshot, focusRef, selectedRoom?.id ?? null, selectedLocus?.id ?? null),
      detailSections,
    }
  }

  return {
    id: mode,
    modeLabel: selectedChip.label,
    modeDetail: selectedChip.detail,
    focusTitle: projection.title,
    summary: projection.summary,
    breadcrumb: projection.breadcrumb,
    breadcrumbItems: buildBreadcrumbItems(index, graph, snapshot, focusRef, selectedRoom?.id ?? null),
    stats: [`${cards.length} nodes`, `${links.length} links`, `${focusStageForRef(focusRef)} focus`],
    cards,
    links,
    returnVectors: buildReturnVectors(index, graph, snapshot, focusRef, selectedRoom?.id ?? null, selectedLocus?.id ?? null),
    detailSections,
  }
}

export function buildWorldShellData(
  graph: WorldGraph,
  snapshot: WorldShellWorkspaceSnapshot,
): WorldShellData {
  const index = buildWorldIndex(graph)
  const problemsById = problemByRoomId(snapshot.cards)
  const projectionMode = snapshot.selectedProjectionId ?? 'room'
  const roomCards = buildRoomCards(index, graph, problemsById)
  const fallbackRoomId =
    snapshot.focusedProblemId ?? graph.entryRoomId ?? roomCards[0]?.id ?? null
  const activeFocusRef = normalizeFocusRef(
    index,
    graph,
    snapshot.selectedFocusRef,
    fallbackRoomId,
    projectionMode,
  )
  const selectedRoomId = resolveRoomIdForFocus(index, activeFocusRef, fallbackRoomId)
  const selectedLocusId = resolveLocusIdForFocus(index, activeFocusRef, selectedRoomId)
  const selectedRoomCard =
    roomCards.find((room) => room.id === selectedRoomId) ?? roomCards[0] ?? null
  const selectedDrillStageId = focusStageForRef(activeFocusRef)
  const entryWing =
    (graph.entryWingId ? index.wingById.get(graph.entryWingId) : null) ?? graph.wings[0] ?? null
  const locusPreview = buildLocusPreview(index, selectedLocusId)
  const activeProjection = buildProjectionStage(
    index,
    graph,
    snapshot,
    problemsById,
    selectedRoomCard?.id ?? null,
    selectedLocusId,
    activeFocusRef,
    projectionMode,
  )
  const roomPreview = buildRoomPreview(index, graph, problemsById, selectedRoomCard?.id)
  const closetCards = buildClosetCards(
    index,
    selectedRoomCard?.id ?? null,
    selectedLocusId,
    roomPreview,
    locusPreview,
    activeProjection,
  )

  return {
    title: snapshot.workspaceName,
    subtitle:
      entryWing?.summary ??
      'A spatial operating surface where context stays attached to rooms, actors, and work.',
    heroCopy: selectedRoomCard
      ? `Resume ${selectedRoomCard.title} through a context tunnel that preserves the room, the loci, and the active fold.`
      : 'Open the world shell and drop back into the room you left without reconstructing context from scratch.',
    hierarchy: buildHierarchy(index, graph, snapshot, selectedRoomCard),
    projectionChips: [
      PROJECTION_CHIPS.earth,
      PROJECTION_CHIPS.wing,
      PROJECTION_CHIPS.room,
      PROJECTION_CHIPS.fold,
      PROJECTION_CHIPS.outline,
      PROJECTION_CHIPS.packet,
    ],
    activeProjection,
    roomCards,
    roomPreview,
    selectedProjectionId: projectionMode,
    selectedRoomId: selectedRoomCard?.id ?? null,
    drillStages: buildDrillStages(index, graph, snapshot, selectedRoomCard?.id ?? null, selectedLocusId),
    selectedDrillStageId,
    locusCards: buildLocusCards(index, selectedRoomCard?.id ?? null),
    selectedLocusId,
    locusPreview,
    closetCards,
    selectedClosetId: closetCards.find((closet) => closet.id.startsWith('projection-'))?.id ?? closetCards[0]?.id ?? null,
  }
}
