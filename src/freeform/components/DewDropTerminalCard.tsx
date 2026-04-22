import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import {
  DEWDROP_RUNTIME_PROFILE_OPTIONS,
  defaultCommandForRuntimeProfile,
  defaultModelTagForRuntimeProfile,
  pickerRuntimeProfile,
  runtimeProfileLabel,
} from '../agentRuntime'
import { buildDewDropBootstrapPlan, dewDropRouteLabel } from '../dewdropBootstrap'
import {
  type DewDropHostStatus,
  describeDewDropHostStatus,
  getDewDropHost,
  listDewDropHostSuggestions,
} from '../dewdropHosts'
import type { AgentRuntimeBinding, DewDropSessionStatus, WorkflowCard } from '../types'

type DewDropTerminalCardProps = {
  agent: WorkflowCard
  onTitleChange?: (agentId: string, title: string) => void
  onRuntimeChange: (agentId: string, patch: Partial<AgentRuntimeBinding>) => void
  onStart: (agentId: string) => void
  onStop: (agentId: string) => void
  onRefresh: (agentId: string) => void
  onSendInput?: (agentId: string, input: string) => void
  onReturnArtifact?: (agentId: string) => void
  onCheckHost?: (agentId: string, hostAlias: string) => void
  onRelayClipboard?: (agentId: string) => void
  onCopyShell?: (agentId: string, command: string) => void
  onCopyBootstrap?: (agentId: string, bootstrapText: string) => void
  hostStatusOverride?: DewDropHostStatus
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
  onReturnArtifact,
  onCheckHost,
  onRelayClipboard,
  onCopyShell,
  onCopyBootstrap,
  hostStatusOverride,
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
  const runtimeProfile = pickerRuntimeProfile(runtime?.profile)
  const shellCommand = runtime?.command ?? 'zsh -i -f'
  const workspaceRoot = runtime?.workspaceRoot ?? '.'
  const hostAlias = runtime?.vpnAlias ?? ''
  const modelTag = runtime?.modelTag ?? defaultModelTagForRuntimeProfile(runtimeProfile) ?? ''
  const sessionId = runtime?.sessionState?.sessionId ?? null
  const routeLabel = dewDropRouteLabel(runtime)
  const bootstrapPlan = buildDewDropBootstrapPlan(runtime)
  const hostStatus = hostStatusOverride ?? describeDewDropHostStatus(runtime)
  const hostRecord = getDewDropHost(hostAlias)
  const hostSuggestions = listDewDropHostSuggestions(runtime)
  const quickHostSuggestions = runtimeProfile === 'ollama' ? hostSuggestions.slice(0, 2) : []
  const hostListId = `${agent.id}-host-suggestions`
  const hostInputId = `${agent.id}-host`
  const modelInputId = `${agent.id}-model-tag`
  const bootstrapText = bootstrapPlan?.commands.join('\n') ?? ''
  const shouldAdoptHostRoot =
    !runtime?.workspaceRoot ||
    runtime.workspaceRoot === '.' ||
    (!!hostRecord?.defaultWorkspaceRoot && runtime.workspaceRoot === hostRecord.defaultWorkspaceRoot)

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
          <span>Runtime</span>
          <select
            aria-label="Runtime"
            value={runtimeProfile}
            onChange={(event: ChangeEvent<HTMLSelectElement>) => {
              const profile = event.target.value as typeof runtimeProfile
              const nextModelTag = defaultModelTagForRuntimeProfile(profile)
              onRuntimeChange(agent.id, {
                profile,
                modelTag: nextModelTag,
                command: defaultCommandForRuntimeProfile(profile, { modelTag: nextModelTag }),
              })
            }}
          >
            {DEWDROP_RUNTIME_PROFILE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
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
        {runtimeProfile === 'ollama' ? (
          <label className="freeform-field" htmlFor={modelInputId}>
            <span>Model</span>
            <input
              id={modelInputId}
              aria-label="Model"
              type="text"
              value={modelTag}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                onRuntimeChange(agent.id, { modelTag: event.target.value })
              }
              placeholder={defaultModelTagForRuntimeProfile('ollama')}
            />
          </label>
        ) : null}
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
        <label className="freeform-field" htmlFor={hostInputId}>
          <span>Host</span>
          <input
            id={hostInputId}
            aria-label="Host"
            list={hostListId}
            type="text"
            value={hostAlias}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              onRuntimeChange(agent.id, {
                vpnAlias: event.target.value,
                workspaceRoot:
                  !event.target.value.trim() && shouldAdoptHostRoot
                    ? '.'
                    : event.target.value.trim() && shouldAdoptHostRoot
                      ? getDewDropHost(event.target.value)?.defaultWorkspaceRoot ?? runtime?.workspaceRoot
                      : runtime?.workspaceRoot,
              })
            }
            placeholder="local or vpn host"
          />
          <datalist id={hostListId}>
            {hostSuggestions.map((host) => (
              <option key={host.value} value={host.value}>
                {host.label}
              </option>
            ))}
          </datalist>
        </label>
      </div>
      {runtimeProfile === 'ollama' ? (
        <>
          <div className="freeform-toolbar-panel-actions">
            <button
              type="button"
              className="freeform-btn freeform-btn--tool"
              onClick={() =>
                onRuntimeChange(agent.id, {
                  vpnAlias: undefined,
                  workspaceRoot: shouldAdoptHostRoot ? '.' : runtime?.workspaceRoot,
                })
              }
              disabled={busy || !hostAlias.trim()}
            >
              Local machine
            </button>
            {quickHostSuggestions.map((host) => (
              <button
                key={host.value}
                type="button"
                className="freeform-btn freeform-btn--tool"
                onClick={() =>
                  onRuntimeChange(agent.id, {
                    vpnAlias: host.value,
                    workspaceRoot:
                      shouldAdoptHostRoot
                        ? getDewDropHost(host.value)?.defaultWorkspaceRoot ?? runtime?.workspaceRoot
                        : runtime.workspaceRoot,
                  })
                }
                disabled={busy || hostAlias.trim() === host.value}
              >
                {host.label}
              </button>
            ))}
          </div>
          <p className="freeform-toolbar-panel-hint">
            Model tags are structured now. The shell stays aligned with the model until you customize the command by hand.
          </p>
        </>
      ) : null}

      <p className="freeform-toolbar-panel-hint">
        {runtime?.sessionState?.sessionId
          ? `Session ${runtime.sessionState.sessionId.slice(-6)}${hostAlias.trim() ? ` via ${hostAlias.trim()}` : ''}`
          : hostAlias.trim()
            ? `${runtimeProfileLabel(runtime?.profile)} will boot through ${hostAlias.trim()}.`
            : `${runtimeProfileLabel(runtime?.profile)} will boot on first render.`}
      </p>
      <p className="freeform-toolbar-panel-hint">Route: {routeLabel}</p>
      <p className="freeform-toolbar-panel-hint">
        Host status: <strong>{hostStatus.label}</strong>
        {' '}
        {hostStatus.detail}
      </p>
      {hostRecord ? (
        <p className="freeform-toolbar-panel-hint">
          Host profile: {hostRecord.label} • {hostRecord.role} • {hostRecord.summary}
        </p>
      ) : null}

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
        {onReturnArtifact ? (
          <button
            type="button"
            className="freeform-btn freeform-btn--tool"
            onClick={() => onReturnArtifact(agent.id)}
            disabled={busy || !sessionId}
          >
            Return artifact
          </button>
        ) : null}
      </div>

      <div className="freeform-toolbar-panel-actions">
        {onCheckHost && hostAlias.trim() ? (
          <button
            type="button"
            className="freeform-btn freeform-btn--tool"
            onClick={() => onCheckHost(agent.id, hostAlias.trim())}
            disabled={busy}
          >
            Check host
          </button>
        ) : null}
        {onCopyShell ? (
          <button
            type="button"
            className="freeform-btn freeform-btn--tool"
            onClick={() => onCopyShell(agent.id, shellCommand)}
            disabled={busy}
          >
            Copy shell
          </button>
        ) : null}
        {bootstrapText && onCopyBootstrap ? (
          <button
            type="button"
            className="freeform-btn freeform-btn--tool"
            onClick={() => onCopyBootstrap(agent.id, bootstrapText)}
            disabled={busy}
          >
            Copy bootstrap
          </button>
        ) : null}
        {onRelayClipboard ? (
          <button
            type="button"
            className="freeform-btn freeform-btn--tool"
            onClick={() => onRelayClipboard(agent.id)}
            disabled={busy || !canSendInput}
          >
            Relay clipboard
          </button>
        ) : null}
      </div>
      {onRelayClipboard ? (
        <p className="freeform-toolbar-panel-hint">
          Clipboard relay reads the current clipboard once and sends it straight into the live DewDrop without storing it in board state.
        </p>
      ) : null}

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

      {bootstrapPlan ? (
        <div className="freeform-packet-list">
          <p className="freeform-toolbar-panel-hint">
            <strong>{bootstrapPlan.title}</strong>
            {' '}
            {bootstrapPlan.summary}
          </p>
          <pre className="freeform-terminal-log">{bootstrapPlan.commands.join('\n')}</pre>
          {bootstrapPlan.notes.map((note) => (
            <p key={note} className="freeform-toolbar-panel-hint">
              {note}
            </p>
          ))}
        </div>
      ) : null}
    </article>
  )
}
