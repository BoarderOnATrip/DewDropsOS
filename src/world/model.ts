export type SpatialPoint = {
  x: number
  y: number
  z?: number
}

export const originPoint = (): SpatialPoint => ({ x: 0, y: 0, z: 0 })

export type WorldNodeKind =
  | 'wing'
  | 'person'
  | 'animal'
  | 'plant'
  | 'organization'
  | 'agent'
  | 'room'
  | 'locus'
  | 'artifact'

export type WorldRef = {
  kind: WorldNodeKind
  id: string
}

export const worldRef = (kind: WorldNodeKind, id: string): WorldRef => ({ kind, id })

type BaseNode = {
  id: string
  title: string
  summary: string
  position: SpatialPoint
  tags: string[]
}

type BaseNodeLike = BaseNode & {
  kind: string
}

export type Wing = BaseNode & {
  kind: 'wing'
  color: string
  roomIds: string[]
  actorIds: string[]
}

export type Person = BaseNode & {
  kind: 'person'
  wingId: string
  roomIds: string[]
  pronouns?: string
}

export type Animal = BaseNode & {
  kind: 'animal'
  wingId: string
  roomIds: string[]
  species: string
}

export type Plant = BaseNode & {
  kind: 'plant'
  wingId: string
  roomIds: string[]
  species: string
}

export type Organization = BaseNode & {
  kind: 'organization'
  wingId: string
  roomIds: string[]
  memberActorIds: string[]
}

export type AgentProvider = 'codex' | 'claude' | 'grok' | 'paperclip' | 'custom'

export type Agent = BaseNode & {
  kind: 'agent'
  wingId: string
  roomIds: string[]
  provider: AgentProvider
  active: boolean
}

export type LifeForm = Person | Animal | Plant
export type Actor = LifeForm | Organization | Agent

export type Room = BaseNode & {
  kind: 'room'
  wingId: string
  actorIds: string[]
  locusIds: string[]
  artifactIds: string[]
  tunnelIds: string[]
  tone: string
}

export type LocusKind =
  | 'door'
  | 'table'
  | 'wall'
  | 'drawer'
  | 'window'
  | 'floor'
  | 'console'
  | 'archive'
  | 'platform'

export type Locus = BaseNode & {
  kind: 'locus'
  roomId: string
  locusKind: LocusKind
  actorIds: string[]
  artifactIds: string[]
}

export type ArtifactKind = 'note' | 'document' | 'message' | 'image' | 'plan' | 'recording' | 'task' | 'tool' | 'model'

export type Artifact = BaseNode & {
  kind: 'artifact'
  roomId: string
  locusId?: string
  artifactKind: ArtifactKind
  actorIds: string[]
}

export type TunnelKind = 'relationship' | 'handoff' | 'memory' | 'route' | 'task' | 'provenance'

export type Tunnel = {
  kind: 'tunnel'
  id: string
  from: WorldRef
  to: WorldRef
  label: string
  summary: string
  tunnelKind: TunnelKind
  tags: string[]
}

export type WorldNode = Wing | Actor | Room | Locus | Artifact

export type WorldGraph = {
  id: string
  title: string
  summary: string
  entryWingId?: string
  entryRoomId?: string
  wings: Wing[]
  actors: Actor[]
  rooms: Room[]
  loci: Locus[]
  artifacts: Artifact[]
  tunnels: Tunnel[]
}

export type WorldIndex = {
  wingById: Map<string, Wing>
  actorById: Map<string, Actor>
  roomById: Map<string, Room>
  locusById: Map<string, Locus>
  artifactById: Map<string, Artifact>
  tunnelById: Map<string, Tunnel>
  roomsByWingId: Map<string, Room[]>
  actorsByWingId: Map<string, Actor[]>
  actorsByRoomId: Map<string, Actor[]>
  lociByRoomId: Map<string, Locus[]>
  artifactsByRoomId: Map<string, Artifact[]>
  tunnelsByNodeId: Map<string, Tunnel[]>
}

export type ProjectionMode = 'earth' | 'wing' | 'room' | 'fold' | 'outline' | 'packet'

export type ProjectionCard = {
  id: string
  kind: WorldNodeKind
  title: string
  summary: string
  x: number
  y: number
  depth: number
  emphasis: 'focus' | 'related' | 'supporting'
}

export type ProjectionLinkKind = 'containment' | 'relationship' | 'tunnel' | 'reference'

export type ProjectionLink = {
  id: string
  fromId: string
  toId: string
  label: string
  kind: ProjectionLinkKind
}

export type Projection = {
  kind: 'projection'
  mode: ProjectionMode
  title: string
  summary: string
  focus: WorldRef | null
  breadcrumb: string[]
  cards: ProjectionCard[]
  links: ProjectionLink[]
}

const worldNodeKinds: WorldNodeKind[] = [
  'wing',
  'person',
  'animal',
  'plant',
  'organization',
  'agent',
  'room',
  'locus',
  'artifact',
]

const baseNodeKinds = new Set<WorldNodeKind>(worldNodeKinds)

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const hasString = (value: Record<string, unknown>, key: string): value is Record<string, unknown> & Record<typeof key, string> =>
  typeof value[key] === 'string'

const isBaseNode = (value: unknown): value is BaseNodeLike =>
  isObject(value) &&
  hasString(value, 'id') &&
  hasString(value, 'title') &&
  hasString(value, 'summary') &&
  hasString(value, 'kind')

export const isWorldRef = (value: unknown): value is WorldRef =>
  isObject(value) && hasString(value, 'kind') && hasString(value, 'id') && baseNodeKinds.has(value.kind as WorldNodeKind)

export const isWing = (value: unknown): value is Wing =>
  isBaseNode(value) &&
  value.kind === 'wing' &&
  hasString(value, 'color') &&
  Array.isArray(value.roomIds) &&
  Array.isArray(value.actorIds)

export const isPerson = (value: unknown): value is Person =>
  isBaseNode(value) &&
  value.kind === 'person' &&
  hasString(value, 'wingId') &&
  Array.isArray(value.roomIds)

export const isAnimal = (value: unknown): value is Animal =>
  isBaseNode(value) &&
  value.kind === 'animal' &&
  hasString(value, 'wingId') &&
  hasString(value, 'species') &&
  Array.isArray(value.roomIds)

export const isPlant = (value: unknown): value is Plant =>
  isBaseNode(value) &&
  value.kind === 'plant' &&
  hasString(value, 'wingId') &&
  hasString(value, 'species') &&
  Array.isArray(value.roomIds)

export const isOrganization = (value: unknown): value is Organization =>
  isBaseNode(value) &&
  value.kind === 'organization' &&
  hasString(value, 'wingId') &&
  Array.isArray(value.roomIds) &&
  Array.isArray(value.memberActorIds)

export const isAgent = (value: unknown): value is Agent =>
  isBaseNode(value) &&
  value.kind === 'agent' &&
  hasString(value, 'wingId') &&
  Array.isArray(value.roomIds) &&
  typeof value.active === 'boolean'

export const isActor = (value: unknown): value is Actor =>
  isPerson(value) || isAnimal(value) || isPlant(value) || isOrganization(value) || isAgent(value)

export const isRoom = (value: unknown): value is Room =>
  isBaseNode(value) &&
  value.kind === 'room' &&
  hasString(value, 'wingId') &&
  Array.isArray(value.actorIds) &&
  Array.isArray(value.locusIds) &&
  Array.isArray(value.artifactIds) &&
  Array.isArray(value.tunnelIds) &&
  hasString(value, 'tone')

export const isLocus = (value: unknown): value is Locus =>
  isBaseNode(value) &&
  value.kind === 'locus' &&
  hasString(value, 'roomId') &&
  hasString(value, 'locusKind') &&
  Array.isArray(value.actorIds) &&
  Array.isArray(value.artifactIds)

export const isArtifact = (value: unknown): value is Artifact =>
  isBaseNode(value) &&
  value.kind === 'artifact' &&
  hasString(value, 'roomId') &&
  hasString(value, 'artifactKind') &&
  Array.isArray(value.actorIds)

export const isTunnel = (value: unknown): value is Tunnel =>
  isObject(value) &&
  hasString(value, 'id') &&
  hasString(value, 'label') &&
  hasString(value, 'summary') &&
  hasString(value, 'tunnelKind') &&
  isWorldRef(value.from) &&
  isWorldRef(value.to)

export const isWorldNode = (value: unknown): value is WorldNode =>
  isWing(value) || isActor(value) || isRoom(value) || isLocus(value) || isArtifact(value)

export const buildWorldIndex = (graph: WorldGraph): WorldIndex => {
  const wingById = new Map(graph.wings.map((wing) => [wing.id, wing]))
  const actorById = new Map(graph.actors.map((actor) => [actor.id, actor]))
  const roomById = new Map(graph.rooms.map((room) => [room.id, room]))
  const locusById = new Map(graph.loci.map((locus) => [locus.id, locus]))
  const artifactById = new Map(graph.artifacts.map((artifact) => [artifact.id, artifact]))
  const tunnelById = new Map(graph.tunnels.map((tunnel) => [tunnel.id, tunnel]))

  const roomsByWingId = new Map<string, Room[]>()
  const actorsByWingId = new Map<string, Actor[]>()
  const actorsByRoomId = new Map<string, Actor[]>()
  const lociByRoomId = new Map<string, Locus[]>()
  const artifactsByRoomId = new Map<string, Artifact[]>()
  const tunnelsByNodeId = new Map<string, Tunnel[]>()

  const push = <T>(map: Map<string, T[]>, key: string, value: T) => {
    const existing = map.get(key)
    if (existing) {
      existing.push(value)
      return
    }
    map.set(key, [value])
  }

  for (const wing of graph.wings) {
    for (const roomId of wing.roomIds) {
      const room = roomById.get(roomId)
      if (room) {
        push(roomsByWingId, wing.id, room)
      }
    }

    for (const actorId of wing.actorIds) {
      const actor = actorById.get(actorId)
      if (actor) {
        push(actorsByWingId, wing.id, actor)
      }
    }
  }

  for (const room of graph.rooms) {
    for (const actorId of room.actorIds) {
      const actor = actorById.get(actorId)
      if (actor) {
        push(actorsByRoomId, room.id, actor)
      }
    }

    for (const locusId of room.locusIds) {
      const locus = locusById.get(locusId)
      if (locus) {
        push(lociByRoomId, room.id, locus)
      }
    }

    for (const artifactId of room.artifactIds) {
      const artifact = artifactById.get(artifactId)
      if (artifact) {
        push(artifactsByRoomId, room.id, artifact)
      }
    }
  }

  for (const tunnel of graph.tunnels) {
    push(tunnelsByNodeId, tunnel.from.id, tunnel)
    push(tunnelsByNodeId, tunnel.to.id, tunnel)
  }

  return {
    wingById,
    actorById,
    roomById,
    locusById,
    artifactById,
    tunnelById,
    roomsByWingId,
    actorsByWingId,
    actorsByRoomId,
    lociByRoomId,
    artifactsByRoomId,
    tunnelsByNodeId,
  }
}

export const resolveWorldNode = (graph: WorldGraph, ref: WorldRef | null | undefined): WorldNode | null => {
  if (!ref) {
    return null
  }

  const index = buildWorldIndex(graph)
  return resolveWorldNodeFromIndex(index, ref)
}

export const resolveWorldNodeFromIndex = (
  index: WorldIndex,
  ref: WorldRef | null | undefined,
): WorldNode | null => {
  if (!ref) {
    return null
  }

  switch (ref.kind) {
    case 'wing':
      return index.wingById.get(ref.id) ?? null
    case 'person':
    case 'animal':
    case 'plant':
    case 'organization':
    case 'agent':
      return index.actorById.get(ref.id) ?? null
    case 'room':
      return index.roomById.get(ref.id) ?? null
    case 'locus':
      return index.locusById.get(ref.id) ?? null
    case 'artifact':
      return index.artifactById.get(ref.id) ?? null
    default:
      return null
  }
}

export const getParentWorldRef = (
  graph: WorldGraph,
  ref: WorldRef | null | undefined,
): WorldRef | null => {
  if (!ref) return null
  return getParentWorldRefFromIndex(buildWorldIndex(graph), ref)
}

export const getParentWorldRefFromIndex = (
  index: WorldIndex,
  ref: WorldRef | null | undefined,
): WorldRef | null => {
  if (!ref) return null

  switch (ref.kind) {
    case 'wing':
      return null
    case 'room': {
      const room = index.roomById.get(ref.id)
      return room ? worldRef('wing', room.wingId) : null
    }
    case 'locus': {
      const locus = index.locusById.get(ref.id)
      return locus ? worldRef('room', locus.roomId) : null
    }
    case 'artifact': {
      const artifact = index.artifactById.get(ref.id)
      if (!artifact) return null
      if (artifact.locusId && index.locusById.has(artifact.locusId)) {
        return worldRef('locus', artifact.locusId)
      }
      return worldRef('room', artifact.roomId)
    }
    case 'person':
    case 'animal':
    case 'plant':
    case 'organization':
    case 'agent': {
      const actor = index.actorById.get(ref.id)
      if (!actor) return null
      return actor.roomIds[0]
        ? worldRef('room', actor.roomIds[0])
        : worldRef('wing', actor.wingId)
    }
    default:
      return null
  }
}

export const listDrillTargets = (
  graph: WorldGraph,
  ref: WorldRef | null | undefined,
): WorldRef[] => listDrillTargetsFromIndex(buildWorldIndex(graph), ref)

export const listDrillTargetsFromIndex = (
  index: WorldIndex,
  ref: WorldRef | null | undefined,
): WorldRef[] => {
  if (!ref) {
    return [...index.wingById.values()].map((wing) => worldRef('wing', wing.id))
  }

  switch (ref.kind) {
    case 'wing':
      return listRoomsForWing(index, ref.id).map((room) => worldRef('room', room.id))
    case 'room':
      return listLociForRoom(index, ref.id).map((locus) => worldRef('locus', locus.id))
    case 'locus': {
      const locus = index.locusById.get(ref.id)
      return (locus?.artifactIds ?? []).map((artifactId) => worldRef('artifact', artifactId))
    }
    default:
      return []
  }
}

export const listRoomsForWing = (index: WorldIndex, wingId: string): Room[] =>
  index.roomsByWingId.get(wingId)?.slice() ?? []

export const listActorsForWing = (index: WorldIndex, wingId: string): Actor[] =>
  index.actorsByWingId.get(wingId)?.slice() ?? []

export const listActorsForRoom = (index: WorldIndex, roomId: string): Actor[] =>
  index.actorsByRoomId.get(roomId)?.slice() ?? []

export const listLociForRoom = (index: WorldIndex, roomId: string): Locus[] =>
  index.lociByRoomId.get(roomId)?.slice() ?? []

export const listArtifactsForRoom = (index: WorldIndex, roomId: string): Artifact[] =>
  index.artifactsByRoomId.get(roomId)?.slice() ?? []

export const listTunnelsForNode = (index: WorldIndex, nodeId: string): Tunnel[] =>
  index.tunnelsByNodeId.get(nodeId)?.slice() ?? []

export const describeWorldNode = (node: WorldNode): string => `${node.title} (${node.kind})`

export const describeWorldRef = (graph: WorldGraph, ref: WorldRef): string => {
  const node = resolveWorldNode(graph, ref)
  return node ? describeWorldNode(node) : `${ref.kind}:${ref.id}`
}

const nodeKindOrder: Record<WorldNodeKind, number> = {
  wing: 0,
  person: 1,
  animal: 1,
  plant: 1,
  organization: 2,
  agent: 2,
  room: 3,
  locus: 4,
  artifact: 5,
}

const modeLimit: Record<ProjectionMode, number> = {
  earth: 24,
  wing: 16,
  room: 14,
  fold: 10,
  outline: 12,
  packet: 7,
}

const focusSummary = (node: WorldNode): string => {
  switch (node.kind) {
    case 'wing':
      return `${node.roomIds.length} room${node.roomIds.length === 1 ? '' : 's'} and ${node.actorIds.length} actor${
        node.actorIds.length === 1 ? '' : 's'
      }`
    case 'person':
    case 'animal':
    case 'plant':
      return `${node.roomIds.length} room${node.roomIds.length === 1 ? '' : 's'}`
    case 'organization':
      return `${node.roomIds.length} room${node.roomIds.length === 1 ? '' : 's'} and ${node.memberActorIds.length} member${
        node.memberActorIds.length === 1 ? '' : 's'
      }`
    case 'agent':
      return `${node.provider} agent`
    case 'room':
      return `${node.actorIds.length} actor${node.actorIds.length === 1 ? '' : 's'}, ${node.locusIds.length} locus${
        node.locusIds.length === 1 ? '' : 's'
      }, ${node.artifactIds.length} artifact${node.artifactIds.length === 1 ? '' : 's'}`
    case 'locus':
      return `${node.actorIds.length} actor${node.actorIds.length === 1 ? '' : 's'} and ${node.artifactIds.length} artifact${
        node.artifactIds.length === 1 ? '' : 's'
      }`
    case 'artifact':
      return `${node.artifactKind} artifact`
  }
}

const buildBreadcrumb = (graph: WorldGraph, node: WorldNode, index: WorldIndex): string[] => {
  const trail = [graph.title]

  switch (node.kind) {
    case 'wing':
      trail.push(node.title)
      return trail
    case 'person':
    case 'animal':
    case 'plant':
    case 'organization':
    case 'agent': {
      const wing = index.wingById.get(node.wingId)
      if (wing) {
        trail.push(wing.title)
      }
      trail.push(node.title)
      return trail
    }
    case 'room': {
      const wing = index.wingById.get(node.wingId)
      if (wing) {
        trail.push(wing.title)
      }
      trail.push(node.title)
      return trail
    }
    case 'locus': {
      const room = index.roomById.get(node.roomId)
      const wing = room ? index.wingById.get(room.wingId) : null
      if (wing) {
        trail.push(wing.title)
      }
      if (room) {
        trail.push(room.title)
      }
      trail.push(node.title)
      return trail
    }
    case 'artifact': {
      const room = index.roomById.get(node.roomId)
      const wing = room ? index.wingById.get(room.wingId) : null
      if (wing) {
        trail.push(wing.title)
      }
      if (room) {
        trail.push(room.title)
      }
      trail.push(node.title)
      return trail
    }
  }
}

const pushRef = (refs: WorldRef[], seen: Set<string>, ref: WorldRef | null | undefined) => {
  if (!ref) {
    return
  }

  const key = `${ref.kind}:${ref.id}`
  if (seen.has(key)) {
    return
  }

  seen.add(key)
  refs.push(ref)
}

const roomRef = (roomId: string): WorldRef => ({ kind: 'room', id: roomId })

const actorRef = (actor: Actor): WorldRef => ({ kind: actor.kind, id: actor.id })

const wingRef = (wingId: string): WorldRef => ({ kind: 'wing', id: wingId })

const locusRef = (locusId: string): WorldRef => ({ kind: 'locus', id: locusId })

const artifactRef = (artifactId: string): WorldRef => ({ kind: 'artifact', id: artifactId })

const collectProjectionRefs = (
  graph: WorldGraph,
  index: WorldIndex,
  focus: WorldNode,
  mode: ProjectionMode,
): WorldRef[] => {
  const refs: WorldRef[] = []
  const seen = new Set<string>()

  pushRef(refs, seen, worldRef(focus.kind, focus.id))

  const includeRoom = (room: Room) => {
    pushRef(refs, seen, roomRef(room.id))
    const wing = index.wingById.get(room.wingId)
    if (wing) {
      pushRef(refs, seen, wingRef(wing.id))
    }
    for (const actor of listActorsForRoom(index, room.id)) {
      pushRef(refs, seen, actorRef(actor))
    }
    for (const locus of listLociForRoom(index, room.id)) {
      pushRef(refs, seen, locusRef(locus.id))
    }
    for (const artifact of listArtifactsForRoom(index, room.id)) {
      pushRef(refs, seen, artifactRef(artifact.id))
    }
    for (const tunnel of listTunnelsForNode(index, room.id)) {
      const other = tunnel.from.id === room.id ? tunnel.to : tunnel.from
      if (other.kind !== 'artifact') {
        pushRef(refs, seen, other)
      }
    }
  }

  const includeWing = (wing: Wing) => {
    pushRef(refs, seen, wingRef(wing.id))
    for (const room of listRoomsForWing(index, wing.id)) {
      pushRef(refs, seen, roomRef(room.id))
    }
    for (const actor of listActorsForWing(index, wing.id)) {
      pushRef(refs, seen, actorRef(actor))
    }
  }

  const includeActor = (actor: Actor) => {
    pushRef(refs, seen, actorRef(actor))
    const wing = index.wingById.get(actor.wingId)
    if (wing) {
      pushRef(refs, seen, wingRef(wing.id))
    }
    for (const roomId of actor.roomIds) {
      const room = index.roomById.get(roomId)
      if (room) {
        includeRoom(room)
      }
    }
  }

  const includeLocus = (locus: Locus) => {
    pushRef(refs, seen, locusRef(locus.id))
    const room = index.roomById.get(locus.roomId)
    if (room) {
      includeRoom(room)
    }
  }

  const includeArtifact = (artifact: Artifact) => {
    pushRef(refs, seen, artifactRef(artifact.id))
    const room = index.roomById.get(artifact.roomId)
    if (room) {
      includeRoom(room)
    }
    if (artifact.locusId) {
      const locus = index.locusById.get(artifact.locusId)
      if (locus) {
        includeLocus(locus)
      }
    }
  }

  if (focus.kind === 'wing') {
    includeWing(focus)
  } else if (focus.kind === 'room') {
    includeRoom(focus)
  } else if (focus.kind === 'person' || focus.kind === 'animal' || focus.kind === 'plant' || focus.kind === 'organization' || focus.kind === 'agent') {
    includeActor(focus)
  } else if (focus.kind === 'locus') {
    includeLocus(focus)
  } else if (focus.kind === 'artifact') {
    includeArtifact(focus)
  }

  if (mode === 'earth') {
    for (const wing of graph.wings) {
      includeWing(wing)
    }
  }

  if (mode === 'wing' && focus.kind !== 'wing') {
    const wing = 'wingId' in focus ? index.wingById.get(focus.wingId) : null
    if (wing) {
      includeWing(wing)
    }
  }

  const roomTunnels = focus.kind === 'room' ? listTunnelsForNode(index, focus.id) : []
  for (const tunnel of roomTunnels) {
    if (tunnel.from.kind !== 'artifact') {
      pushRef(refs, seen, tunnel.from)
    }
    if (tunnel.to.kind !== 'artifact') {
      pushRef(refs, seen, tunnel.to)
    }
  }

  return refs.slice(0, modeLimit[mode])
}

const nodeDepth = (kind: WorldNodeKind): number => nodeKindOrder[kind]

const buildCards = (graph: WorldGraph, index: WorldIndex, refs: WorldRef[], focus: WorldRef | null, mode: ProjectionMode): ProjectionCard[] => {
  const cards: ProjectionCard[] = []
  const focusKey = focus ? `${focus.kind}:${focus.id}` : null

  refs.forEach((ref, indexPosition) => {
    const node = resolveWorldNodeFromIndex(index, ref)
    if (!node) {
      return
    }

    const key = `${ref.kind}:${ref.id}`
    const emphasis =
      key === focusKey ? 'focus' : nodeDepth(node.kind) <= 2 || mode === 'earth' ? 'related' : 'supporting'

    cards.push({
      id: node.id,
      kind: node.kind,
      title: node.title,
      summary: node.summary,
      x: (indexPosition % 3) * 280,
      y: Math.floor(indexPosition / 3) * 180,
      depth: nodeDepth(node.kind),
      emphasis,
    })
  })

  return cards
}

const buildLinks = (graph: WorldGraph, index: WorldIndex, focus: WorldRef | null, refs: WorldRef[]): ProjectionLink[] => {
  const refSet = new Set(refs.map((ref) => `${ref.kind}:${ref.id}`))
  const links: ProjectionLink[] = []
  const seen = new Set<string>()

  const addLink = (fromId: string, toId: string, label: string, kind: ProjectionLinkKind) => {
    const key = `${kind}:${fromId}:${toId}:${label}`
    if (seen.has(key)) {
      return
    }
    seen.add(key)
    links.push({
      id: key,
      fromId,
      toId,
      label,
      kind,
    })
  }

  for (const wing of graph.wings) {
    if (!refSet.has(`wing:${wing.id}`)) {
      continue
    }

    for (const roomId of wing.roomIds) {
      if (refSet.has(`room:${roomId}`)) {
        addLink(wing.id, roomId, 'contains', 'containment')
      }
    }

    for (const actorId of wing.actorIds) {
      if (refSet.has(`person:${actorId}`) || refSet.has(`animal:${actorId}`) || refSet.has(`plant:${actorId}`) || refSet.has(`organization:${actorId}`) || refSet.has(`agent:${actorId}`)) {
        addLink(wing.id, actorId, 'hosts', 'containment')
      }
    }
  }

  for (const room of graph.rooms) {
    if (!refSet.has(`room:${room.id}`)) {
      continue
    }

    for (const actorId of room.actorIds) {
      if (refSet.has(`person:${actorId}`) || refSet.has(`animal:${actorId}`) || refSet.has(`plant:${actorId}`) || refSet.has(`organization:${actorId}`) || refSet.has(`agent:${actorId}`)) {
        addLink(room.id, actorId, 'anchors', 'containment')
      }
    }

    for (const locusId of room.locusIds) {
      if (refSet.has(`locus:${locusId}`)) {
        addLink(room.id, locusId, 'holds', 'containment')
      }
    }

    for (const artifactId of room.artifactIds) {
      if (refSet.has(`artifact:${artifactId}`)) {
        addLink(room.id, artifactId, 'keeps', 'containment')
      }
    }
  }

  for (const locus of graph.loci) {
    if (!refSet.has(`locus:${locus.id}`)) {
      continue
    }

    for (const artifactId of locus.artifactIds) {
      if (refSet.has(`artifact:${artifactId}`)) {
        addLink(locus.id, artifactId, 'focuses', 'containment')
      }
    }

    for (const actorId of locus.actorIds) {
      if (refSet.has(`person:${actorId}`) || refSet.has(`animal:${actorId}`) || refSet.has(`plant:${actorId}`) || refSet.has(`organization:${actorId}`) || refSet.has(`agent:${actorId}`)) {
        addLink(locus.id, actorId, 'frames', 'relationship')
      }
    }
  }

  for (const tunnel of graph.tunnels) {
    const fromKey = `${tunnel.from.kind}:${tunnel.from.id}`
    const toKey = `${tunnel.to.kind}:${tunnel.to.id}`
    if (refSet.has(fromKey) && refSet.has(toKey)) {
      addLink(tunnel.from.id, tunnel.to.id, tunnel.label, 'tunnel')
    }
  }

  if (focus) {
    const node = resolveWorldNode(graph, focus)
    if (node && node.kind === 'room') {
      for (const tunnel of listTunnelsForNode(index, node.id)) {
        const other = tunnel.from.id === node.id ? tunnel.to : tunnel.from
        if (refSet.has(`${other.kind}:${other.id}`)) {
          addLink(node.id, other.id, tunnel.label, 'tunnel')
        }
      }
    }
  }

  return links
}

export const buildProjection = (
  graph: WorldGraph,
  focus: WorldRef | null | undefined = null,
  mode: ProjectionMode = 'room',
): Projection => {
  const index = buildWorldIndex(graph)
  const resolvedFocus = resolveWorldNodeFromIndex(index, focus)
  const fallback =
    resolvedFocus ||
    (graph.entryRoomId ? index.roomById.get(graph.entryRoomId) : undefined) ||
    (graph.entryWingId ? index.wingById.get(graph.entryWingId) : undefined) ||
    graph.rooms[0] ||
    graph.wings[0] ||
    graph.actors[0] ||
    graph.loci[0] ||
    graph.artifacts[0] ||
    null

  const activeNode = fallback
  if (!activeNode) {
    return {
      kind: 'projection',
      mode,
      title: graph.title,
      summary: graph.summary,
      focus: null,
      breadcrumb: [graph.title],
      cards: [],
      links: [],
    }
  }

  const activeRef: WorldRef = { kind: activeNode.kind, id: activeNode.id }
  const refs = collectProjectionRefs(graph, index, activeNode, mode)
  const cards = buildCards(graph, index, refs, activeRef, mode)
  const links = buildLinks(graph, index, activeRef, refs)
  const breadcrumb = buildBreadcrumb(graph, activeNode, index)

  return {
    kind: 'projection',
    mode,
    title: activeNode.title,
    summary: focusSummary(activeNode),
    focus: activeRef,
    breadcrumb,
    cards,
    links,
  }
}

export const projectWing = (graph: WorldGraph, wingId: string, mode: ProjectionMode = 'wing'): Projection =>
  buildProjection(graph, worldRef('wing', wingId), mode)

export const projectRoom = (graph: WorldGraph, roomId: string, mode: ProjectionMode = 'room'): Projection =>
  buildProjection(graph, worldRef('room', roomId), mode)

export const projectActor = (graph: WorldGraph, actorId: string, mode: ProjectionMode = 'room'): Projection => {
  const actor = graph.actors.find((entry) => entry.id === actorId)
  return actor ? buildProjection(graph, worldRef(actor.kind, actor.id), mode) : buildProjection(graph, null, mode)
}

export const projectEarth = (graph: WorldGraph, mode: ProjectionMode = 'earth'): Projection =>
  buildProjection(graph, null, mode)
