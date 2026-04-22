export type RuntimeSessionStatus =
  | 'idle'
  | 'starting'
  | 'running'
  | 'blocked'
  | 'done'
  | 'failed'
  | 'killed'

export type RuntimeSessionArtifactKind = 'report' | 'note' | 'image' | 'trace' | 'download'

export type RuntimeSessionArtifact = {
  id: string
  kind: RuntimeSessionArtifactKind
  title: string
  summary: string
  path: string
  mimeType?: string
  sizeBytes?: number
}

export type RuntimeBridgeHealth = {
  ok: boolean
  service: string
  version: string
  activeSessions: number
}

export type RuntimeHostCheck = {
  alias: string
  route: 'local' | 'vpn-ssh'
  ok: boolean
  checkedAt: string
  latencyMs: number
  detail: string
}

export type RuntimeSessionPolicy = {
  maxRuntimeMs?: number
  maxSteps?: number
  allowNetwork?: boolean
  writableRoots?: string[]
  requiresApprovalFor?: string[]
}

export type RuntimeSessionRecord = {
  id: string
  label: string
  command: string
  launchFile?: string
  launchArgs?: string[]
  cwd: string
  workspaceId?: string
  problemId?: string
  agentId?: string
  status: RuntimeSessionStatus
  pid?: number
  startedAt: string
  updatedAt: string
  endedAt?: string
  exitCode?: number | null
  signal?: string | null
  cols?: number
  rows?: number
  outputVersion: number
  terminalBuffer: string
  logTail: string[]
  env?: Record<string, string>
  sessionPolicy?: RuntimeSessionPolicy
}

export type CreateRuntimeSessionInput = {
  label: string
  command: string
  launchFile?: string
  launchArgs?: string[]
  cwd?: string
  workspaceId?: string
  problemId?: string
  agentId?: string
  env?: Record<string, string>
  cols?: number
  rows?: number
  logTailLimit?: number
  sessionPolicy?: RuntimeSessionPolicy
}

export type WriteRuntimeSessionInput = {
  input: string
}

export type ResizeRuntimeSessionInput = {
  cols: number
  rows: number
}
