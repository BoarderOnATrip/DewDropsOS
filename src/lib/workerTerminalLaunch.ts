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

function dewdropArtifactDir(agentId: string): string {
  return `.dewdrops-artifacts/${agentId}`
}

function hasCliFlag(command: string, flag: string): boolean {
  const escapedFlag = flag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|\\s)${escapedFlag}(?:=|\\s|$)`).test(command)
}

function enhancePlaywrightCommand(command: string, artifactDir: string): string {
  let next = command
  const outputDir = `${artifactDir}/test-results`
  if (!hasCliFlag(next, '--output')) {
    next = `${next} --output ${outputDir}`
  }
  if (!hasCliFlag(next, '--reporter')) {
    next = `${next} --reporter=line,html,junit`
  }
  if (!hasCliFlag(next, '--trace')) {
    next = `${next} --trace=retain-on-failure`
  }
  return next
}

function runtimeCommand(runtime: AgentRuntimeBinding): string {
  const explicit = runtime.command?.trim()
  if (explicit) return explicit
  return defaultCommandForRuntimeProfile(runtime.profile, { modelTag: runtime.modelTag }) ?? 'zsh -i -f'
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
  const artifactDir = dewdropArtifactDir(input.agentId)
  const command =
    input.runtime.profile === 'playwright'
      ? enhancePlaywrightCommand(runtimeCommand(input.runtime), artifactDir)
      : runtimeCommand(input.runtime)
  const env = {
    DEWDROPS_RUNTIME_KIND: input.runtime.kind,
    DEWDROPS_RUNTIME_PROFILE: input.runtime.profile,
    DEWDROPS_RUNTIME_TRANSPORT: input.runtime.transport,
    DEWDROPS_RUNTIME_VPN_ALIAS: hostAlias ?? '',
    DEWDROPS_RUNTIME_INSTANCE_LABEL: input.runtime.instanceLabel,
    DEWDROPS_RUNTIME_ROUTE: hostAlias ? 'vpn-ssh' : 'local',
    DEWDROPS_RUNTIME_MODEL_TAG: input.runtime.modelTag?.trim() || '',
    DEWDROPS_ARTIFACT_DIR: artifactDir,
    DEWDROPS_PLAYWRIGHT_OUTPUT_DIR: `${artifactDir}/test-results`,
    PLAYWRIGHT_HTML_OUTPUT_DIR: `${artifactDir}/playwright-report`,
    PLAYWRIGHT_HTML_OPEN: 'never',
    PLAYWRIGHT_JUNIT_OUTPUT_FILE: `${artifactDir}/playwright-junit.xml`,
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
