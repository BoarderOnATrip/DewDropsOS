import { useCallback, useEffect, useRef } from 'react'
import { FitAddon } from '@xterm/addon-fit'
import { Terminal } from '@xterm/xterm'
import '@xterm/xterm/css/xterm.css'
import type { DewDropSessionStatus, WorkflowCard } from '../types'

type DewDropTerminalSurfaceProps = {
  agent: WorkflowCard
  busy?: boolean
  onStart: (agentId: string) => void
  onStop: (agentId: string) => void
  onRefresh: (agentId: string) => void
  onSendInput?: (agentId: string, input: string) => void | Promise<void>
  onResizeSession?: (agentId: string, sessionId: string, cols: number, rows: number) => void | Promise<void>
}

function statusTone(status: DewDropSessionStatus | undefined): 'ready' | 'attention' | 'missing' {
  if (status === 'running' || status === 'done') return 'ready'
  if (status === 'failed' || status === 'killed') return 'missing'
  return 'attention'
}

function statusLabel(status: DewDropSessionStatus | undefined): string {
  return status || 'idle'
}

function isJsdomRuntime(): boolean {
  if (typeof process !== 'undefined' && process.env.VITEST) return true
  return typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent)
}

export function DewDropTerminalSurface({
  agent,
  busy = false,
  onStart,
  onStop,
  onRefresh,
  onSendInput,
  onResizeSession,
}: DewDropTerminalSurfaceProps) {
  const surfaceRef = useRef<HTMLElement | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const hostRef = useRef<HTMLDivElement | null>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const lastBufferRef = useRef('')
  const lastOutputVersionRef = useRef<number>(-1)
  const lastResizeSignatureRef = useRef('')
  const flushTimerRef = useRef<number | null>(null)
  const focusTimerRef = useRef<number | null>(null)
  const queuedInputRef = useRef('')
  const flushingInputRef = useRef(false)
  const runtime = agent.agentRuntime
  const sessionState = runtime?.sessionState
  const sessionId = sessionState?.sessionId
  const terminalBuffer = sessionState?.terminalBuffer ?? ''
  const outputVersion = sessionState?.outputVersion ?? 0
  const status = statusLabel(sessionState?.status)
  const tone = statusTone(sessionState?.status)
  const shellCommand = runtime?.command ?? 'zsh -i -f'
  const workspaceRoot = runtime?.workspaceRoot ?? '.'
  const canStop = ['starting', 'running', 'blocked'].includes(sessionState?.status ?? '')
  const canRefresh = !!sessionId
  const canType = !!sessionId && ['running', 'blocked'].includes(sessionState?.status ?? '')

  const focusInput = useCallback(() => {
    if (!canType) return
    if (focusTimerRef.current !== null) {
      window.clearTimeout(focusTimerRef.current)
    }
    focusTimerRef.current = window.setTimeout(() => {
      focusTimerRef.current = null
      inputRef.current?.focus()
    }, 0)
  }, [canType])

  const enqueueInput = (data: string) => {
    if (!canType || !onSendInput || !data) return
    queuedInputRef.current += data
    if (flushTimerRef.current !== null) return
    flushTimerRef.current = window.setTimeout(() => {
      flushTimerRef.current = null
      const flush = () => {
        if (!onSendInput || !queuedInputRef.current || flushingInputRef.current) return
        const nextInput = queuedInputRef.current
        queuedInputRef.current = ''
        flushingInputRef.current = true
        Promise.resolve(onSendInput(agent.id, nextInput)).finally(() => {
          flushingInputRef.current = false
          if (queuedInputRef.current) flush()
        })
      }
      flush()
    }, 12)
  }

  useEffect(() => {
    if (isJsdomRuntime() || !hostRef.current) return

    const terminal = new Terminal({
      convertEol: false,
      cursorBlink: true,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
      fontSize: 13,
      lineHeight: 1.2,
      scrollback: 4000,
      theme: {
        background: '#060b12',
        foreground: '#dff7e8',
        cursor: '#7ee787',
        cursorAccent: '#060b12',
        black: '#060b12',
        brightBlack: '#3a4658',
        red: '#ff7b72',
        brightRed: '#ffa198',
        green: '#7ee787',
        brightGreen: '#56d364',
        yellow: '#e3b341',
        brightYellow: '#f2cc60',
        blue: '#79c0ff',
        brightBlue: '#a5d6ff',
        magenta: '#d2a8ff',
        brightMagenta: '#e2c5ff',
        cyan: '#39c5cf',
        brightCyan: '#56d4dd',
        white: '#d0d7de',
        brightWhite: '#f0f6fc',
      },
    })
    const fitAddon = new FitAddon()
    terminal.loadAddon(fitAddon)
    terminal.open(hostRef.current)
    terminalRef.current = terminal
    fitAddonRef.current = fitAddon

    const frame = window.requestAnimationFrame(() => {
      fitAddon.fit()
      focusInput()
    })

    return () => {
      if (focusTimerRef.current !== null) {
        window.clearTimeout(focusTimerRef.current)
        focusTimerRef.current = null
      }
      if (flushTimerRef.current !== null) {
        window.clearTimeout(flushTimerRef.current)
        flushTimerRef.current = null
      }
      window.cancelAnimationFrame(frame)
      fitAddon.dispose()
      terminal.dispose()
      terminalRef.current = null
      fitAddonRef.current = null
      lastBufferRef.current = ''
      lastOutputVersionRef.current = -1
      lastResizeSignatureRef.current = ''
    }
  }, [agent.id, focusInput])

  useEffect(() => {
    if (!canType) return
    focusInput()
  }, [canType, focusInput, sessionId])

  useEffect(() => {
    const terminal = terminalRef.current
    if (!terminal) return
    if (lastOutputVersionRef.current === outputVersion && lastBufferRef.current === terminalBuffer) return

    if (terminalBuffer.startsWith(lastBufferRef.current)) {
      const delta = terminalBuffer.slice(lastBufferRef.current.length)
      if (delta) terminal.write(delta)
    } else {
      terminal.reset()
      if (terminalBuffer) terminal.write(terminalBuffer)
    }

    lastOutputVersionRef.current = outputVersion
    lastBufferRef.current = terminalBuffer
  }, [outputVersion, terminalBuffer])

  useEffect(() => {
    if (isJsdomRuntime() || !hostRef.current || !terminalRef.current || !fitAddonRef.current) return

    const syncDimensions = () => {
      const fitAddon = fitAddonRef.current
      const terminal = terminalRef.current
      if (!fitAddon || !terminal) return
      fitAddon.fit()
      const proposed = fitAddon.proposeDimensions()
      const cols = proposed?.cols ?? terminal.cols
      const rows = proposed?.rows ?? terminal.rows
      if (!sessionId || !onResizeSession || cols <= 0 || rows <= 0) return
      const signature = `${sessionId}:${cols}x${rows}`
      if (lastResizeSignatureRef.current === signature) return
      lastResizeSignatureRef.current = signature
      void Promise.resolve(onResizeSession(agent.id, sessionId, cols, rows))
    }

    const observer = new ResizeObserver(() => syncDimensions())
    observer.observe(hostRef.current)
    const timer = window.setTimeout(syncDimensions, 0)
    return () => {
      observer.disconnect()
      window.clearTimeout(timer)
    }
  }, [agent.id, onResizeSession, sessionId])

  useEffect(() => {
    if (!sessionId) {
      lastResizeSignatureRef.current = ''
    }
  }, [sessionId])

  const sendControlKey = (key: string): string | null => {
    if (key === 'Enter') return '\n'
    if (key === 'Tab') return '\t'
    if (key === 'Backspace') return '\u007f'
    if (key === 'Escape') return '\u001b'
    if (key === 'ArrowUp') return '\u001b[A'
    if (key === 'ArrowDown') return '\u001b[B'
    if (key === 'ArrowRight') return '\u001b[C'
    if (key === 'ArrowLeft') return '\u001b[D'
    if (key === 'Delete') return '\u001b[3~'
    if (key === 'Home') return '\u001b[H'
    if (key === 'End') return '\u001b[F'
    return null
  }

  const sendCtrlChord = (key: string): string | null => {
    if (key.length !== 1) return null
    const lower = key.toLowerCase()
    if (lower < 'a' || lower > 'z') return null
    return String.fromCharCode(lower.charCodeAt(0) - 96)
  }

  return (
    <section
      ref={surfaceRef}
      className="freeform-terminal-surface"
      aria-label={`${agent.title} live terminal`}
      onPointerDown={(event) => {
        event.stopPropagation()
        focusInput()
      }}
      onClick={(event) => {
        event.stopPropagation()
        focusInput()
      }}
    >
      <div className="freeform-terminal-surface-head">
        <div className="freeform-terminal-surface-meta">
          <strong>{agent.title}</strong>
          <span className={`freeform-session-pill is-${tone}`}>{status}</span>
          <span className="freeform-terminal-chip">{shellCommand}</span>
          <span className="freeform-terminal-chip">{workspaceRoot}</span>
        </div>
        <div className="freeform-toolbar-panel-actions">
          <button
            type="button"
            className="freeform-btn freeform-btn--tool is-active"
            onClick={() => onStart(agent.id)}
            disabled={busy}
          >
            {busy ? 'Working…' : canStop ? 'Restart' : 'Start'}
          </button>
          <button
            type="button"
            className="freeform-btn freeform-btn--tool"
            onClick={() => onStop(agent.id)}
            disabled={busy || !canStop}
          >
            Stop
          </button>
          <button
            type="button"
            className="freeform-btn freeform-btn--tool"
            onClick={() => onRefresh(agent.id)}
            disabled={busy || !canRefresh}
          >
            Refresh
          </button>
        </div>
      </div>
      <div className="freeform-terminal-surface-stage">
        <textarea
          ref={inputRef}
          className="freeform-terminal-keytrap"
          aria-label={`${agent.title} terminal input`}
          value=""
          readOnly={!canType}
          onChange={() => undefined}
          onKeyDown={(event) => {
            if (!canType) return
            if (event.metaKey || event.altKey) return
            const controlPayload = event.ctrlKey ? sendCtrlChord(event.key) : null
            const payload =
              controlPayload ??
              sendControlKey(event.key) ??
              (!event.ctrlKey && event.key.length === 1 ? event.key : null)
            if (!payload) return
            event.preventDefault()
            event.stopPropagation()
            enqueueInput(payload)
          }}
          onPaste={(event) => {
            if (!canType) return
            const text = event.clipboardData.getData('text')
            if (!text) return
            event.preventDefault()
            event.stopPropagation()
            enqueueInput(text)
          }}
        />
        {isJsdomRuntime() ? (
          <pre className="freeform-terminal-log freeform-terminal-log--surface">
            {terminalBuffer || (sessionState?.logTail ?? []).join('\n') || 'Terminal idle.'}
          </pre>
        ) : (
          <div ref={hostRef} className="freeform-terminal-canvas" />
        )}
      </div>
      <p className="freeform-toolbar-panel-hint">
        {canType
          ? 'Type directly in the terminal surface.'
          : sessionId
            ? 'Session is not currently accepting input.'
            : 'Start the terminal and the DewDrop becomes a live shell.'}
      </p>
    </section>
  )
}
