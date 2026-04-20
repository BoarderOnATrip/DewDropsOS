import type {
  AgentRuntimeBinding,
  DewDropSessionState,
} from '../freeform/types'
import type {
  CreateRuntimeSessionInput,
  ResizeRuntimeSessionInput,
  RuntimeBridgeHealth,
  RuntimeSessionRecord,
  WriteRuntimeSessionInput,
} from './runtimeSessionTypes'

export type WorkerTerminalSession = RuntimeSessionRecord
export type WorkerTerminalHealth = RuntimeBridgeHealth

export type CreateWorkerTerminalSessionInput = {
  agentId: string
  title: string
  runtime: AgentRuntimeBinding
  workspaceId?: string
  problemId?: string
}

export class WorkerTerminalBridgeError extends Error {
  status: number
  body: string

  constructor(status: number, body: string) {
    super(`Worker terminal bridge error ${status}: ${body}`)
    this.name = 'WorkerTerminalBridgeError'
    this.status = status
    this.body = body
  }
}

const DEFAULT_RUNTIME_BRIDGE_BASE = '/api/runtime'

function normalizeBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim()
  if (!trimmed) return DEFAULT_RUNTIME_BRIDGE_BASE
  return trimmed.replace(/\/+$/, '')
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${normalizeBaseUrl(DEFAULT_RUNTIME_BRIDGE_BASE)}${path}`, init)
  if (!response.ok) {
    const body = await response.text()
    throw new WorkerTerminalBridgeError(response.status, body)
  }
  return response.json() as Promise<T>
}

export async function getWorkerTerminalHealth(): Promise<WorkerTerminalHealth> {
  return requestJson<WorkerTerminalHealth>('/health')
}

export async function listWorkerTerminalSessions(options?: {
  workspaceId?: string
  problemId?: string
  agentId?: string
}): Promise<WorkerTerminalSession[]> {
  const search = new URLSearchParams()
  if (options?.workspaceId) search.set('workspaceId', options.workspaceId)
  if (options?.problemId) search.set('problemId', options.problemId)
  if (options?.agentId) search.set('agentId', options.agentId)
  const suffix = search.toString() ? `?${search.toString()}` : ''
  return requestJson<WorkerTerminalSession[]>(`/sessions${suffix}`)
}

export async function getWorkerTerminalSession(sessionId: string): Promise<WorkerTerminalSession> {
  return requestJson<WorkerTerminalSession>(`/sessions/${encodeURIComponent(sessionId)}`)
}

export async function createWorkerTerminalSession(
  input: CreateWorkerTerminalSessionInput,
): Promise<WorkerTerminalSession> {
  const body: CreateRuntimeSessionInput = {
    label: input.title,
    command: input.runtime.command?.trim() || input.runtime.profile,
    cwd: input.runtime.workspaceRoot?.trim() || undefined,
    workspaceId: input.workspaceId?.trim() || undefined,
    problemId: input.problemId?.trim() || undefined,
    agentId: input.agentId,
    env: {
      DEWDROPS_RUNTIME_KIND: input.runtime.kind,
      DEWDROPS_RUNTIME_PROFILE: input.runtime.profile,
      DEWDROPS_RUNTIME_TRANSPORT: input.runtime.transport,
      DEWDROPS_RUNTIME_VPN_ALIAS: input.runtime.vpnAlias ?? '',
      DEWDROPS_RUNTIME_INSTANCE_LABEL: input.runtime.instanceLabel,
    },
    logTailLimit: 120,
    sessionPolicy: input.runtime.sessionPolicy
      ? {
          maxRuntimeMs: input.runtime.sessionPolicy.maxRuntimeMs,
          maxSteps: input.runtime.sessionPolicy.maxSteps,
          allowNetwork: input.runtime.sessionPolicy.allowNetwork,
          writableRoots: input.runtime.sessionPolicy.writableRoots,
          requiresApprovalFor: input.runtime.sessionPolicy.requiresApprovalFor,
        }
      : undefined,
  }
  return requestJson<WorkerTerminalSession>('/sessions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

export async function resizeWorkerTerminalSession(
  sessionId: string,
  cols: number,
  rows: number,
): Promise<WorkerTerminalSession> {
  const body: ResizeRuntimeSessionInput = { cols, rows }
  return requestJson<WorkerTerminalSession>(`/sessions/${encodeURIComponent(sessionId)}/resize`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

export async function stopWorkerTerminalSession(sessionId: string): Promise<WorkerTerminalSession> {
  return requestJson<WorkerTerminalSession>(`/sessions/${encodeURIComponent(sessionId)}/kill`, {
    method: 'POST',
  })
}

export async function sendWorkerTerminalSessionInput(
  sessionId: string,
  input: string,
): Promise<WorkerTerminalSession> {
  const body: WriteRuntimeSessionInput = { input }
  return requestJson<WorkerTerminalSession>(`/sessions/${encodeURIComponent(sessionId)}/input`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

export function workerTerminalStateFromSession(session: WorkerTerminalSession): DewDropSessionState {
  return {
    status: session.status,
    sessionId: session.id,
    pid: typeof session.pid === 'number' ? String(session.pid) : undefined,
    startedAt: session.startedAt,
    lastHeartbeatAt: session.updatedAt,
    currentTask: session.command,
    cols: session.cols,
    rows: session.rows,
    outputVersion: session.outputVersion,
    terminalBuffer: session.terminalBuffer,
    logTail: session.logTail,
  }
}
