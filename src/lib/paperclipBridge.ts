const DEFAULT_PAPERCLIP_API_URL = 'http://127.0.0.1:3100'
const PAPERCLIP_SETTINGS_KEY = 'dewdrops-paperclip-bridge-settings'

export type PaperclipBridgeSettings = {
  url: string
  token: string
}

export type PaperclipCompany = {
  id: string
  name: string
  description?: string
  status?: string
}

export type PaperclipProject = {
  id: string
  name: string
  description?: string
  status?: string
}

export type PaperclipAgent = {
  id: string
  name: string
  role?: string
  title?: string
  status?: string
  adapterType?: string
  capabilities?: string
}

export type PaperclipIssue = {
  id: string
  title: string
  identifier?: string
  status?: string
  priority?: string
  assigneeAgentId?: string | null
  projectId?: string | null
}

export type PaperclipIssueDocument = {
  id: string
  key: string
  title?: string | null
  format?: string
  body: string
  latestRevisionId?: string | null
}

export type CreatePaperclipIssueInput = {
  companyId: string
  title: string
  description: string
  status?: string
  priority?: string
  assigneeAgentId?: string
  projectId?: string
}

export class PaperclipBridgeError extends Error {
  status: number
  body: string

  constructor(status: number, body: string) {
    super(`Paperclip bridge error ${status}: ${body}`)
    this.name = 'PaperclipBridgeError'
    this.status = status
    this.body = body
  }
}

function normalizePaperclipUrl(url: string): string {
  const trimmed = url.trim()
  if (!trimmed) return DEFAULT_PAPERCLIP_API_URL
  return trimmed.replace(/\/+$/, '')
}

export function loadPaperclipBridgeSettings(): PaperclipBridgeSettings {
  if (typeof localStorage === 'undefined') {
    return { url: DEFAULT_PAPERCLIP_API_URL, token: '' }
  }
  try {
    const raw = localStorage.getItem(PAPERCLIP_SETTINGS_KEY)
    if (!raw) return { url: DEFAULT_PAPERCLIP_API_URL, token: '' }
    const parsed = JSON.parse(raw) as Partial<PaperclipBridgeSettings>
    return {
      url: normalizePaperclipUrl(typeof parsed.url === 'string' ? parsed.url : DEFAULT_PAPERCLIP_API_URL),
      token: typeof parsed.token === 'string' ? parsed.token : '',
    }
  } catch {
    return { url: DEFAULT_PAPERCLIP_API_URL, token: '' }
  }
}

export function savePaperclipBridgeSettings(
  settings: PaperclipBridgeSettings,
): PaperclipBridgeSettings {
  const normalized = {
    url: normalizePaperclipUrl(settings.url),
    token: settings.token.trim(),
  }
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(PAPERCLIP_SETTINGS_KEY, JSON.stringify(normalized))
  }
  return normalized
}

function paperclipHeaders(settings: PaperclipBridgeSettings, includeJson = true): HeadersInit {
  const headers: Record<string, string> = {}
  if (includeJson) {
    headers['Content-Type'] = 'application/json'
  }
  if (settings.token.trim()) {
    headers.Authorization = `Bearer ${settings.token.trim()}`
  }
  return headers
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined
}

function listFromPayload(payload: unknown, key: string): unknown[] {
  if (Array.isArray(payload)) return payload
  if (!isRecord(payload)) return []
  return Array.isArray(payload[key]) ? payload[key] : []
}

function entityFromPayload<T>(payload: unknown, key: string, normalize: (value: unknown) => T | null): T {
  const normalizedDirect = normalize(payload)
  if (normalizedDirect) return normalizedDirect
  if (isRecord(payload)) {
    const normalizedNested = normalize(payload[key])
    if (normalizedNested) return normalizedNested
  }
  throw new Error(`Paperclip returned no ${key}.`)
}

async function paperclipRequest<T>(
  settings: PaperclipBridgeSettings,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${normalizePaperclipUrl(settings.url)}/api${path}`, init)
  if (!response.ok) {
    const text = await response.text()
    throw new PaperclipBridgeError(response.status, text)
  }
  return response.json() as Promise<T>
}

function normalizeCompany(raw: unknown): PaperclipCompany | null {
  if (!isRecord(raw) || typeof raw.id !== 'string' || typeof raw.name !== 'string') return null
  return {
    id: raw.id,
    name: raw.name,
    description: asOptionalString(raw.description),
    status: asOptionalString(raw.status),
  }
}

function normalizeProject(raw: unknown): PaperclipProject | null {
  if (!isRecord(raw) || typeof raw.id !== 'string' || typeof raw.name !== 'string') return null
  return {
    id: raw.id,
    name: raw.name,
    description: asOptionalString(raw.description),
    status: asOptionalString(raw.status),
  }
}

function normalizeAgent(raw: unknown): PaperclipAgent | null {
  if (!isRecord(raw) || typeof raw.id !== 'string') return null
  const name =
    asOptionalString(raw.name) ??
    asOptionalString(raw.displayName) ??
    asOptionalString(raw.slug)
  if (!name) return null
  return {
    id: raw.id,
    name,
    role: asOptionalString(raw.role),
    title: asOptionalString(raw.title),
    status: asOptionalString(raw.status),
    adapterType: asOptionalString(raw.adapterType),
    capabilities: asOptionalString(raw.capabilities),
  }
}

function normalizeIssue(raw: unknown): PaperclipIssue | null {
  if (!isRecord(raw) || typeof raw.id !== 'string' || typeof raw.title !== 'string') return null
  return {
    id: raw.id,
    title: raw.title,
    identifier: asOptionalString(raw.identifier),
    status: asOptionalString(raw.status),
    priority: asOptionalString(raw.priority),
    assigneeAgentId:
      raw.assigneeAgentId === null || typeof raw.assigneeAgentId === 'string'
        ? raw.assigneeAgentId
        : undefined,
    projectId:
      raw.projectId === null || typeof raw.projectId === 'string' ? raw.projectId : undefined,
  }
}

function normalizeIssueDocument(raw: unknown): PaperclipIssueDocument | null {
  if (
    !isRecord(raw) ||
    typeof raw.id !== 'string' ||
    typeof raw.key !== 'string' ||
    typeof raw.body !== 'string'
  ) {
    return null
  }
  return {
    id: raw.id,
    key: raw.key,
    title: raw.title === null || typeof raw.title === 'string' ? raw.title : undefined,
    format: asOptionalString(raw.format),
    body: raw.body,
    latestRevisionId:
      raw.latestRevisionId === null || typeof raw.latestRevisionId === 'string'
        ? raw.latestRevisionId
        : undefined,
  }
}

export async function listPaperclipCompanies(
  settings: PaperclipBridgeSettings,
): Promise<PaperclipCompany[]> {
  const payload = await paperclipRequest<unknown>(settings, '/companies', {
    headers: paperclipHeaders(settings, false),
  })
  return listFromPayload(payload, 'companies')
    .map((entry) => normalizeCompany(entry))
    .filter((entry): entry is PaperclipCompany => entry !== null)
}

export async function listPaperclipProjects(
  settings: PaperclipBridgeSettings,
  companyId: string,
): Promise<PaperclipProject[]> {
  const payload = await paperclipRequest<unknown>(
    settings,
    `/companies/${encodeURIComponent(companyId)}/projects`,
    {
      headers: paperclipHeaders(settings, false),
    },
  )
  return listFromPayload(payload, 'projects')
    .map((entry) => normalizeProject(entry))
    .filter((entry): entry is PaperclipProject => entry !== null)
}

export async function listPaperclipAgents(
  settings: PaperclipBridgeSettings,
  companyId: string,
): Promise<PaperclipAgent[]> {
  const payload = await paperclipRequest<unknown>(
    settings,
    `/companies/${encodeURIComponent(companyId)}/agents`,
    {
      headers: paperclipHeaders(settings, false),
    },
  )
  return listFromPayload(payload, 'agents')
    .map((entry) => normalizeAgent(entry))
    .filter((entry): entry is PaperclipAgent => entry !== null)
}

export async function createPaperclipIssue(
  settings: PaperclipBridgeSettings,
  input: CreatePaperclipIssueInput,
): Promise<PaperclipIssue> {
  const payload = await paperclipRequest<unknown>(
    settings,
    `/companies/${encodeURIComponent(input.companyId)}/issues`,
    {
      method: 'POST',
      headers: paperclipHeaders(settings),
      body: JSON.stringify({
        title: input.title,
        description: input.description,
        status: input.status ?? 'todo',
        priority: input.priority ?? 'high',
        assigneeAgentId: input.assigneeAgentId ?? null,
        projectId: input.projectId ?? null,
      }),
    },
  )
  return entityFromPayload(payload, 'issue', normalizeIssue)
}

export async function addPaperclipIssueComment(
  settings: PaperclipBridgeSettings,
  issueId: string,
  body: string,
): Promise<void> {
  await paperclipRequest(settings, `/issues/${encodeURIComponent(issueId)}/comments`, {
    method: 'POST',
    headers: paperclipHeaders(settings),
    body: JSON.stringify({ body }),
  })
}

export async function getPaperclipIssueDocument(
  settings: PaperclipBridgeSettings,
  issueId: string,
  key: string,
): Promise<PaperclipIssueDocument | null> {
  try {
    const payload = await paperclipRequest<unknown>(
      settings,
      `/issues/${encodeURIComponent(issueId)}/documents/${encodeURIComponent(key)}`,
      {
        headers: paperclipHeaders(settings, false),
      },
    )
    return entityFromPayload(payload, 'document', normalizeIssueDocument)
  } catch (error) {
    if (error instanceof PaperclipBridgeError && error.status === 404) {
      return null
    }
    throw error
  }
}

export async function upsertPaperclipIssueDocument(
  settings: PaperclipBridgeSettings,
  issueId: string,
  options: {
    key: string
    title: string
    body: string
    format?: string
  },
): Promise<PaperclipIssueDocument> {
  const existing = await getPaperclipIssueDocument(settings, issueId, options.key)
  const payload = await paperclipRequest<unknown>(
    settings,
    `/issues/${encodeURIComponent(issueId)}/documents/${encodeURIComponent(options.key)}`,
    {
      method: 'PUT',
      headers: paperclipHeaders(settings),
      body: JSON.stringify({
        title: options.title,
        format: options.format ?? 'markdown',
        body: options.body,
        baseRevisionId: existing?.latestRevisionId ?? null,
      }),
    },
  )
  return entityFromPayload(payload, 'document', normalizeIssueDocument)
}

export async function invokePaperclipAgent(
  settings: PaperclipBridgeSettings,
  agentId: string,
): Promise<{ runId: string }> {
  const payload = await paperclipRequest<unknown>(
    settings,
    `/agents/${encodeURIComponent(agentId)}/heartbeat/invoke`,
    {
      method: 'POST',
      headers: paperclipHeaders(settings, false),
    },
  )
  if (isRecord(payload) && typeof payload.runId === 'string') {
    return { runId: payload.runId }
  }
  if (isRecord(payload) && typeof payload.id === 'string') {
    return { runId: payload.id }
  }
  if (isRecord(payload) && isRecord(payload.run) && typeof payload.run.id === 'string') {
    return { runId: payload.run.id }
  }
  throw new Error('Paperclip returned no run id.')
}
