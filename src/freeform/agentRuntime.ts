import type {
  AgentRuntimeBinding,
  AgentRuntimeKind,
  AgentRuntimeProfile,
  AgentRuntimeTransport,
  DewDropSessionApprovalGate,
  DewDropSessionPolicy,
  DewDropSessionState,
  DewDropSessionStatus,
  WorkflowCard,
} from './types'

type RuntimeLike = Partial<AgentRuntimeBinding> & {
  kind?: string
  profile?: string
  provider?: string
  transport?: string
  modelTag?: string
  sessionPolicy?: Partial<DewDropSessionPolicy>
  sessionState?: Partial<DewDropSessionState>
}

const TERMINAL_PROFILES: readonly AgentRuntimeProfile[] = [
  'openclaw',
  'hermes',
  'ollama',
  'codex',
  'claude-code',
  'paperclip',
  'browser-harness',
  'browser-harness-js',
  'playwright',
  'custom',
] as const
const LEGACY_PROVIDER_PROFILES: readonly AgentRuntimeProfile[] = [
  'openclaw',
  'codex',
  'claude-code',
  'paperclip',
] as const

export const DEWDROP_RUNTIME_PROFILE_OPTIONS: ReadonlyArray<{
  value: AgentRuntimeProfile
  label: string
  detail: string
}> = [
  {
    value: 'custom',
    label: 'Shell',
    detail: 'Plain terminal envelope for direct shell work.',
  },
  {
    value: 'hermes',
    label: 'Hermes',
    detail: 'Host-level agent runtime with skills, memory, and remote backends.',
  },
  {
    value: 'ollama',
    label: 'Local model',
    detail: 'Ollama-backed local model worker for on-box or GPU-host inference.',
  },
  {
    value: 'codex',
    label: 'Codex',
    detail: 'Coding worker mounted through the Codex CLI.',
  },
  {
    value: 'claude-code',
    label: 'Claude Code',
    detail: 'Coding worker mounted through the Claude CLI.',
  },
  {
    value: 'browser-harness',
    label: 'Browser Harness',
    detail: 'Editable Python CDP worker for real browser work.',
  },
  {
    value: 'browser-harness-js',
    label: 'Browser JS',
    detail: 'Typed CDP worker with the thinnest browser bridge.',
  },
  {
    value: 'playwright',
    label: 'Playwright',
    detail: 'Browser automation and test worker for multi-browser execution.',
  },
] as const

const RUNTIME_KINDS: readonly AgentRuntimeKind[] = ['terminal', 'service'] as const
const RUNTIME_TRANSPORTS: readonly AgentRuntimeTransport[] = ['cli', 'api'] as const
const SESSION_APPROVAL_GATES: readonly DewDropSessionApprovalGate[] = [
  'destructive',
  'external_network',
  'privileged',
] as const
const SESSION_STATUSES: readonly DewDropSessionStatus[] = [
  'idle',
  'starting',
  'running',
  'blocked',
  'done',
  'failed',
  'killed',
] as const

function slugToken(input: string, fallback: string): string {
  const normalized = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return normalized || fallback
}

function isRuntimeKind(value: string | undefined): value is AgentRuntimeKind {
  return !!value && (RUNTIME_KINDS as readonly string[]).includes(value)
}

function isRuntimeProfile(value: string | undefined): value is AgentRuntimeProfile {
  return !!value && (TERMINAL_PROFILES as readonly string[]).includes(value)
}

function isRuntimeTransport(value: string | undefined): value is AgentRuntimeTransport {
  return !!value && (RUNTIME_TRANSPORTS as readonly string[]).includes(value)
}

function isSessionApprovalGate(value: string | undefined): value is DewDropSessionApprovalGate {
  return !!value && (SESSION_APPROVAL_GATES as readonly string[]).includes(value)
}

function isSessionStatus(value: string | undefined): value is DewDropSessionStatus {
  return !!value && (SESSION_STATUSES as readonly string[]).includes(value)
}

function normalizeList(values: unknown): string[] {
  if (!Array.isArray(values)) return []
  return values
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim())
    .filter(Boolean)
}

const DEFAULT_TERMINAL_COMMAND = 'zsh -i -f'
const DEFAULT_TERMINAL_ROOT = '.'
export const DEFAULT_OLLAMA_MODEL_TAG = 'qwen2.5-coder:7b'

function normalizeModelTag(modelTag: string | undefined): string | undefined {
  const normalized = modelTag?.trim()
  return normalized || undefined
}

function inferOllamaModelTag(command: string | undefined): string | undefined {
  const normalized = command?.trim()
  if (!normalized) return undefined
  const match = normalized.match(/^ollama\s+run\s+([^\s]+)(?:\s|$)/i)
  return normalizeModelTag(match?.[1])
}

export function defaultModelTagForRuntimeProfile(
  profile: AgentRuntimeProfile,
): string | undefined {
  if (profile === 'ollama') return DEFAULT_OLLAMA_MODEL_TAG
  return undefined
}

export function defaultCommandForRuntimeProfile(
  profile: AgentRuntimeProfile,
  options?: { modelTag?: string },
): string | undefined {
  if (profile === 'custom') return DEFAULT_TERMINAL_COMMAND
  if (profile === 'openclaw') return 'openclaw'
  if (profile === 'hermes') return 'hermes'
  if (profile === 'ollama') {
    const modelTag = normalizeModelTag(options?.modelTag) ?? DEFAULT_OLLAMA_MODEL_TAG
    return `ollama run ${modelTag}`
  }
  if (profile === 'codex') return 'codex'
  if (profile === 'claude-code') return 'claude'
  if (profile === 'paperclip') return 'paperclip'
  if (profile === 'browser-harness') return 'browser-harness'
  if (profile === 'browser-harness-js') return 'browser-harness-js'
  if (profile === 'playwright') return 'npx playwright test'
  return DEFAULT_TERMINAL_COMMAND
}

function normalizeTerminalEnvelope(
  kind: AgentRuntimeKind,
  profile: AgentRuntimeProfile,
  modelTag: string | undefined,
  explicitCommand: string | undefined,
): { profile: AgentRuntimeProfile; modelTag: string | undefined; command: string | undefined } {
  if (kind !== 'terminal') {
    return { profile, modelTag, command: explicitCommand }
  }

  const command = explicitCommand?.trim() || undefined
  const defaultCommand = defaultCommandForRuntimeProfile(profile, { modelTag })
  if (!command) {
    if (profile === 'custom') {
      return { profile: 'custom', modelTag: undefined, command: DEFAULT_TERMINAL_COMMAND }
    }
    return { profile, modelTag, command: defaultCommand }
  }

  const legacyProviderCommand =
    profile === 'custom' ? undefined : defaultCommand

  if (
    profile !== 'custom' &&
    (LEGACY_PROVIDER_PROFILES as readonly string[]).includes(profile) &&
    legacyProviderCommand === command
  ) {
    return { profile: 'custom', modelTag: undefined, command: DEFAULT_TERMINAL_COMMAND }
  }

  return { profile, modelTag, command }
}

function inferProfile(runtime: RuntimeLike | undefined, fallback: AgentRuntimeProfile): AgentRuntimeProfile {
  const legacyProfile = typeof runtime?.profile === 'string' ? String(runtime.profile) : undefined
  if (isRuntimeProfile(runtime?.profile)) return runtime.profile
  if (legacyProfile === 'terminal' && isRuntimeProfile(runtime?.provider)) return runtime.provider
  if (isRuntimeProfile(runtime?.provider)) return runtime.provider
  if (runtime?.transport === 'api') return 'custom'
  return fallback
}

function inferKind(
  runtime: RuntimeLike | undefined,
  fallback: AgentRuntimeKind,
): AgentRuntimeKind {
  const legacyProfile = typeof runtime?.profile === 'string' ? String(runtime.profile) : undefined
  if (isRuntimeKind(runtime?.kind)) return runtime.kind
  if (runtime?.transport === 'api') return 'service'
  if (legacyProfile === 'terminal') return 'terminal'
  return fallback
}

function normalizeSessionPolicy(policy: RuntimeLike['sessionPolicy']): DewDropSessionPolicy {
  const defaultApprovalGates = [...SESSION_APPROVAL_GATES]
  const approvalGates = Array.isArray(policy?.requiresApprovalFor)
    ? policy.requiresApprovalFor.filter((value): value is DewDropSessionApprovalGate => isSessionApprovalGate(value))
    : defaultApprovalGates
  const writableRoots = normalizeList(policy?.writableRoots)

  return {
    maxRuntimeMs:
      typeof policy?.maxRuntimeMs === 'number' && Number.isFinite(policy.maxRuntimeMs)
        ? Math.max(60_000, Math.round(policy.maxRuntimeMs))
        : 30 * 60 * 1000,
    maxSteps:
      typeof policy?.maxSteps === 'number' && Number.isFinite(policy.maxSteps)
        ? Math.max(1, Math.round(policy.maxSteps))
        : 40,
    allowNetwork: typeof policy?.allowNetwork === 'boolean' ? policy.allowNetwork : false,
    writableRoots,
    requiresApprovalFor: approvalGates.length > 0 ? approvalGates : defaultApprovalGates,
  }
}

function normalizeSessionState(state: RuntimeLike['sessionState']): DewDropSessionState | undefined {
  if (!state) return undefined
  const status = isSessionStatus(state.status) ? state.status : 'idle'
  const normalized: DewDropSessionState = { status }
  if (typeof state.sessionId === 'string' && state.sessionId.trim()) normalized.sessionId = state.sessionId.trim()
  if (typeof state.pid === 'string' && state.pid.trim()) normalized.pid = state.pid.trim()
  if (typeof state.startedAt === 'string' && state.startedAt.trim()) normalized.startedAt = state.startedAt.trim()
  if (typeof state.lastHeartbeatAt === 'string' && state.lastHeartbeatAt.trim()) normalized.lastHeartbeatAt = state.lastHeartbeatAt.trim()
  if (typeof state.currentTask === 'string' && state.currentTask.trim()) normalized.currentTask = state.currentTask.trim()
  if (typeof state.cols === 'number' && Number.isFinite(state.cols)) normalized.cols = Math.max(1, Math.round(state.cols))
  if (typeof state.rows === 'number' && Number.isFinite(state.rows)) normalized.rows = Math.max(1, Math.round(state.rows))
  if (typeof state.outputVersion === 'number' && Number.isFinite(state.outputVersion)) {
    normalized.outputVersion = Math.max(0, Math.round(state.outputVersion))
  }
  if (typeof state.terminalBuffer === 'string') normalized.terminalBuffer = state.terminalBuffer
  const logTail = normalizeList(state.logTail)
  if (logTail.length > 0) normalized.logTail = logTail
  return normalized
}

function stableRuntimeKey(runtime: AgentRuntimeBinding): string {
  return JSON.stringify(runtime)
}

export function defaultDewDropSessionPolicy(): DewDropSessionPolicy {
  return normalizeSessionPolicy(undefined)
}

export function defaultTerminalRuntime(cardId: string, title: string): AgentRuntimeBinding {
  const slug = slugToken(title, cardId)
  return {
    kind: 'terminal',
    profile: 'custom',
    transport: 'cli',
    instanceLabel: slug,
    command: DEFAULT_TERMINAL_COMMAND,
    workspaceRoot: DEFAULT_TERMINAL_ROOT,
    sessionPolicy: defaultDewDropSessionPolicy(),
  }
}

export function defaultOpenClawRuntime(cardId: string, title: string): AgentRuntimeBinding {
  return defaultTerminalRuntime(cardId, title)
}

export function defaultRuntimeForProfile(
  cardId: string,
  title: string,
  profile: AgentRuntimeProfile,
): AgentRuntimeBinding {
  const base = defaultTerminalRuntime(cardId, title)
  const visibleProfile = pickerRuntimeProfile(profile)
  if (visibleProfile === 'custom') return base
  const modelTag = defaultModelTagForRuntimeProfile(visibleProfile)
  return {
    ...base,
    profile: visibleProfile,
    modelTag,
    command: defaultCommandForRuntimeProfile(visibleProfile, { modelTag }),
  }
}

export function pickerRuntimeProfile(profile: AgentRuntimeProfile | undefined): AgentRuntimeProfile {
  if (!profile || profile === 'openclaw' || profile === 'paperclip') {
    return 'custom'
  }
  return profile
}

export function runtimeProfileLabel(profile: AgentRuntimeProfile | undefined): string {
  const visible = pickerRuntimeProfile(profile)
  return DEWDROP_RUNTIME_PROFILE_OPTIONS.find((option) => option.value === visible)?.label ?? 'Shell'
}

export function normalizeAgentRuntime(
  runtime: AgentRuntimeBinding | RuntimeLike | undefined,
  fallback: { cardId: string; title: string },
): AgentRuntimeBinding {
  const base = defaultTerminalRuntime(fallback.cardId, fallback.title)
  const normalized = runtime as RuntimeLike | undefined
  const inferredProfile = inferProfile(normalized, base.profile)
  const kind = inferKind(normalized, base.kind)
  const explicitCommand =
    typeof normalized?.command === 'string' && normalized.command.trim()
      ? normalized.command.trim()
      : undefined
  const modelTag =
    inferredProfile === 'ollama'
      ? normalizeModelTag(
          typeof normalized?.modelTag === 'string'
            ? normalized.modelTag
            : inferOllamaModelTag(explicitCommand) ?? defaultModelTagForRuntimeProfile('ollama'),
        )
      : undefined
  const terminalEnvelope = normalizeTerminalEnvelope(kind, inferredProfile, modelTag, explicitCommand)
  const profile = terminalEnvelope.profile
  const normalizedModelTag = terminalEnvelope.modelTag
  const transport = isRuntimeTransport(normalized?.transport) ? normalized.transport : kind === 'terminal' ? 'cli' : 'api'
  const instanceLabel =
    typeof normalized?.instanceLabel === 'string' && normalized.instanceLabel.trim()
      ? normalized.instanceLabel.trim()
      : base.instanceLabel
  const defaultRuntimeCommand = defaultCommandForRuntimeProfile(profile, { modelTag: normalizedModelTag })
  const command = terminalEnvelope.command ?? (kind === 'terminal' ? defaultRuntimeCommand : undefined)
  const vpnAlias =
    typeof normalized?.vpnAlias === 'string' && normalized.vpnAlias.trim()
      ? normalized.vpnAlias.trim()
      : kind === 'terminal'
        ? base.vpnAlias
        : undefined
  const workspaceRoot =
    typeof normalized?.workspaceRoot === 'string' && normalized.workspaceRoot.trim()
      ? normalized.workspaceRoot.trim()
      : undefined
  const sessionPolicy =
    kind === 'terminal' || normalized?.sessionPolicy
      ? normalizeSessionPolicy(normalized?.sessionPolicy)
      : undefined
  const sessionState = normalizeSessionState(normalized?.sessionState)

  return {
    kind,
    profile,
    transport,
    instanceLabel,
    modelTag: normalizedModelTag,
    command,
    vpnAlias,
    workspaceRoot,
    sessionPolicy,
    sessionState,
  }
}

export function normalizeAgentRuntimeCard(card: WorkflowCard): WorkflowCard {
  if (card.kind !== 'agent') return card
  const agentRuntime = normalizeAgentRuntime(card.agentRuntime, {
    cardId: card.id,
    title: card.title,
  })
  const current = card.agentRuntime
    ? normalizeAgentRuntime(card.agentRuntime, {
        cardId: card.id,
        title: card.title,
      })
    : undefined
  if (current && stableRuntimeKey(current) === stableRuntimeKey(agentRuntime)) {
    return card
  }
  return { ...card, agentRuntime }
}

export function agentRunsInCliTerminal(card: WorkflowCard): boolean {
  if (card.kind !== 'agent') return false
  const runtime = normalizeAgentRuntime(card.agentRuntime, {
    cardId: card.id,
    title: card.title,
  })
  return runtime.kind === 'terminal' && runtime.transport === 'cli' && !!runtime.instanceLabel && !!runtime.command
}

export function describeAgentRuntime(card: WorkflowCard): string {
  if (card.kind !== 'agent') return 'n/a'
  const runtime = normalizeAgentRuntime(card.agentRuntime, {
    cardId: card.id,
    title: card.title,
  })
  const root = runtime.workspaceRoot?.trim() || DEFAULT_TERMINAL_ROOT
  const host = runtime.vpnAlias?.trim()
  const profile =
    runtime.profile === 'custom'
      ? 'shell'
      : runtime.profile === 'ollama' && runtime.modelTag
        ? `${runtime.profile}:${runtime.modelTag}`
        : runtime.profile
  return host ? `${profile} via ${host} in ${root}` : `${profile} in ${root}`
}

export function describeAgentSessionPolicy(runtime: AgentRuntimeBinding): string {
  const policy = runtime.sessionPolicy
  if (!policy) return 'no explicit session policy'
  const network = policy.allowNetwork ? 'network on' : 'network off'
  const maxSteps = policy.maxSteps ? `${policy.maxSteps} steps` : 'unbounded steps'
  const maxRuntime = policy.maxRuntimeMs ? `${Math.round(policy.maxRuntimeMs / 60000)}m runtime` : 'no timeout'
  const approvals =
    policy.requiresApprovalFor && policy.requiresApprovalFor.length > 0
      ? `approvals: ${policy.requiresApprovalFor.join(', ')}`
      : 'no approval gates'
  return `${network}, ${maxSteps}, ${maxRuntime}, ${approvals}`
}

export function updateAgentRuntimeSessionState(
  runtime: AgentRuntimeBinding,
  sessionState: DewDropSessionState | undefined,
): AgentRuntimeBinding {
  const normalizedSessionState = normalizeSessionState(sessionState)
  const current = runtime.sessionState ? JSON.stringify(runtime.sessionState) : ''
  const next = normalizedSessionState ? JSON.stringify(normalizedSessionState) : ''
  if (current === next) return runtime
  return {
    ...runtime,
    sessionState: normalizedSessionState,
  }
}
