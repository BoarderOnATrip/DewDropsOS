import type { BoardCamera, BoardWire, MemoryPalaceLocus, WorkflowCard } from './types'
import { hedgerowsPresetAgentCount } from './presets/hedgerowsDeltaSquad'

export const BOARD_STORAGE_KEY = 'dewdrops-board-state'
export const WORKSPACE_STORE_KEY = 'dewdrops-workspace-store-v1'
export const ACTIVE_WORKSPACE_KEY = 'dewdrops-active-workspace-id'

const WORKSPACE_STORE_EVENT = 'dewdrops:workspace-store'
const WORKSPACE_STORE_CHANNEL = 'dewdrops-workspace-sync'
const PERSIST_VERSION = 1 as const

export type PersistedBoardV1 = {
  v: typeof PERSIST_VERSION
  camera: BoardCamera
  cards: WorkflowCard[]
  wires: BoardWire[]
}

export type PersistedWorkspaceSurface = 'world' | 'desktop' | 'phone'
export type PersistedWorkspaceProjection = 'earth' | 'wing' | 'room' | 'fold' | 'outline' | 'packet'

export type PersistedWorkspaceRecord = {
  id: string
  name: string
  updatedAt: string
  focusedProblemId?: string
  lastSurface?: PersistedWorkspaceSurface
  lastProjection?: PersistedWorkspaceProjection
  board: PersistedBoardV1
}

export type PersistedWorkspaceSummary = Omit<PersistedWorkspaceRecord, 'board'>

type PersistedWorkspaceStore = {
  v: typeof PERSIST_VERSION
  workspaces: PersistedWorkspaceRecord[]
}

type WorkspaceStoreEventDetail = {
  activeWorkspaceId: string | null
  workspaceId?: string
  reason:
    | 'create'
    | 'save'
    | 'rename'
    | 'duplicate'
    | 'delete'
    | 'focus'
    | 'surface'
    | 'projection'
    | 'active'
    | 'clear'
    | 'migrate'
}

let workspaceSyncChannel: BroadcastChannel | null = null
let workspaceSyncSubscriberCount = 0

function canUseBroadcastChannel(): boolean {
  if (typeof BroadcastChannel === 'undefined') return false
  if (typeof navigator !== 'undefined' && /\bjsdom\b/i.test(navigator.userAgent)) return false
  return true
}

function cloneBoard(board: PersistedBoardV1): PersistedBoardV1 {
  return JSON.parse(JSON.stringify(board)) as PersistedBoardV1
}

function nowIso(): string {
  return new Date().toISOString()
}

function newWorkspaceId(): string {
  return `workspace-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36)}`
}

function defaultWorkspaceName(index: number): string {
  return index === 0 ? 'Primary workspace' : `Workspace ${index + 1}`
}

function normalizeWorkspaceName(name: string | undefined, fallbackIndex: number): string {
  const trimmed = name?.trim() ?? ''
  return trimmed || defaultWorkspaceName(fallbackIndex)
}

function safeLocalStorageGet(key: string): string | null {
  try {
    return globalThis.localStorage.getItem(key)
  } catch {
    return null
  }
}

function safeLocalStorageSet(key: string, value: string): void {
  try {
    globalThis.localStorage.setItem(key, value)
  } catch {
    // Ignore quota and private-mode failures.
  }
}

function safeLocalStorageRemove(key: string): void {
  try {
    globalThis.localStorage.removeItem(key)
  } catch {
    // Ignore storage failures.
  }
}

function isNum(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n)
}

function isStr(s: unknown): s is string {
  return typeof s === 'string'
}

function isBool(b: unknown): b is boolean {
  return typeof b === 'boolean'
}

function isKind(k: unknown): k is WorkflowCard['kind'] {
  return k === 'problem' || k === 'agent' || k === 'surface'
}

export function buildBoardPayload(
  camera: BoardCamera,
  cards: WorkflowCard[],
  wires: BoardWire[],
): PersistedBoardV1 {
  return { v: PERSIST_VERSION, camera, cards, wires }
}

/** Pretty JSON for downloads / sharing (same schema as localStorage). */
export function stringifyBoard(camera: BoardCamera, cards: WorkflowCard[], wires: BoardWire[]): string {
  return JSON.stringify(buildBoardPayload(camera, cards, wires), null, 2)
}

/** Parse a `.json` file or pasted string; same validation as saved browser state. */
export function parseBoardJsonString(text: string): PersistedBoardV1 | null {
  try {
    return parsePersistedBoardJson(JSON.parse(text) as unknown)
  } catch {
    return null
  }
}

/** Exported for tests — validate JSON without touching localStorage. */
export function parsePersistedBoardJson(raw: unknown): PersistedBoardV1 | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (o.v !== PERSIST_VERSION) return null

  const cam = o.camera
  if (!cam || typeof cam !== 'object') return null
  const c = cam as Record<string, unknown>
  if (!isNum(c.x) || !isNum(c.y) || !isNum(c.zoom) || c.zoom <= 0) return null
  const camera: BoardCamera = { x: c.x, y: c.y, zoom: c.zoom }

  if (!Array.isArray(o.cards)) return null
  const cards: WorkflowCard[] = []
  for (const item of o.cards) {
    if (!item || typeof item !== 'object') return null
    const w = item as Record<string, unknown>
    if (
      !isStr(w.id) ||
      !isNum(w.x) ||
      !isNum(w.y) ||
      !isNum(w.width) ||
      !isNum(w.height) ||
      w.width <= 0 ||
      w.height <= 0 ||
      !isStr(w.title) ||
      !isBool(w.expanded) ||
      !isStr(w.color) ||
      !isKind(w.kind)
    ) {
      return null
    }
    const card: WorkflowCard = {
      id: w.id,
      x: w.x,
      y: w.y,
      width: w.width,
      height: w.height,
      title: w.title,
      expanded: w.expanded,
      color: w.color,
      kind: w.kind,
    }
    if (w.problemShape === 'bubble' || w.problemShape === 'panel') card.problemShape = w.problemShape
    if (isNum(w.problemBaseWidth)) card.problemBaseWidth = w.problemBaseWidth
    if (isNum(w.problemBaseHeight)) card.problemBaseHeight = w.problemBaseHeight
    if (isNum(w.swarmEnvelopePad)) card.swarmEnvelopePad = w.swarmEnvelopePad
    if (isNum(w.swarmAgentMinWidth)) card.swarmAgentMinWidth = w.swarmAgentMinWidth
    if (w.assignedToProblemId === null || isStr(w.assignedToProblemId)) {
      card.assignedToProblemId = w.assignedToProblemId as string | null
    }
    if (w.parentAgentId === null || isStr(w.parentAgentId)) {
      card.parentAgentId = w.parentAgentId as string | null
    }
    if (w.management === 'manual' || w.management === 'auto') card.management = w.management
    if (isStr(w.mission)) card.mission = w.mission
    if (
      w.swarmTemplate === 'planning' ||
      w.swarmTemplate === 'relationship' ||
      w.swarmTemplate === 'operator' ||
      w.swarmTemplate === 'research' ||
      w.swarmTemplate === 'build'
    ) {
      card.swarmTemplate = w.swarmTemplate
    }
    if (
      w.preferredLaunchSurface === 'desktop' ||
      w.preferredLaunchSurface === 'phone' ||
      w.preferredLaunchSurface === 'hybrid'
    ) {
      card.preferredLaunchSurface = w.preferredLaunchSurface
    }
    if (isStr(w.butlerRoomId)) card.butlerRoomId = w.butlerRoomId
    if (isStr(w.lastSwarmContractId)) card.lastSwarmContractId = w.lastSwarmContractId
    if (isStr(w.lastSwarmRunId)) card.lastSwarmRunId = w.lastSwarmRunId
    if (isStr(w.paperclipCompanyId)) card.paperclipCompanyId = w.paperclipCompanyId
    if (isStr(w.paperclipProjectId)) card.paperclipProjectId = w.paperclipProjectId
    if (Array.isArray(w.paperclipAgentIds) && w.paperclipAgentIds.every(isStr)) {
      card.paperclipAgentIds = w.paperclipAgentIds as string[]
    }
    if (isStr(w.paperclipLeadAgentId)) card.paperclipLeadAgentId = w.paperclipLeadAgentId
    if (isStr(w.lastPaperclipIssueId)) card.lastPaperclipIssueId = w.lastPaperclipIssueId
    if (isStr(w.lastPaperclipRunId)) card.lastPaperclipRunId = w.lastPaperclipRunId
    if (isStr(w.memoryWing)) card.memoryWing = w.memoryWing
    if (isStr(w.memoryRoom)) card.memoryRoom = w.memoryRoom
    if (isStr(w.memoryContextSummary)) card.memoryContextSummary = w.memoryContextSummary
    if (Array.isArray(w.memoryAnchors) && w.memoryAnchors.every(isStr)) {
      card.memoryAnchors = w.memoryAnchors as string[]
    }
    if (Array.isArray(w.memoryPalaceLoci)) {
      const loci = w.memoryPalaceLoci
        .map((entry): MemoryPalaceLocus | null => {
          if (!entry || typeof entry !== 'object') return null
          const locus = entry as Record<string, unknown>
          if (
            !isStr(locus.id) ||
            !isStr(locus.title) ||
            !isStr(locus.detail) ||
            !(
              locus.kind === 'north_star' ||
              locus.kind === 'room' ||
              locus.kind === 'portal' ||
              locus.kind === 'artifact' ||
              locus.kind === 'checkpoint'
            )
          ) {
            return null
          }
          return {
            id: locus.id,
            title: locus.title,
            detail: locus.detail,
            kind: locus.kind,
          } satisfies MemoryPalaceLocus
        })
        .filter((entry): entry is MemoryPalaceLocus => entry !== null)
      if (loci.length > 0) {
        card.memoryPalaceLoci = loci
      }
    }
    if (isStr(w.phoneRelayBrief)) card.phoneRelayBrief = w.phoneRelayBrief
    if (isStr(w.desktopSessionBrief)) card.desktopSessionBrief = w.desktopSessionBrief
    if (Array.isArray(w.openQuestions) && w.openQuestions.every(isStr)) {
      card.openQuestions = w.openQuestions as string[]
    }
    if (isBool(w.releaseNodFromSpecialist)) card.releaseNodFromSpecialist = w.releaseNodFromSpecialist
    if (isBool(w.releaseNodFromLead)) card.releaseNodFromLead = w.releaseNodFromLead
    if (isStr(w.lastProjectRecall)) card.lastProjectRecall = w.lastProjectRecall
    cards.push(card)
  }

  const wires: BoardWire[] = []
  if (Array.isArray(o.wires)) {
    for (const item of o.wires) {
      if (!item || typeof item !== 'object') return null
      const wire = item as Record<string, unknown>
      if (!isStr(wire.id) || !isStr(wire.fromCardId) || !isStr(wire.toCardId)) return null
      wires.push({ id: wire.id, fromCardId: wire.fromCardId, toCardId: wire.toCardId })
    }
  }

  return { v: PERSIST_VERSION, camera, cards, wires }
}

function parseWorkspaceStore(raw: unknown): PersistedWorkspaceStore | null {
  if (!raw || typeof raw !== 'object') return null
  const record = raw as Record<string, unknown>
  if (record.v !== PERSIST_VERSION || !Array.isArray(record.workspaces)) return null
  const workspaces: PersistedWorkspaceRecord[] = []

  for (const item of record.workspaces) {
    if (!item || typeof item !== 'object') return null
    const workspace = item as Record<string, unknown>
    if (!isStr(workspace.id) || !isStr(workspace.name) || !isStr(workspace.updatedAt)) {
      return null
    }
    const board = parsePersistedBoardJson(workspace.board)
    if (!board) return null
    const next: PersistedWorkspaceRecord = {
      id: workspace.id,
      name: workspace.name,
      updatedAt: workspace.updatedAt,
      board,
    }
    if (isStr(workspace.focusedProblemId)) next.focusedProblemId = workspace.focusedProblemId
    if (
      workspace.lastSurface === 'world' ||
      workspace.lastSurface === 'desktop' ||
      workspace.lastSurface === 'phone'
    ) {
      next.lastSurface = workspace.lastSurface
    }
    if (
      workspace.lastProjection === 'earth' ||
      workspace.lastProjection === 'wing' ||
      workspace.lastProjection === 'room' ||
      workspace.lastProjection === 'fold' ||
      workspace.lastProjection === 'outline' ||
      workspace.lastProjection === 'packet'
    ) {
      next.lastProjection = workspace.lastProjection
    }
    workspaces.push(next)
  }

  return { v: PERSIST_VERSION, workspaces }
}

function buildWorkspaceStore(workspaces: PersistedWorkspaceRecord[]): PersistedWorkspaceStore {
  return { v: PERSIST_VERSION, workspaces }
}

function writeWorkspaceStore(store: PersistedWorkspaceStore): void {
  safeLocalStorageSet(WORKSPACE_STORE_KEY, JSON.stringify(store))
}

function readWorkspaceStore(): PersistedWorkspaceStore {
  const raw = safeLocalStorageGet(WORKSPACE_STORE_KEY)
  if (!raw) return buildWorkspaceStore([])
  try {
    return parseWorkspaceStore(JSON.parse(raw) as unknown) ?? buildWorkspaceStore([])
  } catch {
    return buildWorkspaceStore([])
  }
}

function activeWorkspaceIdFromStorage(): string | null {
  const raw = safeLocalStorageGet(ACTIVE_WORKSPACE_KEY)
  return raw?.trim() || null
}

function writeActiveWorkspaceId(workspaceId: string | null): void {
  if (workspaceId) {
    safeLocalStorageSet(ACTIVE_WORKSPACE_KEY, workspaceId)
  } else {
    safeLocalStorageRemove(ACTIVE_WORKSPACE_KEY)
  }
}

function getWorkspaceSyncChannel(): BroadcastChannel | null {
  if (!canUseBroadcastChannel()) return null
  if (!workspaceSyncChannel) {
    workspaceSyncChannel = new BroadcastChannel(WORKSPACE_STORE_CHANNEL)
  }
  return workspaceSyncChannel
}

function emitWorkspaceStoreEvent(detail: WorkspaceStoreEventDetail): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(WORKSPACE_STORE_EVENT, { detail }))
  }
  if (workspaceSyncChannel) {
    workspaceSyncChannel.postMessage(detail)
    return
  }
  if (canUseBroadcastChannel()) {
    const channel = new BroadcastChannel(WORKSPACE_STORE_CHANNEL)
    channel.postMessage(detail)
    channel.close()
  }
}

function ensureWorkspaceStore(): PersistedWorkspaceStore {
  const current = readWorkspaceStore()
  if (current.workspaces.length > 0) {
    const active = activeWorkspaceIdFromStorage()
    if (!active || !current.workspaces.some((workspace) => workspace.id === active)) {
      writeActiveWorkspaceId(current.workspaces[0]!.id)
    }
    return current
  }

  const legacy = safeLocalStorageGet(BOARD_STORAGE_KEY)
  if (!legacy) {
    writeActiveWorkspaceId(null)
    return current
  }

  try {
    const parsed = parsePersistedBoardJson(JSON.parse(legacy) as unknown)
    if (!parsed) return current
    const migrated: PersistedWorkspaceRecord = {
      id: newWorkspaceId(),
      name: 'Primary workspace',
      updatedAt: nowIso(),
      board: parsed,
      lastSurface: 'desktop',
      lastProjection: 'room',
    }
    const next = buildWorkspaceStore([migrated])
    writeWorkspaceStore(next)
    writeActiveWorkspaceId(migrated.id)
    safeLocalStorageRemove(BOARD_STORAGE_KEY)
    emitWorkspaceStoreEvent({
      activeWorkspaceId: migrated.id,
      workspaceId: migrated.id,
      reason: 'migrate',
    })
    return next
  } catch {
    return current
  }
}

function withWorkspaceStore(
  mutate: (store: PersistedWorkspaceStore) => {
    store: PersistedWorkspaceStore
    activeWorkspaceId: string | null
    event?: WorkspaceStoreEventDetail
    result?: PersistedWorkspaceRecord | PersistedWorkspaceSummary | null
  },
): PersistedWorkspaceRecord | PersistedWorkspaceSummary | null {
  const current = ensureWorkspaceStore()
  const outcome = mutate(current)
  writeWorkspaceStore(outcome.store)
  writeActiveWorkspaceId(outcome.activeWorkspaceId)
  if (outcome.event) emitWorkspaceStoreEvent(outcome.event)
  return outcome.result ?? null
}

export function listPersistedWorkspaces(): PersistedWorkspaceSummary[] {
  return ensureWorkspaceStore().workspaces
    .map((workspace) => ({
      id: workspace.id,
      name: workspace.name,
      updatedAt: workspace.updatedAt,
      focusedProblemId: workspace.focusedProblemId,
      lastSurface: workspace.lastSurface,
      lastProjection: workspace.lastProjection,
    }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function getActiveWorkspaceId(): string | null {
  const store = ensureWorkspaceStore()
  const active = activeWorkspaceIdFromStorage()
  if (active && store.workspaces.some((workspace) => workspace.id === active)) return active
  return store.workspaces[0]?.id ?? null
}

export function setActiveWorkspaceId(workspaceId: string): void {
  const store = ensureWorkspaceStore()
  if (!store.workspaces.some((workspace) => workspace.id === workspaceId)) return
  if (activeWorkspaceIdFromStorage() === workspaceId) return
  writeActiveWorkspaceId(workspaceId)
  emitWorkspaceStoreEvent({
    activeWorkspaceId: workspaceId,
    workspaceId,
    reason: 'active',
  })
}

export function loadPersistedWorkspace(workspaceId?: string): PersistedWorkspaceRecord | null {
  const store = ensureWorkspaceStore()
  const id = workspaceId ?? getActiveWorkspaceId()
  if (!id) return null
  const found = store.workspaces.find((workspace) => workspace.id === id)
  if (!found) return null
  return {
    ...found,
    board: cloneBoard(found.board),
  }
}

export function createPersistedWorkspace(
  name: string,
  board?: PersistedBoardV1,
): PersistedWorkspaceRecord {
  const payload =
    board ??
    buildBoardPayload(
      { x: 0, y: 0, zoom: 1 },
      [],
      [],
    )
  const store = ensureWorkspaceStore()
  const workspace: PersistedWorkspaceRecord = {
    id: newWorkspaceId(),
    name: normalizeWorkspaceName(name, store.workspaces.length),
    updatedAt: nowIso(),
    board: cloneBoard(payload),
    lastSurface: 'desktop',
    lastProjection: 'room',
  }
  writeWorkspaceStore(buildWorkspaceStore([workspace, ...store.workspaces]))
  writeActiveWorkspaceId(workspace.id)
  emitWorkspaceStoreEvent({
    activeWorkspaceId: workspace.id,
    workspaceId: workspace.id,
    reason: 'create',
  })
  return workspace
}

export function duplicatePersistedWorkspace(
  workspaceId: string,
  name?: string,
): PersistedWorkspaceRecord | null {
  const source = loadPersistedWorkspace(workspaceId)
  if (!source) return null
  const clone: PersistedWorkspaceRecord = {
    id: newWorkspaceId(),
    name: normalizeWorkspaceName(name ?? `${source.name} copy`, listPersistedWorkspaces().length),
    updatedAt: nowIso(),
    focusedProblemId: source.focusedProblemId,
    lastSurface: source.lastSurface,
    lastProjection: source.lastProjection,
    board: cloneBoard(source.board),
  }
  const store = ensureWorkspaceStore()
  writeWorkspaceStore(buildWorkspaceStore([clone, ...store.workspaces]))
  writeActiveWorkspaceId(clone.id)
  emitWorkspaceStoreEvent({
    activeWorkspaceId: clone.id,
    workspaceId: clone.id,
    reason: 'duplicate',
  })
  return clone
}

export function renamePersistedWorkspace(
  workspaceId: string,
  name: string,
): PersistedWorkspaceSummary | null {
  return withWorkspaceStore((store) => {
    const index = store.workspaces.findIndex((workspace) => workspace.id === workspaceId)
    if (index < 0) {
      return {
        store,
        activeWorkspaceId: getActiveWorkspaceId(),
        result: null,
      }
    }
    const current = store.workspaces[index]!
    const renamed: PersistedWorkspaceRecord = {
      ...current,
      name: normalizeWorkspaceName(name, index),
      updatedAt: nowIso(),
    }
    const workspaces = [...store.workspaces]
    workspaces[index] = renamed
    return {
      store: buildWorkspaceStore(workspaces),
      activeWorkspaceId: getActiveWorkspaceId(),
      event: {
        activeWorkspaceId: getActiveWorkspaceId(),
        workspaceId,
        reason: 'rename',
      },
      result: {
        id: renamed.id,
        name: renamed.name,
        updatedAt: renamed.updatedAt,
        focusedProblemId: renamed.focusedProblemId,
        lastSurface: renamed.lastSurface,
        lastProjection: renamed.lastProjection,
      },
    }
  }) as PersistedWorkspaceSummary | null
}

export function updatePersistedWorkspaceFocus(
  workspaceId: string,
  focusedProblemId?: string,
): PersistedWorkspaceSummary | null {
  return withWorkspaceStore((store) => {
    const index = store.workspaces.findIndex((workspace) => workspace.id === workspaceId)
    if (index < 0) {
      return {
        store,
        activeWorkspaceId: getActiveWorkspaceId(),
        result: null,
      }
    }
    const current = store.workspaces[index]!
    const next: PersistedWorkspaceRecord = {
      ...current,
      updatedAt: current.updatedAt,
      focusedProblemId: focusedProblemId?.trim() || undefined,
    }
    const workspaces = [...store.workspaces]
    workspaces[index] = next
    return {
      store: buildWorkspaceStore(workspaces),
      activeWorkspaceId: getActiveWorkspaceId(),
      event: {
        activeWorkspaceId: getActiveWorkspaceId(),
        workspaceId,
        reason: 'focus',
      },
      result: {
        id: next.id,
        name: next.name,
        updatedAt: next.updatedAt,
        focusedProblemId: next.focusedProblemId,
        lastSurface: next.lastSurface,
        lastProjection: next.lastProjection,
      },
    }
  }) as PersistedWorkspaceSummary | null
}

export function updatePersistedWorkspaceSurface(
  workspaceId: string,
  surface: PersistedWorkspaceSurface,
): PersistedWorkspaceSummary | null {
  return withWorkspaceStore((store) => {
    const index = store.workspaces.findIndex((workspace) => workspace.id === workspaceId)
    if (index < 0) {
      return {
        store,
        activeWorkspaceId: getActiveWorkspaceId(),
        result: null,
      }
    }
    const current = store.workspaces[index]!
    const next: PersistedWorkspaceRecord = {
      ...current,
      updatedAt: current.updatedAt,
      lastSurface: surface,
    }
    const workspaces = [...store.workspaces]
    workspaces[index] = next
    return {
      store: buildWorkspaceStore(workspaces),
      activeWorkspaceId: getActiveWorkspaceId(),
      event: {
        activeWorkspaceId: getActiveWorkspaceId(),
        workspaceId,
        reason: 'surface',
      },
      result: {
        id: next.id,
        name: next.name,
        updatedAt: next.updatedAt,
        focusedProblemId: next.focusedProblemId,
        lastSurface: next.lastSurface,
        lastProjection: next.lastProjection,
      },
    }
  }) as PersistedWorkspaceSummary | null
}

export function updatePersistedWorkspaceProjection(
  workspaceId: string,
  projection: PersistedWorkspaceProjection,
): PersistedWorkspaceSummary | null {
  return withWorkspaceStore((store) => {
    const index = store.workspaces.findIndex((workspace) => workspace.id === workspaceId)
    if (index < 0) {
      return {
        store,
        activeWorkspaceId: getActiveWorkspaceId(),
        result: null,
      }
    }
    const current = store.workspaces[index]!
    const next: PersistedWorkspaceRecord = {
      ...current,
      updatedAt: current.updatedAt,
      lastProjection: projection,
    }
    const workspaces = [...store.workspaces]
    workspaces[index] = next
    return {
      store: buildWorkspaceStore(workspaces),
      activeWorkspaceId: getActiveWorkspaceId(),
      event: {
        activeWorkspaceId: getActiveWorkspaceId(),
        workspaceId,
        reason: 'projection',
      },
      result: {
        id: next.id,
        name: next.name,
        updatedAt: next.updatedAt,
        focusedProblemId: next.focusedProblemId,
        lastSurface: next.lastSurface,
        lastProjection: next.lastProjection,
      },
    }
  }) as PersistedWorkspaceSummary | null
}

export function deletePersistedWorkspace(workspaceId: string): { deleted: boolean; activeWorkspaceId: string | null } {
  const store = ensureWorkspaceStore()
  const nextWorkspaces = store.workspaces.filter((workspace) => workspace.id !== workspaceId)
  if (nextWorkspaces.length === store.workspaces.length) {
    return {
      deleted: false,
      activeWorkspaceId: getActiveWorkspaceId(),
    }
  }
  const nextActiveWorkspaceId =
    getActiveWorkspaceId() === workspaceId ? nextWorkspaces[0]?.id ?? null : getActiveWorkspaceId()
  writeWorkspaceStore(buildWorkspaceStore(nextWorkspaces))
  writeActiveWorkspaceId(nextActiveWorkspaceId)
  emitWorkspaceStoreEvent({
    activeWorkspaceId: nextActiveWorkspaceId,
    workspaceId,
    reason: 'delete',
  })
  return { deleted: true, activeWorkspaceId: nextActiveWorkspaceId }
}

export function loadPersistedBoard(workspaceId?: string): PersistedBoardV1 | null {
  return loadPersistedWorkspace(workspaceId)?.board ?? null
}

export function savePersistedBoard(
  camera: BoardCamera,
  cards: WorkflowCard[],
  wires: BoardWire[],
  options?: {
    workspaceId?: string
    name?: string
    focusedProblemId?: string
    lastSurface?: PersistedWorkspaceSurface
    lastProjection?: PersistedWorkspaceProjection
  },
): PersistedWorkspaceRecord {
  const store = ensureWorkspaceStore()
  const activeWorkspaceId = options?.workspaceId ?? getActiveWorkspaceId()
  const board = buildBoardPayload(camera, cards, wires)
  const index = activeWorkspaceId
    ? store.workspaces.findIndex((workspace) => workspace.id === activeWorkspaceId)
    : -1

  const nextWorkspace: PersistedWorkspaceRecord =
    index >= 0
      ? {
          ...store.workspaces[index]!,
          name: normalizeWorkspaceName(options?.name ?? store.workspaces[index]!.name, index),
          updatedAt: nowIso(),
          focusedProblemId: options?.focusedProblemId ?? store.workspaces[index]!.focusedProblemId,
          lastSurface: options?.lastSurface ?? store.workspaces[index]!.lastSurface,
          lastProjection: options?.lastProjection ?? store.workspaces[index]!.lastProjection,
          board,
        }
      : {
          id: activeWorkspaceId ?? newWorkspaceId(),
          name: normalizeWorkspaceName(options?.name, store.workspaces.length),
          updatedAt: nowIso(),
          focusedProblemId: options?.focusedProblemId,
          lastSurface: options?.lastSurface,
          lastProjection: options?.lastProjection,
          board,
        }

  const nextWorkspaces =
    index >= 0
      ? store.workspaces.map((workspace, workspaceIndex) =>
          workspaceIndex === index ? nextWorkspace : workspace,
        )
      : [nextWorkspace, ...store.workspaces]

  writeWorkspaceStore(buildWorkspaceStore(nextWorkspaces))
  writeActiveWorkspaceId(nextWorkspace.id)
  emitWorkspaceStoreEvent({
    activeWorkspaceId: nextWorkspace.id,
    workspaceId: nextWorkspace.id,
    reason: 'save',
  })
  return nextWorkspace
}

export function clearPersistedBoard(workspaceId?: string): void {
  const targetId = workspaceId ?? getActiveWorkspaceId()
  if (!targetId) {
    safeLocalStorageRemove(BOARD_STORAGE_KEY)
    return
  }
  const store = ensureWorkspaceStore()
  const filtered = store.workspaces.filter((workspace) => workspace.id !== targetId)
  writeWorkspaceStore(buildWorkspaceStore(filtered))
  const nextActive = filtered[0]?.id ?? null
  writeActiveWorkspaceId(nextActive)
  emitWorkspaceStoreEvent({
    activeWorkspaceId: nextActive,
    workspaceId: targetId,
    reason: 'clear',
  })
}

export function subscribeToWorkspaceStore(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => {}

  const onWindowEvent = () => listener()
  const onStorage = (event: StorageEvent) => {
    if (event.key === WORKSPACE_STORE_KEY || event.key === ACTIVE_WORKSPACE_KEY) {
      listener()
    }
  }
  const channel = getWorkspaceSyncChannel()
  const onMessage = () => listener()

  window.addEventListener(WORKSPACE_STORE_EVENT, onWindowEvent as EventListener)
  window.addEventListener('storage', onStorage)
  if (channel) {
    workspaceSyncSubscriberCount += 1
    channel.addEventListener('message', onMessage)
  }

  return () => {
    window.removeEventListener(WORKSPACE_STORE_EVENT, onWindowEvent as EventListener)
    window.removeEventListener('storage', onStorage)
    if (channel) {
      channel.removeEventListener('message', onMessage)
      workspaceSyncSubscriberCount = Math.max(0, workspaceSyncSubscriberCount - 1)
      if (workspaceSyncSubscriberCount === 0 && workspaceSyncChannel) {
        workspaceSyncChannel.close()
        workspaceSyncChannel = null
      }
    }
  }
}

/** Next “Agent N” index after restore (avoids duplicate titles when summoning). */
export function inferAgentSummonCount(cards: WorkflowCard[]): number {
  let max = hedgerowsPresetAgentCount()
  for (const c of cards) {
    if (c.kind !== 'agent') continue
    const m = /^Agent (\d+)$/.exec(c.title.trim())
    if (m) max = Math.max(max, parseInt(m[1], 10))
  }
  return max
}
