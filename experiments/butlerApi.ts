const DEFAULT_BUTLER_BRIDGE_URL = "http://127.0.0.1:8765"

export class ButlerBridgeError extends Error {
  status: number
  body: string

  constructor(status: number, body: string) {
    super(`Butler bridge error ${status}: ${body}`)
    this.name = "ButlerBridgeError"
    this.status = status
    this.body = body
  }
}

export interface ButlerRoom {
  id: string
  room_id: string
  kind: string
  title: string
  status?: string
  metadata?: Record<string, unknown>
  source_refs?: string[]
  current_draft_version?: string | null
  current_published_version?: string | null
  created_at?: string
  updated_at?: string
}

export interface ButlerRoomArtifact {
  id: string
  artifact_id: string
  room_id: string
  artifact_kind: string
  artifact_url: string
  mime_type?: string
  metadata?: Record<string, unknown>
  created_by?: string
  created_at?: string
  updated_at?: string
}

export interface ButlerRoomVersion {
  id: string
  version_id: string
  room_id: string
  state_kind: string
  payload?: Record<string, unknown>
  metadata?: Record<string, unknown>
  parent_version_id?: string | null
  created_by?: string
  status?: string
  created_at?: string
  published_at?: string | null
}

export interface ButlerContinuityPacket {
  id: string
  kind: string
  title: string
  content?: string
  source_device?: string
  target_device?: string
  source_surface?: string
  status?: string
  metadata?: Record<string, unknown>
  room_id?: string | null
  artifact_id?: string | null
  version_id?: string | null
  refs?: string[]
  lease_owner?: string
  lease_expires_at?: string | null
  consumed_at?: string | null
  expires_at?: string | null
  session_id?: string | null
  created_at?: string
  updated_at?: string
}

export interface ButlerSwarmAgentSpec {
  id: string
  title: string
  role: string
  objective: string
  depends_on?: string[]
  max_iterations?: number
  tool_hints?: string[]
  metadata?: Record<string, unknown>
}

export interface ButlerSwarmAgentState {
  agent_id: string
  title: string
  role: string
  objective?: string
  depends_on?: string[]
  status?: string
  task_id?: string | null
  result_summary?: string
  error?: string
  started_at?: string | null
  completed_at?: string | null
  metadata?: Record<string, unknown>
}

export interface ButlerSwarmContract {
  id: string
  contract_id: string
  room_id: string
  title: string
  objective: string
  target?: string
  launcher?: string
  status?: string
  agents?: ButlerSwarmAgentSpec[]
  metadata?: Record<string, unknown>
  source_refs?: string[]
  created_by?: string
  created_at?: string
  updated_at?: string
}

export interface ButlerSwarmRun {
  id: string
  run_id: string
  contract_id: string
  room_id: string
  title: string
  target?: string
  launcher?: string
  execution_backend?: string
  status?: string
  log_path?: string
  command?: string
  pid?: number | null
  remote_job_id?: string
  agent_states?: ButlerSwarmAgentState[]
  metadata?: Record<string, unknown>
  created_at?: string
  launched_at?: string | null
  completed_at?: string | null
  updated_at?: string
}

function bridgeUrl(): string {
  return (import.meta.env.VITE_BUTLER_BRIDGE_URL as string | undefined)?.trim() || DEFAULT_BUTLER_BRIDGE_URL
}

function bridgeToken(): string {
  return (import.meta.env.VITE_BUTLER_BRIDGE_TOKEN as string | undefined)?.trim() || ""
}

function bridgeHeaders(includeJson = true): Record<string, string> {
  const headers: Record<string, string> = {}
  if (includeJson) {
    headers["Content-Type"] = "application/json"
  }
  const token = bridgeToken()
  if (token) {
    headers.Authorization = `Bearer ${token}`
    headers["X-AIBUTLER-Token"] = token
  }
  return headers
}

async function bridgeRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${bridgeUrl()}${path}`, init)
  if (!response.ok) {
    const text = await response.text()
    throw new ButlerBridgeError(response.status, text)
  }
  return response.json() as Promise<T>
}

export async function listRooms(limit = 25): Promise<ButlerRoom[]> {
  const params = new URLSearchParams({ limit: String(limit) })
  const payload = await bridgeRequest<{ rooms?: ButlerRoom[] }>(`/rooms?${params.toString()}`, {
    headers: bridgeHeaders(false),
  })
  return Array.isArray(payload.rooms) ? payload.rooms : []
}

export async function getRoom(roomId: string): Promise<ButlerRoom | null> {
  try {
    const payload = await bridgeRequest<{ room?: ButlerRoom }>(`/rooms/${encodeURIComponent(roomId)}`, {
      headers: bridgeHeaders(false),
    })
    return payload.room ?? null
  } catch (error) {
    if (error instanceof ButlerBridgeError && error.status === 404) {
      return null
    }
    throw error
  }
}

export async function resolveRoom(payload: {
  source_ref: string
  title?: string
  kind?: string
  metadata?: Record<string, unknown>
  created_by?: string
}): Promise<{ room?: ButlerRoom; created?: boolean }> {
  return bridgeRequest<{ room?: ButlerRoom; created?: boolean }>(`/rooms/resolve`, {
    method: "POST",
    headers: bridgeHeaders(),
    body: JSON.stringify(payload),
  })
}

export async function listRoomArtifacts(roomId: string, limit = 25): Promise<ButlerRoomArtifact[]> {
  const params = new URLSearchParams({ limit: String(limit) })
  const payload = await bridgeRequest<{ artifacts?: ButlerRoomArtifact[] }>(
    `/rooms/${encodeURIComponent(roomId)}/artifacts?${params.toString()}`,
    { headers: bridgeHeaders(false) },
  )
  return Array.isArray(payload.artifacts) ? payload.artifacts : []
}

export async function createContinuityPacket(payload: {
  kind?: string
  title: string
  content?: string
  target_device: string
  source_device?: string
  source_surface?: string
  metadata?: Record<string, unknown>
  room_id?: string
  artifact_id?: string
  version_id?: string
  refs?: string[]
  expires_in_minutes?: number
}): Promise<ButlerContinuityPacket | null> {
  const result = await bridgeRequest<{ packet?: ButlerContinuityPacket }>(`/continuity/push`, {
    method: "POST",
    headers: bridgeHeaders(),
    body: JSON.stringify(payload),
  })
  return result.packet ?? null
}

export async function claimContinuityPacket(
  packetId: string,
  actorDevice = "desktop",
  leaseMinutes = 30,
): Promise<ButlerContinuityPacket | null> {
  const result = await bridgeRequest<{ packet?: ButlerContinuityPacket }>(`/continuity/claim`, {
    method: "POST",
    headers: bridgeHeaders(),
    body: JSON.stringify({
      packet_id: packetId,
      actor_device: actorDevice,
      lease_minutes: leaseMinutes,
    }),
  })
  return result.packet ?? null
}

export async function acknowledgeContinuityPacket(
  packetId: string,
  actorDevice = "desktop",
  note = "",
): Promise<ButlerContinuityPacket | null> {
  const result = await bridgeRequest<{ packet?: ButlerContinuityPacket }>(`/continuity/ack`, {
    method: "POST",
    headers: bridgeHeaders(),
    body: JSON.stringify({
      packet_id: packetId,
      actor_device: actorDevice,
      note,
    }),
  })
  return result.packet ?? null
}

export async function getCurrentDraftVersion(roomId: string): Promise<ButlerRoomVersion | null> {
  const result = await bridgeRequest<{ draft?: ButlerRoomVersion | null }>(
    `/rooms/${encodeURIComponent(roomId)}/draft`,
    { headers: bridgeHeaders(false) },
  )
  return result.draft ?? null
}

export async function saveDraftVersion(payload: {
  roomId: string
  payload: Record<string, unknown>
  parent_version_id?: string | null
  state_kind?: string
  metadata?: Record<string, unknown>
  created_by?: string
}): Promise<ButlerRoomVersion | null> {
  const { roomId, ...body } = payload
  const result = await bridgeRequest<{ version?: ButlerRoomVersion }>(
    `/rooms/${encodeURIComponent(roomId)}/drafts`,
    {
      method: "POST",
      headers: bridgeHeaders(),
      body: JSON.stringify(body),
    },
  )
  return result.version ?? null
}

export async function publishDraftVersion(versionId: string, createdBy = "dewdrops"): Promise<ButlerRoomVersion | null> {
  const result = await bridgeRequest<{ version?: ButlerRoomVersion }>(
    `/versions/${encodeURIComponent(versionId)}/publish`,
    {
      method: "POST",
      headers: bridgeHeaders(),
      body: JSON.stringify({ created_by: createdBy }),
    },
  )
  return result.version ?? null
}

export async function createSwarmContract(payload: {
  title: string
  objective: string
  room_id?: string
  room_kind?: string
  target?: string
  launcher?: string
  agents?: ButlerSwarmAgentSpec[]
  metadata?: Record<string, unknown>
  source_refs?: string[]
  created_by?: string
}): Promise<ButlerSwarmContract | null> {
  const result = await bridgeRequest<{ contract?: ButlerSwarmContract }>(`/swarm/contracts`, {
    method: "POST",
    headers: bridgeHeaders(),
    body: JSON.stringify(payload),
  })
  return result.contract ?? null
}

export async function listSwarmContracts(params?: {
  room_id?: string
  status?: string
  limit?: number
}): Promise<ButlerSwarmContract[]> {
  const search = new URLSearchParams()
  if (params?.room_id) search.set("room_id", params.room_id)
  if (params?.status) search.set("status", params.status)
  if (params?.limit) search.set("limit", String(params.limit))
  const suffix = search.toString() ? `?${search.toString()}` : ""
  const result = await bridgeRequest<{ contracts?: ButlerSwarmContract[] }>(`/swarm/contracts${suffix}`, {
    headers: bridgeHeaders(false),
  })
  return Array.isArray(result.contracts) ? result.contracts : []
}

export async function launchSwarmContract(
  contractId: string,
  payload: {
    target?: string
    launcher?: string
    vpn_ssh_target?: string
    remote_workdir?: string
    remote_python?: string
    dry_run?: boolean
    created_by?: string
  } = {},
): Promise<{ contract?: ButlerSwarmContract; run?: ButlerSwarmRun; launch_ready?: boolean; dry_run?: boolean }> {
  return bridgeRequest(`/swarm/contracts/${encodeURIComponent(contractId)}/launch`, {
    method: "POST",
    headers: bridgeHeaders(),
    body: JSON.stringify(payload),
  })
}

export async function listSwarmRuns(params?: {
  contract_id?: string
  room_id?: string
  status?: string
  limit?: number
}): Promise<ButlerSwarmRun[]> {
  const search = new URLSearchParams()
  if (params?.contract_id) search.set("contract_id", params.contract_id)
  if (params?.room_id) search.set("room_id", params.room_id)
  if (params?.status) search.set("status", params.status)
  if (params?.limit) search.set("limit", String(params.limit))
  const suffix = search.toString() ? `?${search.toString()}` : ""
  const result = await bridgeRequest<{ runs?: ButlerSwarmRun[] }>(`/swarm/runs${suffix}`, {
    headers: bridgeHeaders(false),
  })
  return Array.isArray(result.runs) ? result.runs : []
}
