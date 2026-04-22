export const DEFAULT_WORKSPACE_ID = 'default'
export const WORKSPACE_RECORD_PREFIX = 'dewdrops-workspace:'
export const ACTIVE_WORKSPACE_STORAGE_KEY = 'dewdrops-active-workspace-id'
export const WORKSPACE_SYNC_CHANNEL = 'dewdrops-workspace-sync'

const MAX_SEEN_REVISIONS = 128

export type WorkspaceSyncSource = 'local' | 'broadcast' | 'storage' | 'migration'

export type WorkspaceRecordEnvelope = {
  v: 1
  id: string
  name: string
  createdAt: number
  updatedAt: number
  revision: string
  focusedProblemId?: string | null
  payload?: string
  deletedAt?: number
}

export type ActiveWorkspaceEnvelope = {
  v: 1
  workspaceId: string | null
  updatedAt: number
  revision: string
}

export type WorkspaceSummary = {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  focusedProblemId: string | null
  isActive: boolean
}

export type WorkspaceSyncKind = 'workspace-upserted' | 'workspace-deleted' | 'active-workspace-changed'

export type WorkspaceSyncEvent = {
  kind: WorkspaceSyncKind
  source: WorkspaceSyncSource
  workspaceId: string | null
  activeWorkspaceId: string | null
  revision: string
  workspaces: WorkspaceSummary[]
}

export type WorkspaceSyncListener = (event: WorkspaceSyncEvent) => void

export type UpsertWorkspaceOptions = {
  name?: string
  focusedProblemId?: string | null
  activate?: boolean
  source?: WorkspaceSyncSource
  revision?: string
  createdAt?: number
}

export type SetActiveWorkspaceOptions = {
  source?: WorkspaceSyncSource
  revision?: string
}

export type DeleteWorkspaceOptions = {
  source?: WorkspaceSyncSource
  revision?: string
}

const listeners = new Set<WorkspaceSyncListener>()
const seenRevisions = new Set<string>()
let broadcastChannel: BroadcastChannel | null = null
let hooksInstalled = false

function storage(): Storage | null {
  try {
    return globalThis.localStorage
  } catch {
    return null
  }
}

function now(): number {
  return Date.now()
}

function revisionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

function rememberRevision(revision: string): void {
  if (seenRevisions.has(revision)) return
  seenRevisions.add(revision)
  if (seenRevisions.size > MAX_SEEN_REVISIONS) {
    seenRevisions.clear()
  }
}

function getActiveEnvelope(): ActiveWorkspaceEnvelope | null {
  const s = storage()
  if (!s) return null
  const raw = s.getItem(ACTIVE_WORKSPACE_STORAGE_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return null
    const o = parsed as Partial<ActiveWorkspaceEnvelope> & Record<string, unknown>
    if (o.v !== 1 || typeof o.revision !== 'string' || !('workspaceId' in o)) return null
    if (o.workspaceId !== null && typeof o.workspaceId !== 'string') return null
    if (typeof o.updatedAt !== 'number') return null
    return {
      v: 1,
      workspaceId: o.workspaceId,
      updatedAt: o.updatedAt,
      revision: o.revision,
    }
  } catch {
    if (typeof raw === 'string' && raw.length > 0) {
      return { v: 1, workspaceId: raw, updatedAt: now(), revision: `legacy-${raw}` }
    }
    return null
  }
}

export function getActiveWorkspaceId(): string | null {
  return getActiveEnvelope()?.workspaceId ?? null
}

function workspaceKey(workspaceId: string): string {
  return `${WORKSPACE_RECORD_PREFIX}${workspaceId}`
}

function defaultWorkspaceName(workspaceId: string, existingCount: number): string {
  if (workspaceId === DEFAULT_WORKSPACE_ID) return 'Default workspace'
  const cleaned = workspaceId.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim()
  if (cleaned) {
    return cleaned.replace(/\b\w/g, (c) => c.toUpperCase())
  }
  return `Workspace ${existingCount + 1}`
}

function parseWorkspaceRecord(raw: string | null): WorkspaceRecordEnvelope | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return null
    const o = parsed as Partial<WorkspaceRecordEnvelope> & Record<string, unknown>
    if (
      o.v !== 1 ||
      typeof o.id !== 'string' ||
      typeof o.name !== 'string' ||
      typeof o.createdAt !== 'number' ||
      typeof o.updatedAt !== 'number' ||
      typeof o.revision !== 'string'
    ) {
      return null
    }
    if (o.deletedAt !== undefined && typeof o.deletedAt !== 'number') return null
    if (o.focusedProblemId !== undefined && o.focusedProblemId !== null && typeof o.focusedProblemId !== 'string') {
      return null
    }
    if (o.payload !== undefined && typeof o.payload !== 'string') return null
    return {
      v: 1,
      id: o.id,
      name: o.name,
      createdAt: o.createdAt,
      updatedAt: o.updatedAt,
      revision: o.revision,
      focusedProblemId: o.focusedProblemId,
      payload: o.payload,
      deletedAt: o.deletedAt,
    }
  } catch {
    return null
  }
}

function readRecord(workspaceId: string): WorkspaceRecordEnvelope | null {
  const s = storage()
  if (!s) return null
  return parseWorkspaceRecord(s.getItem(workspaceKey(workspaceId)))
}

function writeRecord(record: WorkspaceRecordEnvelope): WorkspaceRecordEnvelope {
  const s = storage()
  if (!s) return record
  s.setItem(workspaceKey(record.id), JSON.stringify(record))
  return record
}

function emit(event: WorkspaceSyncEvent, shouldBroadcast: boolean): void {
  rememberRevision(event.revision)
  for (const listener of listeners) {
    listener(event)
  }
  if (shouldBroadcast && broadcastChannel) {
    broadcastChannel.postMessage(event)
  }
}

function currentSummaries(): WorkspaceSummary[] {
  const s = storage()
  if (!s) return []
  const activeId = getActiveWorkspaceId()
  const summaries: WorkspaceSummary[] = []
  for (let i = 0; i < s.length; i += 1) {
    const key = s.key(i)
    if (!key || !key.startsWith(WORKSPACE_RECORD_PREFIX)) continue
    const record = parseWorkspaceRecord(s.getItem(key))
    if (!record || record.deletedAt !== undefined) continue
    summaries.push({
      id: record.id,
      name: record.name,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      focusedProblemId: record.focusedProblemId ?? null,
      isActive: record.id === activeId,
    })
  }
  summaries.sort((a, b) => {
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1
    if (a.updatedAt !== b.updatedAt) return b.updatedAt - a.updatedAt
    return a.name.localeCompare(b.name)
  })
  return summaries
}

function broadcastOrLocal(event: WorkspaceSyncEvent, shouldBroadcast: boolean): void {
  emit(event, shouldBroadcast)
}

function handleBroadcastMessage(data: unknown): void {
  if (!data || typeof data !== 'object') return
  const event = data as Partial<WorkspaceSyncEvent> & Record<string, unknown>
  if (
    (event.kind !== 'workspace-upserted' &&
      event.kind !== 'workspace-deleted' &&
      event.kind !== 'active-workspace-changed') ||
    typeof event.revision !== 'string'
  ) {
    return
  }
  if (seenRevisions.has(event.revision)) return
  rememberRevision(event.revision)
  const workspaceId = typeof event.workspaceId === 'string' ? event.workspaceId : null
  const activeWorkspaceId =
    event.activeWorkspaceId === null || typeof event.activeWorkspaceId === 'string'
      ? event.activeWorkspaceId
      : null
  const source = event.source === 'broadcast' || event.source === 'storage' || event.source === 'migration'
    ? event.source
    : 'broadcast'
  const normalized: WorkspaceSyncEvent = {
    kind: event.kind,
    source,
    workspaceId,
    activeWorkspaceId,
    revision: event.revision,
    workspaces: currentSummaries(),
  }
  for (const listener of listeners) {
    listener(normalized)
  }
}

function handleStorageEvent(event: StorageEvent): void {
  if (event.storageArea !== storage()) return
  if (event.key === ACTIVE_WORKSPACE_STORAGE_KEY) {
    const envelope = getActiveEnvelope()
    const revision = envelope?.revision ?? `storage-active-${now()}`
    if (seenRevisions.has(revision)) return
    rememberRevision(revision)
    const normalized: WorkspaceSyncEvent = {
      kind: 'active-workspace-changed',
      source: 'storage',
      workspaceId: envelope?.workspaceId ?? null,
      activeWorkspaceId: envelope?.workspaceId ?? null,
      revision,
      workspaces: currentSummaries(),
    }
    for (const listener of listeners) {
      listener(normalized)
    }
    return
  }

  if (!event.key || !event.key.startsWith(WORKSPACE_RECORD_PREFIX)) return
  const record = parseWorkspaceRecord(event.newValue)
  if (!record) return
  if (seenRevisions.has(record.revision)) return
  rememberRevision(record.revision)
  const normalized: WorkspaceSyncEvent = {
    kind: record.deletedAt !== undefined ? 'workspace-deleted' : 'workspace-upserted',
    source: 'storage',
    workspaceId: record.id,
    activeWorkspaceId: getActiveWorkspaceId(),
    revision: record.revision,
    workspaces: currentSummaries(),
  }
  for (const listener of listeners) {
    listener(normalized)
  }
}

function ensureSyncHooks(): void {
  if (hooksInstalled || typeof window === 'undefined') return
  hooksInstalled = true
  window.addEventListener('storage', handleStorageEvent)
  if (typeof BroadcastChannel !== 'undefined') {
    broadcastChannel = new BroadcastChannel(WORKSPACE_SYNC_CHANNEL)
    broadcastChannel.onmessage = (event) => handleBroadcastMessage(event.data)
  }
}

function syncActiveWorkspaceId(
  workspaceId: string | null,
  options: SetActiveWorkspaceOptions = {},
): ActiveWorkspaceEnvelope | null {
  const s = storage()
  if (!s) return null
  const revision = options.revision ?? revisionId()
  const envelope: ActiveWorkspaceEnvelope = {
    v: 1,
    workspaceId,
    updatedAt: now(),
    revision,
  }
  s.setItem(ACTIVE_WORKSPACE_STORAGE_KEY, JSON.stringify(envelope))
  return envelope
}

export function setActiveWorkspaceId(
  workspaceId: string | null,
  options: SetActiveWorkspaceOptions = {},
): ActiveWorkspaceEnvelope | null {
  ensureSyncHooks()
  const envelope = syncActiveWorkspaceId(workspaceId, options)
  if (!envelope) return null
  broadcastOrLocal(
    {
      kind: 'active-workspace-changed',
      source: options.source ?? 'local',
      workspaceId,
      activeWorkspaceId: workspaceId,
      revision: envelope.revision,
      workspaces: currentSummaries(),
    },
    (options.source ?? 'local') === 'local',
  )
  return envelope
}

export function readWorkspaceRecord(workspaceId: string): WorkspaceRecordEnvelope | null {
  return readRecord(workspaceId)
}

export function readWorkspacePayload(workspaceId: string): string | null {
  const record = readRecord(workspaceId)
  if (!record || record.deletedAt !== undefined || typeof record.payload !== 'string') return null
  return record.payload
}

export function listWorkspaceSummaries(): WorkspaceSummary[] {
  return currentSummaries()
}

export function upsertWorkspaceRecord(
  workspaceId: string,
  payload: string,
  options: UpsertWorkspaceOptions = {},
): WorkspaceRecordEnvelope | null {
  ensureSyncHooks()
  const s = storage()
  if (!s) return null
  const existing = readRecord(workspaceId)
  const revision = options.revision ?? revisionId()
  const createdAt =
    options.createdAt ?? (existing && existing.deletedAt === undefined ? existing.createdAt : now())
  const name =
    options.name ??
    (existing && existing.deletedAt === undefined ? existing.name : defaultWorkspaceName(workspaceId, currentSummaries().length))
  const record: WorkspaceRecordEnvelope = {
    v: 1,
    id: workspaceId,
    name,
    createdAt,
    updatedAt: now(),
    revision,
    focusedProblemId:
      options.focusedProblemId !== undefined
        ? options.focusedProblemId
        : existing && existing.deletedAt === undefined
          ? existing.focusedProblemId ?? null
          : null,
    payload,
  }
  writeRecord(record)
  if (options.activate !== false) {
    syncActiveWorkspaceId(workspaceId, { source: options.source, revision })
  }
  broadcastOrLocal(
    {
      kind: 'workspace-upserted',
      source: options.source ?? 'local',
      workspaceId,
      activeWorkspaceId: options.activate === false ? getActiveWorkspaceId() : workspaceId,
      revision,
      workspaces: currentSummaries(),
    },
    (options.source ?? 'local') === 'local',
  )
  return record
}

export function deleteWorkspaceRecord(
  workspaceId: string,
  options: DeleteWorkspaceOptions = {},
): boolean {
  ensureSyncHooks()
  const s = storage()
  if (!s) return false
  const existing = readRecord(workspaceId)
  if (!existing || existing.deletedAt !== undefined) return false
  const revision = options.revision ?? revisionId()
  const tombstone: WorkspaceRecordEnvelope = {
    v: 1,
    id: existing.id,
    name: existing.name,
    createdAt: existing.createdAt,
    updatedAt: now(),
    revision,
    focusedProblemId: existing.focusedProblemId ?? null,
    deletedAt: now(),
  }
  writeRecord(tombstone)
  const active = getActiveWorkspaceId()
  if (active === workspaceId) {
    const nextActive = listWorkspaceSummaries().find((summary) => summary.id !== workspaceId)?.id ?? null
    syncActiveWorkspaceId(nextActive, { source: options.source, revision })
  }
  broadcastOrLocal(
    {
      kind: 'workspace-deleted',
      source: options.source ?? 'local',
      workspaceId,
      activeWorkspaceId: getActiveWorkspaceId(),
      revision,
      workspaces: currentSummaries(),
    },
    false,
  )
  return true
}

export function createWorkspaceId(): string {
  return `ws-${revisionId().slice(0, 8)}`
}

export function subscribeWorkspaceSync(listener: WorkspaceSyncListener): () => void {
  ensureSyncHooks()
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function clearWorkspaceStoreForTests(): void {
  listeners.clear()
  seenRevisions.clear()
  if (broadcastChannel) {
    broadcastChannel.close()
    broadcastChannel = null
  }
  if (hooksInstalled && typeof window !== 'undefined') {
    window.removeEventListener('storage', handleStorageEvent)
  }
  hooksInstalled = false
}
