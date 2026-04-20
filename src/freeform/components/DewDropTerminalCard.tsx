import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import type { AgentRuntimeBinding, DewDropSessionStatus, WorkflowCard } from '../types'

type DewDropTerminalCardProps = {
  agent: WorkflowCard
  onTitleChange?: (agentId: string, title: string) => void
  onRuntimeChange: (agentId: string, patch: Partial<AgentRuntimeBinding>) => void
  onStart: (agentId: string) => void
  onStop: (agentId: string) => void
  onRefresh: (agentId: string) => void
  onSendInput?: (agentId: string, input: string) => void
  busy?: boolean
  autoFocusInput?: boolean
}

function statusLabel(status: DewDropSessionStatus | undefined): string {
  if (!status) return 'idle'
  return status
}

function statusTone(status: DewDropSessionStatus | undefined): 'ready' | 'attention' | 'missing' {
  if (status === 'running' || status === 'done') return 'ready'
  if (status === 'failed' || status === 'killed') return 'missing'
  return 'attention'
}

export function DewDropTerminalCard({
  agent,
  onTitleChange,
  onRuntimeChange,
  onStart,
  onStop,
  onRefresh,
  onSendInput,
  busy = false,
  autoFocusInput = false,
}: DewDropTerminalCardProps) {
  const [draftInput, setDraftInput] = useState('')
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const focusedSessionIdRef = useRef<string | null>(null)
  const runtime = agent.agentRuntime
  const status = statusLabel(runtime?.sessionState?.status)
  const tone = statusTone(runtime?.sessionState?.status)
  const logTail = runtime?.sessionState?.logTail ?? []
  const canStop = ['starting', 'running', 'blocked'].includes(runtime?.sessionState?.status ?? '')
  const canRefresh = !!runtime?.sessionState?.sessionId
  const canSendInput =
    !!runtime?.sessionState?.sessionId && ['running', 'blocked'].includes(runtime?.sessionState?.status ?? '')
  const assignmentLabel = agent.parentAgentId ? 'Nested terminal.' : agent.assignedToProblemId ? 'Room terminal.' : 'Free terminal.'
  const startLabel = canStop ? 'Restart' : 'Start'
  const shellCommand = runtime?.command ?? 'zsh -i -f'
  const workspaceRoot = runtime?.workspaceRoot ?? '.'
  const sessionId = runtime?.sessionState?.sessionId ?? null

  useEffect(() => {
    if (!autoFocusInput || !canSendInput || !sessionId) return
    if (focusedSessionIdRef.current === sessionId) return
    inputRef.current?.focus()
    focusedSessionIdRef.current = sessionId
  }, [autoFocusInput, canSendInput, sessionId])

  return (
    <article className="freeform-run-list-item">
      <div className="freeform-run-list-head">
        <strong>{agent.title || 'Untitled DewDrop'}</strong>
        <span className={`freeform-session-pill is-${tone}`}>{status}</span>
      </div>
      <p>{assignmentLabel}</p>

      <div className="freeform-problem-inspector-grid">
        {onTitleChange ? (
          <label className="freeform-field">
            <span>Terminal label</span>
            <input
              type="text"
              value={agent.title}
              onChange={(event: ChangeEvent<HTMLInputElement>) => onTitleChange(agent.id, event.target.value)}
              placeholder="Builder"
            />
          </label>
        ) : null}
        <label className="freeform-field">
          <span>Shell</span>
          <input
            type="text"
            value={shellCommand}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              onRuntimeChange(agent.id, { command: event.target.value })
            }
            placeholder="zsh -i -f"
          />
        </label>
        <label className="freeform-field">
          <span>Root</span>
          <input
            type="text"
            value={workspaceRoot}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              onRuntimeChange(agent.id, { workspaceRoot: event.target.value })
            }
            placeholder="."
          />
        </label>
      </div>

      <p className="freeform-toolbar-panel-hint">
        {runtime?.sessionState?.sessionId
          ? `Session ${runtime.sessionState.sessionId.slice(-6)}`
          : 'Terminal will boot on first render.'}
      </p>

      <div className="freeform-toolbar-panel-actions">
        <button
          type="button"
          className="freeform-btn freeform-btn--tool is-active"
          onClick={() => onStart(agent.id)}
          disabled={busy}
        >
          {busy ? 'Working…' : startLabel}
        </button>
        <button
          type="button"
          className="freeform-btn freeform-btn--tool"
          onClick={() => onStop(agent.id)}
          disabled={busy || !canStop}
        >
          {busy ? 'Working…' : 'Stop'}
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

      {onSendInput ? (
        <>
          <label className="freeform-field">
            <span>Live input</span>
            <textarea
              ref={inputRef}
              value={draftInput}
              onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setDraftInput(event.target.value)}
              placeholder={'pwd\nnpm test'}
              rows={2}
              disabled={!canSendInput}
            />
          </label>
          <div className="freeform-toolbar-panel-actions">
            <button
              type="button"
              className="freeform-btn freeform-btn--tool is-active"
              onClick={() => {
                const nextInput = draftInput.trim()
                if (!nextInput) return
                onSendInput(agent.id, draftInput.endsWith('\n') ? draftInput : `${draftInput}\n`)
                setDraftInput('')
              }}
              disabled={busy || !canSendInput || !draftInput.trim()}
            >
              {busy ? 'Working…' : 'Send'}
            </button>
          </div>
          <p className="freeform-toolbar-panel-hint">
            {canSendInput
              ? 'Type directly into the live DewDrop session.'
              : 'Start the DewDrop to send live input into its terminal.'}
          </p>
        </>
      ) : null}

      <div className="freeform-packet-list">
        {logTail.length > 0 ? (
          <pre className="freeform-terminal-log">{logTail.join('\n')}</pre>
        ) : (
          <p className="freeform-toolbar-panel-hint">No recent logs.</p>
        )}
      </div>
    </article>
  )
}
