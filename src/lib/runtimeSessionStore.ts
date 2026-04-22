import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { basename, resolve } from 'node:path'
import { spawn as ptySpawn, type IPty } from 'node-pty'
import type {
  CreateRuntimeSessionInput,
  RuntimeSessionArtifact,
  RuntimeBridgeHealth,
  RuntimeSessionRecord,
} from './runtimeSessionTypes'
import { listRuntimeArtifactsForSession, readRuntimeArtifactContentForSession } from './runtimeArtifacts'

const ANSI_ESCAPE_PATTERN = new RegExp(
  `${String.fromCharCode(27)}(?:[@-Z\\\\-_]|\\[[0-?]*[ -/]*[@-~])`,
  'g',
)

type InternalRuntimeSession = {
  record: RuntimeSessionRecord
  terminal: IPty | null
  process: ChildProcessWithoutNullStreams | null
  logTailLimit: number
  terminalBufferLimit: number
  stopping: boolean
  timeoutHandle: ReturnType<typeof setTimeout> | null
}

type LaunchSpec = {
  file: string
  args: string[]
}

function isoNow(): string {
  return new Date().toISOString()
}

function clampWhole(value: number | undefined, fallback: number, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, Math.round(value)))
}

function stripAnsi(input: string): string {
  return input.replace(ANSI_ESCAPE_PATTERN, '')
}

function normalizeLogLine(chunk: string, source?: 'stderr'): string[] {
  const text = stripAnsi(chunk)
  return text
    .split(/\r?\n/)
    .flatMap((line) => line.split('\r'))
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .map((line) => (source === 'stderr' ? `[stderr] ${line}` : line))
}

function pruneTail(tail: string[], limit: number): string[] {
  if (tail.length <= limit) return tail
  return tail.slice(tail.length - limit)
}

function pruneTerminalBuffer(buffer: string, limit: number): string {
  if (buffer.length <= limit) return buffer
  return buffer.slice(buffer.length - limit)
}

function snapshot(session: InternalRuntimeSession): RuntimeSessionRecord {
  return {
    ...session.record,
    logTail: [...session.record.logTail],
  }
}

function normalizeInputLines(input: string): string[] {
  return input
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .map((line) => `[stdin] ${line}`)
}

function tokenizeCommand(command: string): string[] {
  const matches = command.match(/"[^"]*"|'[^']*'|\S+/g) ?? []
  return matches.map((token) => {
    if (
      (token.startsWith('"') && token.endsWith('"')) ||
      (token.startsWith("'") && token.endsWith("'"))
    ) {
      return token.slice(1, -1)
    }
    return token
  })
}

function isShellLikeCommand(file: string): boolean {
  const name = basename(file)
  return ['zsh', 'bash', 'sh', 'fish'].includes(name)
}

function hasInteractiveShellFlag(args: readonly string[]): boolean {
  return args.some((arg) => arg === '-i' || /^-[^-]*i/.test(arg))
}

function hasShellCommandFlag(args: readonly string[]): boolean {
  return args.some((arg) => arg === '-c' || arg === '-s' || /^-[^-]*[cs]/.test(arg))
}

function resolveLaunchSpec(command: string): LaunchSpec {
  const tokens = tokenizeCommand(command)
  const [firstToken, ...rest] = tokens
  if (!firstToken) {
    throw new Error('A runtime session command is required.')
  }

  if (isShellLikeCommand(firstToken) && !hasInteractiveShellFlag(rest) && !hasShellCommandFlag(rest)) {
    return {
      file: firstToken,
      args: ['-i', ...rest],
    }
  }

  return {
    file: firstToken,
    args: rest,
  }
}

function resolveExplicitLaunch(file: string, args: readonly string[] | undefined): LaunchSpec {
  const nextFile = file.trim()
  if (!nextFile) {
    throw new Error('A runtime session launch file is required.')
  }
  const nextArgs = Array.isArray(args)
    ? args.filter((value): value is string => typeof value === 'string')
    : []
  return {
    file: nextFile,
    args: nextArgs,
  }
}

function appendTerminalOutput(
  session: InternalRuntimeSession,
  chunk: string,
  source?: 'stderr',
): void {
  session.record.terminalBuffer = pruneTerminalBuffer(
    `${session.record.terminalBuffer}${chunk}`,
    session.terminalBufferLimit,
  )
  session.record.outputVersion += 1
  const lines = normalizeLogLine(chunk, source)
  if (lines.length > 0) {
    session.record.logTail = pruneTail([...session.record.logTail, ...lines], session.logTailLimit)
  }
  session.record.updatedAt = isoNow()
}

function finalizeSession(
  session: InternalRuntimeSession,
  exitCode: number | null,
  signal: string | null,
): void {
  if (session.timeoutHandle) clearTimeout(session.timeoutHandle)
  session.record.exitCode = exitCode
  session.record.signal = signal
  session.record.endedAt = isoNow()
  session.record.updatedAt = isoNow()
  if (session.stopping) {
    session.record.status = 'killed'
  } else if (exitCode === 0) {
    session.record.status = 'done'
  } else {
    session.record.status = 'failed'
  }
  session.terminal = null
  session.process = null
}

export class RuntimeSessionStore {
  private readonly sessions = new Map<string, InternalRuntimeSession>()

  health(): RuntimeBridgeHealth {
    return {
      ok: true,
      service: 'dewdrops-runtime',
      version: '1',
      activeSessions: this.sessions.size,
    }
  }

  listSessions(filters?: { workspaceId?: string; problemId?: string; agentId?: string }): RuntimeSessionRecord[] {
    const sessions = [...this.sessions.values()]
      .filter((session) => {
        if (filters?.workspaceId && session.record.workspaceId !== filters.workspaceId) return false
        if (filters?.problemId && session.record.problemId !== filters.problemId) return false
        if (filters?.agentId && session.record.agentId !== filters.agentId) return false
        return true
      })
      .sort((a, b) => b.record.startedAt.localeCompare(a.record.startedAt))

    return sessions.map(snapshot)
  }

  getSession(sessionId: string): RuntimeSessionRecord | null {
    const session = this.sessions.get(sessionId)
    return session ? snapshot(session) : null
  }

  async listSessionArtifacts(sessionId: string): Promise<RuntimeSessionArtifact[]> {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error('Session not found.')
    }
    return listRuntimeArtifactsForSession(snapshot(session))
  }

  async readSessionArtifact(
    sessionId: string,
    artifactId: string,
  ): Promise<{ artifact: RuntimeSessionArtifact; body: Buffer }> {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error('Session not found.')
    }
    return readRuntimeArtifactContentForSession(snapshot(session), artifactId)
  }

  createSession(input: CreateRuntimeSessionInput): RuntimeSessionRecord {
    const command = input.command.trim()
    if (!command) {
      throw new Error('A runtime session command is required.')
    }
    const launch =
      typeof input.launchFile === 'string' && input.launchFile.trim()
        ? resolveExplicitLaunch(input.launchFile, input.launchArgs)
        : resolveLaunchSpec(command)

    const id = randomUUID()
    const startedAt = isoNow()
    const cwd = resolve(input.cwd?.trim() || process.cwd())
    const cols = clampWhole(input.cols, 120, 20, 320)
    const rows = clampWhole(input.rows, 36, 8, 160)
    const env = {
      ...globalThis.process.env,
      ...input.env,
      TERM: 'xterm-256color',
      DEWDROPS_RUNTIME_SESSION_ID: id,
      DEWDROPS_RUNTIME_SESSION_LABEL: input.label.trim() || id,
      DEWDROPS_RUNTIME_AGENT_ID: input.agentId?.trim() || '',
      DEWDROPS_RUNTIME_PROBLEM_ID: input.problemId?.trim() || '',
      DEWDROPS_RUNTIME_WORKSPACE_ID: input.workspaceId?.trim() || '',
    }
    const session: InternalRuntimeSession = {
      record: {
        id,
        label: input.label.trim() || id,
        command,
        launchFile: launch.file,
        launchArgs: [...launch.args],
        cwd,
        workspaceId: input.workspaceId?.trim() || undefined,
        problemId: input.problemId?.trim() || undefined,
        agentId: input.agentId?.trim() || undefined,
        status: 'starting',
        pid: undefined,
        startedAt,
        updatedAt: startedAt,
        endedAt: undefined,
        exitCode: undefined,
        signal: undefined,
        cols,
        rows,
        outputVersion: 0,
        terminalBuffer: '',
        logTail: [],
        env: input.env,
        sessionPolicy: input.sessionPolicy,
      },
      terminal: null,
      process: null,
      logTailLimit: Math.max(40, Math.round(input.logTailLimit ?? 200)),
      terminalBufferLimit: 120_000,
      stopping: false,
      timeoutHandle: null,
    }
    this.sessions.set(id, session)

    if (
      typeof input.sessionPolicy?.maxRuntimeMs === 'number' &&
      Number.isFinite(input.sessionPolicy.maxRuntimeMs) &&
      input.sessionPolicy.maxRuntimeMs > 0
    ) {
      session.timeoutHandle = setTimeout(() => {
        session.record.logTail = pruneTail(
          [...session.record.logTail, '[stderr] max runtime reached'],
          session.logTailLimit,
        )
        session.record.updatedAt = isoNow()
        this.killSession(id)
      }, input.sessionPolicy.maxRuntimeMs)
    }

    const attachProcess = (child: ChildProcessWithoutNullStreams): RuntimeSessionRecord => {
      session.process = child
      session.record.pid = child.pid ?? undefined
      session.record.status = 'running'
      session.record.updatedAt = isoNow()

      child.stdout.on('data', (chunk: Buffer | string) => appendTerminalOutput(session, chunk.toString()))
      child.stderr.on('data', (chunk: Buffer | string) =>
        appendTerminalOutput(session, chunk.toString(), 'stderr'),
      )

      child.on('error', (childError) => {
        session.record.logTail = pruneTail(
          [...session.record.logTail, `[stderr] ${childError.message}`],
          session.logTailLimit,
        )
        finalizeSession(session, null, null)
      })

      child.on('exit', (exitCode, signal) => {
        finalizeSession(session, exitCode, signal)
      })

      return snapshot(session)
    }

    const startPtySession = (): RuntimeSessionRecord => {
      const terminal = ptySpawn(launch.file, launch.args, {
        name: 'xterm-256color',
        cols,
        rows,
        cwd,
        env,
        encoding: 'utf8',
      })
      session.terminal = terminal
      session.record.pid = terminal.pid
      session.record.status = 'running'
      session.record.updatedAt = isoNow()

      terminal.onData((data) => appendTerminalOutput(session, data))
      terminal.onExit(({ exitCode, signal }) => {
        finalizeSession(session, exitCode, signal === undefined ? null : String(signal))
      })
      return snapshot(session)
    }

    const startPipeSession = (): RuntimeSessionRecord => {
      const child = spawn(launch.file, launch.args, {
        cwd,
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
      })
      return attachProcess(child)
    }

    try {
      return startPtySession()
    } catch (primaryError) {
      try {
        return startPipeSession()
      } catch (fallbackError) {
        session.record.status = 'failed'
        session.record.endedAt = isoNow()
        session.record.updatedAt = isoNow()
        session.record.exitCode = null
        session.record.signal = null
        session.record.logTail = pruneTail(
          [
            ...session.record.logTail,
            `[stderr] ${primaryError instanceof Error ? primaryError.message : 'Could not start terminal session.'}`,
            `[stderr] ${
              fallbackError instanceof Error ? fallbackError.message : 'Could not start fallback terminal backend.'
            }`,
          ],
          session.logTailLimit,
        )
        this.sessions.set(id, session)
        return snapshot(session)
      }
    }
  }

  resizeSession(sessionId: string, cols: number, rows: number): RuntimeSessionRecord {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error('Session not found.')
    }

    const nextCols = clampWhole(cols, session.record.cols ?? 120, 20, 320)
    const nextRows = clampWhole(rows, session.record.rows ?? 36, 8, 160)
    session.record.cols = nextCols
    session.record.rows = nextRows
    session.record.updatedAt = isoNow()

    if (session.terminal) {
      session.terminal.resize(nextCols, nextRows)
    }

    return snapshot(session)
  }

  killSession(sessionId: string): RuntimeSessionRecord | null {
    const session = this.sessions.get(sessionId)
    if (!session) return null

    if ((session.terminal || session.process) && session.record.status === 'running') {
      session.stopping = true
      session.record.status = 'killed'
      session.record.updatedAt = isoNow()
      if (session.timeoutHandle) clearTimeout(session.timeoutHandle)
      try {
        if (session.terminal) {
          session.terminal.kill('SIGTERM')
        } else {
          session.process?.kill('SIGTERM')
        }
      } catch {
        try {
          if (session.terminal) {
            session.terminal.kill()
          } else {
            session.process?.kill('SIGKILL')
          }
        } catch {
          // Ignore kill errors; the process may already be gone.
        }
      }
      session.record.logTail = pruneTail([...session.record.logTail, '[stderr] kill requested'], session.logTailLimit)
      return snapshot(session)
    }

    if (session.record.status === 'starting') {
      session.stopping = true
      session.record.status = 'killed'
      session.record.updatedAt = isoNow()
      session.record.endedAt = isoNow()
      if (session.timeoutHandle) clearTimeout(session.timeoutHandle)
      return snapshot(session)
    }

    return snapshot(session)
  }

  writeSessionInput(sessionId: string, input: string): RuntimeSessionRecord {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error('Session not found.')
    }

    const nextInput = input.replace(/\r\n/g, '\n')
    if (!nextInput) {
      throw new Error('Runtime input is required.')
    }

    if ((!session.terminal && !session.process?.stdin) || !['running', 'blocked'].includes(session.record.status)) {
      throw new Error('Session is not accepting input.')
    }

    if (session.terminal) {
      session.terminal.write(nextInput)
    } else {
      session.process?.stdin.write(nextInput)
    }
    const lines = normalizeInputLines(nextInput)
    if (lines.length > 0) {
      session.record.logTail = pruneTail([...session.record.logTail, ...lines], session.logTailLimit)
    }
    session.record.updatedAt = isoNow()
    return snapshot(session)
  }
}
