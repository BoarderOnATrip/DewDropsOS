import { defaultCommandForRuntimeProfile } from '../freeform/agentRuntime'
import type { AgentRuntimeBinding } from '../freeform/types'
import type { CreateRuntimeSessionInput } from './runtimeSessionTypes'

export type WorkerTerminalLaunchRoute = 'local' | 'vpn-ssh'

export type WorkerTerminalLaunchInput = {
  agentId: string
  title: string
  runtime: AgentRuntimeBinding
  workspaceId?: string
  problemId?: string
}

export type WorkerTerminalLaunchPlan = CreateRuntimeSessionInput & {
  route: WorkerTerminalLaunchRoute
}

function quotePosix(value: string): string {
  if (!value) return "''"
  return `'${value.replace(/'/g, `'\\''`)}'`
}

function runtimeCommand(runtime: AgentRuntimeBinding): string {
  const explicit = runtime.command?.trim()
  if (explicit) return explicit
  return defaultCommandForRuntimeProfile(runtime.profile) ?? 'zsh -i -f'
}

function remoteExecCommand(command: string, workspaceRoot?: string): string {
  const steps: string[] = []
  if (workspaceRoot?.trim()) {
    steps.push(`cd ${quotePosix(workspaceRoot.trim())}`)
  }
  steps.push(`exec ${command}`)
  return steps.join(' && ')
}

export function buildWorkerTerminalLaunchPlan(
  input: WorkerTerminalLaunchInput,
): WorkerTerminalLaunchPlan {
  const hostAlias = input.runtime.vpnAlias?.trim()
  const command = runtimeCommand(input.runtime)
  const env = {
    DEWDROPS_RUNTIME_KIND: input.runtime.kind,
    DEWDROPS_RUNTIME_PROFILE: input.runtime.profile,
    DEWDROPS_RUNTIME_TRANSPORT: input.runtime.transport,
    DEWDROPS_RUNTIME_VPN_ALIAS: hostAlias ?? '',
    DEWDROPS_RUNTIME_INSTANCE_LABEL: input.runtime.instanceLabel,
    DEWDROPS_RUNTIME_ROUTE: hostAlias ? 'vpn-ssh' : 'local',
  }

  if (!hostAlias) {
    return {
      route: 'local',
      label: input.title,
      command,
      cwd: input.runtime.workspaceRoot?.trim() || undefined,
      workspaceId: input.workspaceId?.trim() || undefined,
      problemId: input.problemId?.trim() || undefined,
      agentId: input.agentId,
      env,
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
  }

  return {
    route: 'vpn-ssh',
    label: input.title,
    command: `ssh ${hostAlias} :: ${command}`,
    launchFile: 'ssh',
    launchArgs: [
      '-tt',
      '-o',
      'BatchMode=yes',
      '-o',
      'StrictHostKeyChecking=accept-new',
      hostAlias,
      remoteExecCommand(command, input.runtime.workspaceRoot),
    ],
    workspaceId: input.workspaceId?.trim() || undefined,
    problemId: input.problemId?.trim() || undefined,
    agentId: input.agentId,
    env,
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
}
