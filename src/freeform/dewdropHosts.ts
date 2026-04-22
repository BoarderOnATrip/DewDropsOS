import { pickerRuntimeProfile } from './agentRuntime'
import type { AgentRuntimeBinding, AgentRuntimeProfile } from './types'

export type DewDropHostRoute = 'local' | 'vpn-ssh'
export type DewDropHostRole = 'general' | 'hermes' | 'browser' | 'gpu'
export type DewDropHostTone = 'ready' | 'attention' | 'missing'

export type DewDropHostRecord = {
  alias: string
  label: string
  route: DewDropHostRoute
  role: DewDropHostRole
  summary: string
  defaultWorkspaceRoot?: string
  supportedProfiles?: AgentRuntimeProfile[]
}

export type DewDropHostStatus = {
  tone: DewDropHostTone
  label: string
  detail: string
}

const DEWDROP_HOSTS: readonly DewDropHostRecord[] = [
  {
    alias: 'builder-01',
    label: 'Builder 01',
    route: 'vpn-ssh',
    role: 'hermes',
    summary: 'General Hermes worker node for coding, planning, and long-running tasks.',
    defaultWorkspaceRoot: '~/workspace',
    supportedProfiles: ['hermes', 'codex', 'claude-code', 'playwright', 'custom'],
  },
  {
    alias: 'browser-01',
    label: 'Browser 01',
    route: 'vpn-ssh',
    role: 'browser',
    summary: 'Browser worker node for Hermes browser tasks and Browser Harness sessions.',
    defaultWorkspaceRoot: '~/browser-work',
    supportedProfiles: ['hermes', 'browser-harness', 'browser-harness-js', 'playwright', 'custom'],
  },
  {
    alias: 'gpu-01',
    label: 'GPU 01',
    route: 'vpn-ssh',
    role: 'gpu',
    summary: 'Heavy compute node for render, model, and long-running media workloads.',
    defaultWorkspaceRoot: '~/compute',
    supportedProfiles: ['hermes', 'custom'],
  },
] as const

export function listDewDropHosts(): DewDropHostRecord[] {
  return [...DEWDROP_HOSTS]
}

export function getDewDropHost(alias: string | undefined): DewDropHostRecord | null {
  const normalized = alias?.trim()
  if (!normalized) return null
  return DEWDROP_HOSTS.find((host) => host.alias === normalized) ?? null
}

export function listDewDropHostSuggestions(
  runtime: AgentRuntimeBinding | undefined,
): Array<{ value: string; label: string; detail: string }> {
  const profile = runtime ? pickerRuntimeProfile(runtime.profile) : 'custom'
  return DEWDROP_HOSTS
    .filter((host) => {
      if (!host.supportedProfiles || host.supportedProfiles.length === 0) return true
      return host.supportedProfiles.includes(profile)
    })
    .map((host) => ({
      value: host.alias,
      label: host.label,
      detail: `${host.role} • ${host.summary}`,
    }))
}

export function describeDewDropHostStatus(
  runtime: AgentRuntimeBinding | undefined,
): DewDropHostStatus {
  const hostAlias = runtime?.vpnAlias?.trim()
  if (!hostAlias) {
    return {
      tone: 'ready',
      label: 'Local machine',
      detail: 'This DewDrop runs on the current machine unless you bind it to a remote host.',
    }
  }

  const host = getDewDropHost(hostAlias)
  if (!host) {
    return {
      tone: 'missing',
      label: 'Unknown host',
      detail: `Host "${hostAlias}" is not in the DewDrops registry yet.`,
    }
  }

  const activeSession = !!runtime?.sessionState?.sessionId
  return {
    tone: activeSession ? 'ready' : 'attention',
    label: activeSession ? `${host.label} live` : host.label,
    detail: `${host.role} node over ${host.route}. ${host.summary}`,
  }
}

export function summarizeDewDropHostBindings(
  runtimes: readonly AgentRuntimeBinding[],
): {
  tone: DewDropHostTone
  detail: string
} {
  if (runtimes.length === 0) {
    return {
      tone: 'attention',
      detail: 'No worker hosts are bound yet.',
    }
  }

  let unknownCount = 0
  let localCount = 0
  const labels = new Map<string, number>()

  for (const runtime of runtimes) {
    const hostAlias = runtime.vpnAlias?.trim()
    if (!hostAlias) {
      localCount += 1
      continue
    }
    const host = getDewDropHost(hostAlias)
    if (!host) {
      unknownCount += 1
      continue
    }
    labels.set(host.label, (labels.get(host.label) ?? 0) + 1)
  }

  if (unknownCount > 0) {
    return {
      tone: 'missing',
      detail: `${unknownCount} DewDrop${unknownCount === 1 ? '' : 's'} point to unknown host aliases.`,
    }
  }

  const parts: string[] = []
  if (localCount > 0) {
    parts.push(`${localCount} local`)
  }
  for (const [label, count] of labels.entries()) {
    parts.push(`${count} ${label}`)
  }

  return {
    tone: 'ready',
    detail: parts.length > 0 ? parts.join(', ') : 'All DewDrops are using known hosts.',
  }
}
