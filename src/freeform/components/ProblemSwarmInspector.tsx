import type { ChangeEvent } from 'react'
import type {
  ButlerBridgeHealth,
  ButlerSwarmRun,
  ButlerSwarmRunReport,
  ButlerSwarmTemplate,
} from '../../lib/butlerBridge'
import { formatRunStatus, swarmRunIsActive } from '../runFormat'
import { SwarmRunList } from './SwarmRunList'

type TemplateOption = {
  value: ButlerSwarmTemplate
  label: string
}

type ProblemSwarmInspectorProps = {
  title: string
  agentCount: number
  roomId?: string
  lastRunId?: string
  bridgeHealth: ButlerBridgeHealth | null
  template: ButlerSwarmTemplate
  templateOptions: TemplateOption[]
  objective: string
  roomWidth: number
  roomHeight: number
  membranePad: number
  cardWidth: number
  runs: ButlerSwarmRun[]
  currentRunId?: string
  currentRunReport: ButlerSwarmRunReport | null
  reportBusy: boolean
  launchBusy: boolean
  stopBusy: boolean
  onTemplateChange: (value: ButlerSwarmTemplate) => void
  onObjectiveChange: (value: string) => void
  onRoomWidthChange: (value: number) => void
  onRoomHeightChange: (value: number) => void
  onMembranePadChange: (value: number) => void
  onCardWidthChange: (value: number) => void
  onLaunch: () => void
  onStopRun: () => void
  onRefreshRuns: () => void
  onSelectRun: (runId: string) => void
}

function reportPreview(content: string | undefined): string {
  const normalized = (content ?? '').replace(/\s+/g, ' ').trim()
  if (!normalized) return ''
  return normalized.length > 420 ? `${normalized.slice(0, 420)}…` : normalized
}

export function ProblemSwarmInspector({
  title,
  agentCount,
  roomId,
  lastRunId,
  bridgeHealth,
  template,
  templateOptions,
  objective,
  roomWidth,
  roomHeight,
  membranePad,
  cardWidth,
  runs,
  currentRunId,
  currentRunReport,
  reportBusy,
  launchBusy,
  stopBusy,
  onTemplateChange,
  onObjectiveChange,
  onRoomWidthChange,
  onRoomHeightChange,
  onMembranePadChange,
  onCardWidthChange,
  onLaunch,
  onStopRun,
  onRefreshRuns,
  onSelectRun,
}: ProblemSwarmInspectorProps) {
  const currentRun = runs.find((run) => run.id === currentRunId || run.run_id === currentRunId) ?? null
  const preview = reportPreview(currentRunReport?.content)
  const currentRunActive = swarmRunIsActive(currentRun?.status)

  return (
    <aside className="freeform-problem-inspector" aria-label="Selected problem swarm inspector">
      <div className="freeform-problem-inspector-header">
        <div>
          <h2>{title}</h2>
          <p>
            {agentCount} agent{agentCount === 1 ? '' : 's'} in this swarm room
            {roomId ? ` • ${roomId}` : ''}
          </p>
        </div>
        <div className="freeform-problem-inspector-status">
          <span className={`freeform-run-pill${bridgeHealth?.ok ? ' is-online' : ' is-offline'}`}>
            {bridgeHealth?.ok ? 'bridge online' : 'bridge offline'}
          </span>
          {lastRunId ? <span className="freeform-run-pill">last {lastRunId.slice(-6)}</span> : null}
        </div>
      </div>

      <div className="freeform-problem-inspector-grid">
        <label className="freeform-field">
          <span>Template</span>
          <select
            value={template}
            onChange={(e: ChangeEvent<HTMLSelectElement>) =>
              onTemplateChange(e.target.value as ButlerSwarmTemplate)
            }
            disabled={launchBusy}
          >
            {templateOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="freeform-field">
          <span>Room width</span>
          <input
            type="number"
            min={160}
            max={720}
            step={10}
            value={roomWidth}
            onChange={(e: ChangeEvent<HTMLInputElement>) => onRoomWidthChange(e.target.valueAsNumber || roomWidth)}
          />
        </label>

        <label className="freeform-field">
          <span>Room height</span>
          <input
            type="number"
            min={100}
            max={520}
            step={10}
            value={roomHeight}
            onChange={(e: ChangeEvent<HTMLInputElement>) => onRoomHeightChange(e.target.valueAsNumber || roomHeight)}
          />
        </label>

        <label className="freeform-field">
          <span>Membrane pad</span>
          <input
            type="number"
            min={0}
            max={120}
            step={4}
            value={membranePad}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              onMembranePadChange(e.target.valueAsNumber || membranePad)
            }
          />
        </label>

        <label className="freeform-field">
          <span>Card width</span>
          <input
            type="number"
            min={96}
            max={260}
            step={8}
            value={cardWidth}
            onChange={(e: ChangeEvent<HTMLInputElement>) => onCardWidthChange(e.target.valueAsNumber || cardWidth)}
          />
        </label>
      </div>

      <label className="freeform-field">
        <span>Objective</span>
        <textarea
          value={objective}
          onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onObjectiveChange(e.target.value)}
          placeholder="Describe what this swarm should do."
          rows={5}
          disabled={launchBusy}
        />
      </label>

      <div className="freeform-toolbar-panel-actions">
        <button
          type="button"
          className="freeform-btn freeform-btn--tool is-active"
          onClick={onLaunch}
          disabled={launchBusy || !objective.trim()}
        >
          {launchBusy ? 'Launching…' : 'Launch swarm'}
        </button>
        <button
          type="button"
          className="freeform-btn freeform-btn--tool"
          onClick={onRefreshRuns}
        >
          Refresh runs
        </button>
        {currentRunActive ? (
          <button
            type="button"
            className="freeform-btn freeform-btn--tool"
            onClick={onStopRun}
            disabled={stopBusy}
          >
            {stopBusy ? 'Stopping…' : 'Stop run'}
          </button>
        ) : null}
      </div>

      <div className="freeform-problem-inspector-section">
        <div className="freeform-toolbar-panel-problem">
          <div>
            <h3>Room runs</h3>
            <p>Latest swarm runs attached to this problem room.</p>
          </div>
          {currentRun ? (
            <span className={`freeform-run-pill${swarmRunIsActive(currentRun.status) ? ' is-active' : ''}`}>
              {formatRunStatus(currentRun.status)}
            </span>
          ) : null}
        </div>
        <SwarmRunList runs={runs} currentRunId={currentRunId} onSelectRun={onSelectRun} />
      </div>

      <div className="freeform-problem-inspector-section">
        <div className="freeform-toolbar-panel-problem">
          <div>
            <h3>Latest report</h3>
            <p>
              {currentRun
                ? `Readable output for ${currentRun.title}.`
                : 'Select a run to inspect its report.'}
            </p>
          </div>
          {reportBusy ? <span className="freeform-run-pill">loading</span> : null}
        </div>
        {preview ? (
          <p className="freeform-problem-inspector-report">{preview}</p>
        ) : (
          <p className="freeform-toolbar-panel-hint">
            {reportBusy ? 'Loading report…' : 'No report preview available yet.'}
          </p>
        )}
      </div>
    </aside>
  )
}
