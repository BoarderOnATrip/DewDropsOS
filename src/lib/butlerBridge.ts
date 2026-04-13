const DEFAULT_BUTLER_BRIDGE_URL = 'http://127.0.0.1:8765'
const BRIDGE_SETTINGS_KEY = 'dewdrops-butler-bridge-settings'

export type ButlerSwarmTemplate = 'planning' | 'relationship' | 'operator' | 'research' | 'build'

export type ButlerBridgeSettings = {
  url: string
  token: string
}

export type ButlerBridgeHealth = {
  ok: boolean
  service?: string
  version?: string
  pairing_required?: boolean
  lan_enabled?: boolean
  token_hint?: string
}

export type ButlerPairingInfo = {
  ok: boolean
  token: string
  state_path?: string
  lan_enabled?: boolean
  authorization_header?: string
}

export type ButlerSwarmContract = {
  id: string
  contract_id: string
  room_id: string
  title: string
  objective: string
  template?: string
  target?: string
  launcher?: string
  status?: string
}

export type ButlerSwarmRunAgent = {
  agent_id: string
  title: string
  status?: string
  result_summary?: string
  error?: string
}

export type ButlerSwarmRun = {
  id: string
  run_id: string
  contract_id: string
  room_id: string
  title: string
  template?: string
  status?: string
  summary?: string
  updated_at?: string
  created_at?: string
  launched_at?: string | null
  completed_at?: string | null
  report_path?: string
  agent_states?: ButlerSwarmRunAgent[]
}

export type ButlerSwarmRunReport = {
  run_id: string
  report_path: string
  exists: boolean
  content?: string
}

export type ButlerUiTraceEvent = {
  surface?: string
  label: string
  detail?: string
  selected_ids?: string[]
  metadata?: Record<string, unknown>
}

export type CreateSwarmContractInput = {
  title: string
  objective: string
  template: ButlerSwarmTemplate
  room_id?: string
  room_kind?: string
  target?: string
  launcher?: string
  metadata?: Record<string, unknown>
  source_refs?: string[]
  created_by?: string
}

export class ButlerBridgeError extends Error {
  status: number
  body: string

  constructor(status: number, body: string) {
    super(`Butler bridge error ${status}: ${body}`)
    this.name = 'ButlerBridgeError'
    this.status = status
    this.body = body
  }
}

function normalizeBridgeUrl(url: string): string {
  const trimmed = url.trim()
  if (!trimmed) return DEFAULT_BUTLER_BRIDGE_URL
  return trimmed.replace(/\/+$/, '')
}

export function loadButlerBridgeSettings(): ButlerBridgeSettings {
  if (typeof localStorage === 'undefined') {
    return { url: DEFAULT_BUTLER_BRIDGE_URL, token: '' }
  }
  try {
    const raw = localStorage.getItem(BRIDGE_SETTINGS_KEY)
    if (!raw) return { url: DEFAULT_BUTLER_BRIDGE_URL, token: '' }
    const parsed = JSON.parse(raw) as Partial<ButlerBridgeSettings>
    return {
      url: normalizeBridgeUrl(typeof parsed.url === 'string' ? parsed.url : DEFAULT_BUTLER_BRIDGE_URL),
      token: typeof parsed.token === 'string' ? parsed.token : '',
    }
  } catch {
    return { url: DEFAULT_BUTLER_BRIDGE_URL, token: '' }
  }
}

export function saveButlerBridgeSettings(settings: ButlerBridgeSettings): ButlerBridgeSettings {
  const normalized = {
    url: normalizeBridgeUrl(settings.url),
    token: settings.token.trim(),
  }
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(BRIDGE_SETTINGS_KEY, JSON.stringify(normalized))
  }
  return normalized
}

function bridgeHeaders(settings: ButlerBridgeSettings, includeJson = true): HeadersInit {
  const headers: Record<string, string> = {}
  if (includeJson) {
    headers['Content-Type'] = 'application/json'
  }
  if (settings.token.trim()) {
    headers.Authorization = `Bearer ${settings.token.trim()}`
    headers['X-AIBUTLER-Token'] = settings.token.trim()
  }
  return headers
}

async function bridgeRequest<T>(settings: ButlerBridgeSettings, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${normalizeBridgeUrl(settings.url)}${path}`, init)
  if (!response.ok) {
    const text = await response.text()
    throw new ButlerBridgeError(response.status, text)
  }
  return response.json() as Promise<T>
}

export async function getButlerBridgeHealth(settings: ButlerBridgeSettings): Promise<ButlerBridgeHealth> {
  return bridgeRequest<ButlerBridgeHealth>(settings, '/health', {
    headers: bridgeHeaders(settings, false),
  })
}

export async function getLocalPairingInfo(settings: ButlerBridgeSettings): Promise<ButlerPairingInfo> {
  return bridgeRequest<ButlerPairingInfo>(settings, '/pairing', {
    headers: bridgeHeaders(settings, false),
  })
}

export async function pairLocalBridge(settings: ButlerBridgeSettings): Promise<ButlerBridgeSettings> {
  const pairing = await getLocalPairingInfo(settings)
  return saveButlerBridgeSettings({
    url: settings.url,
    token: pairing.token,
  })
}

export async function createSwarmContract(
  settings: ButlerBridgeSettings,
  payload: CreateSwarmContractInput,
): Promise<ButlerSwarmContract> {
  const result = await bridgeRequest<{ contract?: ButlerSwarmContract }>(settings, '/swarm/contracts', {
    method: 'POST',
    headers: bridgeHeaders(settings),
    body: JSON.stringify({
      title: payload.title,
      objective: payload.objective,
      template: payload.template,
      room_id: payload.room_id,
      room_kind: payload.room_kind ?? 'project',
      target: payload.target ?? 'local_desktop',
      launcher: payload.launcher ?? 'desktop',
      metadata: payload.metadata ?? {},
      source_refs: payload.source_refs ?? [],
      created_by: payload.created_by ?? 'dewdrops',
    }),
  })
  if (!result.contract) {
    throw new Error('Bridge returned no swarm contract.')
  }
  return result.contract
}

export async function launchSwarmContract(
  settings: ButlerBridgeSettings,
  contractId: string,
): Promise<{ contract?: ButlerSwarmContract; run?: ButlerSwarmRun }> {
  return bridgeRequest<{ contract?: ButlerSwarmContract; run?: ButlerSwarmRun }>(
    settings,
    `/swarm/contracts/${encodeURIComponent(contractId)}/launch`,
    {
      method: 'POST',
      headers: bridgeHeaders(settings),
      body: JSON.stringify({
        created_by: 'dewdrops',
      }),
    },
  )
}

export async function listSwarmRuns(
  settings: ButlerBridgeSettings,
  options?: { roomId?: string; limit?: number },
): Promise<ButlerSwarmRun[]> {
  const params = new URLSearchParams()
  params.set('limit', String(options?.limit ?? 12))
  if (options?.roomId) {
    params.set('room_id', options.roomId)
  }
  const result = await bridgeRequest<{ runs?: ButlerSwarmRun[] }>(
    settings,
    `/swarm/runs?${params.toString()}`,
    {
      headers: bridgeHeaders(settings, false),
    },
  )
  return Array.isArray(result.runs) ? result.runs : []
}

export async function getSwarmRunReport(
  settings: ButlerBridgeSettings,
  runId: string,
): Promise<ButlerSwarmRunReport> {
  const result = await bridgeRequest<{ report?: ButlerSwarmRunReport }>(
    settings,
    `/swarm/runs/${encodeURIComponent(runId)}/report`,
    {
      headers: bridgeHeaders(settings, false),
    },
  )
  if (!result.report) {
    throw new Error('Bridge returned no swarm run report.')
  }
  return result.report
}

export async function stopSwarmRun(
  settings: ButlerBridgeSettings,
  runId: string,
): Promise<ButlerSwarmRun> {
  const result = await bridgeRequest<{ run?: ButlerSwarmRun }>(
    settings,
    `/swarm/runs/${encodeURIComponent(runId)}/stop`,
    {
      method: 'POST',
      headers: bridgeHeaders(settings),
      body: JSON.stringify({
        created_by: 'dewdrops',
      }),
    },
  )
  if (!result.run) {
    throw new Error('Bridge returned no stopped swarm run.')
  }
  return result.run
}

export async function sendUiTraceEvent(
  settings: ButlerBridgeSettings,
  payload: ButlerUiTraceEvent,
): Promise<void> {
  await bridgeRequest(settings, '/debug/ui-trace', {
    method: 'POST',
    headers: bridgeHeaders(settings),
    body: JSON.stringify({
      surface: payload.surface ?? 'dewdrops',
      label: payload.label,
      detail: payload.detail ?? '',
      selected_ids: payload.selected_ids ?? [],
      metadata: payload.metadata ?? {},
    }),
  })
}
