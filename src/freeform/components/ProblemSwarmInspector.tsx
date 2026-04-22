import type { ChangeEvent } from 'react'
import type {
  ButlerBridgeHealth,
  ButlerSwarmRun,
  ButlerSwarmRunReport,
  ButlerSwarmTemplate,
} from '../../lib/butlerBridge'
import type { DewDropHostStatus } from '../dewdropHosts'
import type { BriefSpec } from '../briefSpec'
import type { BriefCompartmentOption } from '../briefCompartments'
import type { SessionReadinessItem, SessionReadinessTone } from '../sessionReadiness'
import type {
  ArtifactStatus,
  ButlerLaunchSurface,
  DewDropsWorkspaceMode,
  MemoryPalaceLocus,
  BriefCompartmentAsset,
  AgentRuntimeBinding,
  RunLedgerEntry,
  WorkflowCard,
} from '../types'
import { memoryPalaceKindLabel } from '../visualMemoryPalace'
import { formatRunStatus, swarmRunIsActive } from '../runFormat'
import { BriefEditor } from './BriefEditor'
import { CapabilityPackPicker, type CapabilityPackOption } from './CapabilityPackPicker'
import { CapabilityProfilePicker, type CapabilityProfileOption } from './CapabilityProfilePicker'
import { ContinuationDecisionPanel } from './ContinuationDecisionPanel'
import { BriefCompartmentIntakePanel } from './BriefCompartmentIntakePanel'
import { RunLedgerPanel } from './RunLedgerPanel'
import { SwarmRunList } from './SwarmRunList'
import { SwarmRecipePicker, type SwarmRecipeOption } from './SwarmRecipePicker'
import { DewDropTerminalCard } from './DewDropTerminalCard'
import { WorkerTerminalPanel } from './WorkerTerminalPanel'

type TemplateOption = {
  value: ButlerSwarmTemplate
  label: string
}

type Option<T extends string> = {
  value: T
  label: string
  detail: string
}

type ProblemSwarmInspectorProps = {
  title: string
  agentCount: number
  roomId?: string
  lastRunId?: string
  bridgeHealth: ButlerBridgeHealth | null
  workspaceMode: DewDropsWorkspaceMode
  workspaceOptions: Array<Option<DewDropsWorkspaceMode>>
  launchSurface: ButlerLaunchSurface
  capabilityPackId: string
  capabilityPackOptions: readonly CapabilityPackOption[]
  capabilityProfileId: string
  capabilityProfileOptions: readonly CapabilityProfileOption[]
  swarmRecipeId: string
  swarmRecipeOptions: readonly SwarmRecipeOption[]
  briefSpec: BriefSpec
  briefVersion: number
  launchSurfaceOptions: Array<Option<ButlerLaunchSurface>>
  template: ButlerSwarmTemplate
  templateOptions: TemplateOption[]
  objective: string
  roomWidth: number
  roomHeight: number
  membranePad: number
  cardWidth: number
  memoryWing: string
  memoryWingPlaceholder: string
  memoryRoom: string
  memoryRoomPlaceholder: string
  memorySummary: string
  memorySummaryPlaceholder: string
  memoryAnchors: string
  memoryPalaceDraft: string
  memoryPalaceLoci: MemoryPalaceLocus[]
  briefCompartmentAssets: readonly BriefCompartmentAsset[]
  briefCompartmentOptions: readonly BriefCompartmentOption[]
  selectedAgent: WorkflowCard | null
  workerAgents: readonly WorkflowCard[]
  onWorkerTerminalTitleChange: (agentId: string, title: string) => void
  onWorkerTerminalRuntimeChange: (agentId: string, patch: Partial<AgentRuntimeBinding>) => void
  onWorkerTerminalStart: (agentId: string) => void
  onWorkerTerminalStop: (agentId: string) => void
  onWorkerTerminalRefresh: (agentId: string) => void
  onWorkerTerminalSendInput: (agentId: string, input: string) => void
  onWorkerTerminalCheckHost: (agentId: string, hostAlias: string) => void
  onWorkerTerminalRelayClipboard: (agentId: string) => void
  onWorkerTerminalCopyShell: (agentId: string, command: string) => void
  onWorkerTerminalCopyBootstrap: (agentId: string, bootstrapText: string) => void
  workerHostStatusByAlias: Record<string, DewDropHostStatus>
  workerTerminalBusyIds: readonly string[]
  phoneBrief: string
  desktopBrief: string
  readinessTone: SessionReadinessTone
  readinessLabel: string
  readinessSummary: string
  readinessItems: SessionReadinessItem[]
  handoffLines: string[]
  handoffText: string
  runs: ButlerSwarmRun[]
  runLedger: readonly RunLedgerEntry[]
  currentRunId?: string
  currentRunReport: ButlerSwarmRunReport | null
  reportBusy: boolean
  launchBusy: boolean
  stopBusy: boolean
  onWorkspaceModeChange: (value: DewDropsWorkspaceMode) => void
  onLaunchSurfaceChange: (value: ButlerLaunchSurface) => void
  onCapabilityPackChange: (value: string) => void
  onCapabilityProfileChange: (value: string) => void
  onSwarmRecipeChange: (value: string) => void
  onBriefChange: (value: BriefSpec) => void
  onTemplateChange: (value: ButlerSwarmTemplate) => void
  onObjectiveChange: (value: string) => void
  onRoomWidthChange: (value: number) => void
  onRoomHeightChange: (value: number) => void
  onMembranePadChange: (value: number) => void
  onCardWidthChange: (value: number) => void
  onMemoryWingChange: (value: string) => void
  onMemoryRoomChange: (value: string) => void
  onMemorySummaryChange: (value: string) => void
  onMemoryAnchorsChange: (value: string) => void
  onMemoryPalaceDraftChange: (value: string) => void
  onBriefCompartmentFilesAdd: (files: File[]) => void
  onBriefCompartmentAssetCompartmentChange: (assetId: string, compartmentId: string) => void
  onBriefCompartmentAssetRemove: (assetId: string) => void
  onPhoneBriefChange: (value: string) => void
  onDesktopBriefChange: (value: string) => void
  onCopyPacket: () => void
  onCopyObjective: () => void
  onCopyLaunchBrief: () => void
  onLaunch: () => void
  onStopRun: () => void
  onRefreshRuns: () => void
  onSelectRun: (runId: string) => void
  onArtifactStatusChange: (runId: string, artifactId: string, status: ArtifactStatus) => void
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
  workspaceMode,
  workspaceOptions,
  launchSurface,
  capabilityPackId,
  capabilityPackOptions,
  capabilityProfileId,
  capabilityProfileOptions,
  swarmRecipeId,
  swarmRecipeOptions,
  briefSpec,
  briefVersion,
  launchSurfaceOptions,
  template,
  templateOptions,
  objective,
  roomWidth,
  roomHeight,
  membranePad,
  cardWidth,
  memoryWing,
  memoryWingPlaceholder,
  memoryRoom,
  memoryRoomPlaceholder,
  memorySummary,
  memorySummaryPlaceholder,
  memoryAnchors,
  memoryPalaceDraft,
  memoryPalaceLoci,
  briefCompartmentAssets,
  briefCompartmentOptions,
  selectedAgent,
  workerAgents,
  onWorkerTerminalTitleChange,
  onWorkerTerminalRuntimeChange,
  onWorkerTerminalStart,
  onWorkerTerminalStop,
  onWorkerTerminalRefresh,
  onWorkerTerminalSendInput,
  onWorkerTerminalCheckHost,
  onWorkerTerminalRelayClipboard,
  onWorkerTerminalCopyShell,
  onWorkerTerminalCopyBootstrap,
  workerHostStatusByAlias,
  workerTerminalBusyIds,
  phoneBrief,
  desktopBrief,
  readinessTone,
  readinessLabel,
  readinessSummary,
  readinessItems,
  handoffLines,
  handoffText,
  runs,
  runLedger,
  currentRunId,
  currentRunReport,
  reportBusy,
  launchBusy,
  stopBusy,
  onWorkspaceModeChange,
  onLaunchSurfaceChange,
  onCapabilityPackChange,
  onCapabilityProfileChange,
  onSwarmRecipeChange,
  onBriefChange,
  onTemplateChange,
  onObjectiveChange,
  onRoomWidthChange,
  onRoomHeightChange,
  onMembranePadChange,
  onCardWidthChange,
  onMemoryWingChange,
  onMemoryRoomChange,
  onMemorySummaryChange,
  onMemoryAnchorsChange,
  onMemoryPalaceDraftChange,
  onBriefCompartmentFilesAdd,
  onBriefCompartmentAssetCompartmentChange,
  onBriefCompartmentAssetRemove,
  onPhoneBriefChange,
  onDesktopBriefChange,
  onCopyPacket,
  onCopyObjective,
  onCopyLaunchBrief,
  onLaunch,
  onStopRun,
  onRefreshRuns,
  onSelectRun,
  onArtifactStatusChange,
}: ProblemSwarmInspectorProps) {
  const currentRun = runs.find((run) => run.id === currentRunId || run.run_id === currentRunId) ?? null
  const preview = reportPreview(currentRunReport?.content)
  const currentRunActive = swarmRunIsActive(currentRun?.status)
  const workspaceOption = workspaceOptions.find((option) => option.value === workspaceMode)
  const launchSurfaceOption = launchSurfaceOptions.find((option) => option.value === launchSurface)
  const remainingWorkerAgents = selectedAgent
    ? workerAgents.filter((agent) => agent.id !== selectedAgent.id)
    : workerAgents
  const currentLedgerEntry =
    runLedger.find((entry) => entry.runId === currentRunId) ??
    (currentRun
      ? runLedger.find((entry) => entry.runId === currentRun.run_id || entry.runId === currentRun.id)
      : undefined) ??
    runLedger[0]

  return (
    <aside className="freeform-problem-inspector" aria-label="Selected problem swarm inspector">
      <div className="freeform-problem-inspector-header">
        <div>
          <h2>{title}</h2>
          <p>
            {agentCount} terminal{agentCount === 1 ? '' : 's'} working from this briefcase
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

      <div className="freeform-problem-inspector-section">
        <div className="freeform-toolbar-panel-problem">
          <div>
            <h3>Session surface</h3>
            <p>Switch between heavy desktop execution, phone relay, and memory-palace review.</p>
          </div>
        </div>
        <div className="freeform-problem-inspector-grid">
          <label className="freeform-field">
            <span>Workspace mode</span>
            <select
              value={workspaceMode}
              onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                onWorkspaceModeChange(e.target.value as DewDropsWorkspaceMode)
              }
            >
              {workspaceOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="freeform-field">
            <span>Launch surface</span>
            <select
              value={launchSurface}
              onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                onLaunchSurfaceChange(e.target.value as ButlerLaunchSurface)
              }
            >
              {launchSurfaceOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="freeform-mode-chip-row" aria-label="Current session posture">
          {workspaceOption ? (
            <div className="freeform-mode-chip">
              <strong>{workspaceOption.label}</strong>
              <span>{workspaceOption.detail}</span>
            </div>
          ) : null}
          {launchSurfaceOption ? (
            <div className="freeform-mode-chip">
              <strong>{launchSurfaceOption.label}</strong>
              <span>{launchSurfaceOption.detail}</span>
            </div>
          ) : null}
        </div>
      </div>

      <CapabilityPackPicker
        value={capabilityPackId}
        options={capabilityPackOptions}
        onChange={onCapabilityPackChange}
        disabled={launchBusy}
      />

      <CapabilityProfilePicker
        value={capabilityProfileId}
        options={capabilityProfileOptions}
        onChange={onCapabilityProfileChange}
        disabled={launchBusy}
        emptyLabel="Use Butler defaults"
      />

      <SwarmRecipePicker
        value={swarmRecipeId}
        options={swarmRecipeOptions}
        onChange={onSwarmRecipeChange}
        disabled={launchBusy}
        emptyLabel="Compose from assigned terminals"
      />

      <BriefEditor
        title={`Brief • v${Math.max(briefVersion, 1)}`}
        subtitle="Set the outcome once, load the briefcase with context and materials, then guide lightly or let the terminals run."
        value={briefSpec}
        onChange={onBriefChange}
        disabled={launchBusy}
      />

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
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              onRoomWidthChange(e.target.valueAsNumber || roomWidth)
            }
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
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              onRoomHeightChange(e.target.valueAsNumber || roomHeight)
            }
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
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              onCardWidthChange(e.target.valueAsNumber || cardWidth)
            }
          />
        </label>
      </div>

      <div className="freeform-problem-inspector-section">
        <div className="freeform-toolbar-panel-problem">
          <div>
            <h3>Memory palace context</h3>
            <p>Bind this room to a Lifegirdle wing, room, and anchor set before launching work.</p>
          </div>
        </div>
        <div className="freeform-problem-inspector-grid">
          <label className="freeform-field">
            <span>Memory wing</span>
            <input
              type="text"
              value={memoryWing}
              placeholder={memoryWingPlaceholder}
              onChange={(e: ChangeEvent<HTMLInputElement>) => onMemoryWingChange(e.target.value)}
            />
          </label>
          <label className="freeform-field">
            <span>Memory room</span>
            <input
              type="text"
              value={memoryRoom}
              placeholder={memoryRoomPlaceholder}
              onChange={(e: ChangeEvent<HTMLInputElement>) => onMemoryRoomChange(e.target.value)}
            />
          </label>
        </div>

        <label className="freeform-field">
          <span>Context summary</span>
          <textarea
            value={memorySummary}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onMemorySummaryChange(e.target.value)}
            placeholder={memorySummaryPlaceholder}
            rows={3}
          />
        </label>

        <label className="freeform-field">
          <span>Anchor refs</span>
          <input
            type="text"
            value={memoryAnchors}
            onChange={(e: ChangeEvent<HTMLInputElement>) => onMemoryAnchorsChange(e.target.value)}
            placeholder="compartment/roadmap, entity/tyler, room/phone-relay"
          />
        </label>

        <div className="freeform-toolbar-panel-problem">
          <div>
            <h3>Visual palace scaffold</h3>
            <p>Stage the current context as visual loci so the room holds information, not just notes.</p>
          </div>
          <span className="freeform-run-pill">{memoryPalaceLoci.length} loci</span>
        </div>
        <div className="freeform-memory-palace-grid" aria-label="Visual memory palace loci">
          {memoryPalaceLoci.map((locus) => (
            <article key={locus.id} className={`freeform-memory-palace-card is-${locus.kind}`}>
              <span className="freeform-session-pill">{memoryPalaceKindLabel(locus.kind)}</span>
              <strong>{locus.title}</strong>
              <p>{locus.detail}</p>
            </article>
          ))}
        </div>

        <label className="freeform-field">
          <span>Visual loci</span>
          <textarea
            value={memoryPalaceDraft}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onMemoryPalaceDraftChange(e.target.value)}
            placeholder="North Star | north_star | Keep the user goal visible.\nScreening Bay | room | Phone triage and approvals.\nRoadmap Compartment | artifact | compartment/roadmap"
            rows={5}
          />
        </label>
        <p className="freeform-toolbar-panel-hint">
          One locus per line using `title | kind | detail`. Kinds: `north_star`, `room`, `portal`, `artifact`, `checkpoint`.
        </p>
      </div>

      <BriefCompartmentIntakePanel
        assets={briefCompartmentAssets}
        compartmentOptions={briefCompartmentOptions}
        disabled={launchBusy}
        onAddFiles={onBriefCompartmentFilesAdd}
        onCompartmentChange={onBriefCompartmentAssetCompartmentChange}
        onRemove={onBriefCompartmentAssetRemove}
      />

      {selectedAgent ? (
        <section className="freeform-problem-inspector-section" aria-label="Selected terminal">
          <div className="freeform-toolbar-panel-problem">
            <div>
              <h3>Selected terminal</h3>
              <p>Direct terminal view for the node you clicked.</p>
            </div>
          </div>
          <DewDropTerminalCard
            agent={selectedAgent}
            busy={workerTerminalBusyIds.includes(selectedAgent.id)}
            onTitleChange={onWorkerTerminalTitleChange}
            onRuntimeChange={onWorkerTerminalRuntimeChange}
            onStart={onWorkerTerminalStart}
            onStop={onWorkerTerminalStop}
            onRefresh={onWorkerTerminalRefresh}
            onSendInput={onWorkerTerminalSendInput}
            onCheckHost={onWorkerTerminalCheckHost}
            onRelayClipboard={onWorkerTerminalRelayClipboard}
            onCopyShell={onWorkerTerminalCopyShell}
            onCopyBootstrap={onWorkerTerminalCopyBootstrap}
            hostStatusOverride={
              selectedAgent.agentRuntime?.vpnAlias?.trim()
                ? workerHostStatusByAlias[selectedAgent.agentRuntime.vpnAlias.trim()]
                : undefined
            }
            autoFocusInput
          />
        </section>
      ) : null}

      {remainingWorkerAgents.length > 0 || !selectedAgent ? (
        <WorkerTerminalPanel
          agents={remainingWorkerAgents}
          busyAgentIds={workerTerminalBusyIds}
          onTitleChange={onWorkerTerminalTitleChange}
          onRuntimeChange={onWorkerTerminalRuntimeChange}
          onStart={onWorkerTerminalStart}
          onStop={onWorkerTerminalStop}
          onRefresh={onWorkerTerminalRefresh}
          onSendInput={onWorkerTerminalSendInput}
          onCheckHost={onWorkerTerminalCheckHost}
          onRelayClipboard={onWorkerTerminalRelayClipboard}
          onCopyShell={onWorkerTerminalCopyShell}
          onCopyBootstrap={onWorkerTerminalCopyBootstrap}
          hostStatusByAlias={workerHostStatusByAlias}
        />
      ) : null}

      <div className="freeform-problem-inspector-section">
        <div className="freeform-toolbar-panel-problem">
          <div>
            <h3>Device briefs</h3>
            <p>Give Butler a short phone relay brief and a heavier desktop execution brief.</p>
          </div>
        </div>
        <label className="freeform-field">
          <span>Phone brief</span>
          <textarea
            value={phoneBrief}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onPhoneBriefChange(e.target.value)}
            placeholder="Capture, screen, and escalate only urgent decisions."
            rows={3}
          />
        </label>
        <label className="freeform-field">
          <span>Desktop brief</span>
          <textarea
            value={desktopBrief}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onDesktopBriefChange(e.target.value)}
            placeholder="Use the full desktop session for long build loops, deep review, and synthesis."
            rows={3}
          />
        </label>
      </div>

      <div className="freeform-problem-inspector-section">
        <div className="freeform-toolbar-panel-problem">
          <div>
            <h3>Session readiness</h3>
            <p>Real launch blockers and loose ends for this room.</p>
          </div>
          <span className={`freeform-session-pill is-${readinessTone}`}>{readinessLabel}</span>
        </div>
        <p className="freeform-toolbar-panel-hint">{readinessSummary}</p>
        <ul className="freeform-readiness-list">
          {readinessItems.map((entry) => (
            <li key={entry.id} className={`freeform-readiness-item is-${entry.tone}`}>
              <div className="freeform-readiness-item-head">
                <strong>{entry.label}</strong>
                <span className={`freeform-session-pill is-${entry.tone}`}>{entry.statusLabel}</span>
              </div>
              <span>{entry.detail}</span>
            </li>
          ))}
        </ul>
      </div>

      <label className="freeform-field">
        <span>Live steering</span>
        <textarea
          value={objective}
          onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onObjectiveChange(e.target.value)}
          placeholder="Add any live steering for this run. The brief remains the source of truth."
          rows={5}
          disabled={launchBusy}
        />
      </label>

      <div className="freeform-problem-inspector-section">
        <div className="freeform-toolbar-panel-problem">
          <div>
            <h3>Handoff packet</h3>
            <p>The packet Butler sees when this room launches across devices and sessions.</p>
          </div>
          <span className="freeform-run-pill">{handoffText.split('\n').length} lines</span>
        </div>
        <ul className="freeform-packet-list">
          {handoffLines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <div className="freeform-toolbar-panel-actions">
          <button type="button" className="freeform-btn freeform-btn--tool" onClick={onCopyPacket}>
            Copy packet
          </button>
          <button
            type="button"
            className="freeform-btn freeform-btn--tool"
            onClick={onCopyObjective}
            disabled={!objective.trim()}
          >
            Copy objective
          </button>
          <button
            type="button"
            className="freeform-btn freeform-btn--tool"
            onClick={onCopyLaunchBrief}
            disabled={!objective.trim()}
          >
            Copy run brief
          </button>
        </div>
      </div>

      <div className="freeform-toolbar-panel-actions">
        <button
          type="button"
          className="freeform-btn freeform-btn--tool is-active"
          onClick={onLaunch}
          disabled={launchBusy || !objective.trim()}
        >
          {launchBusy ? 'Launching…' : 'Launch swarm'}
        </button>
        <button type="button" className="freeform-btn freeform-btn--tool" onClick={onRefreshRuns}>
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

      <RunLedgerPanel
        entries={runLedger}
        currentRunId={currentRunId ?? null}
        onSelectRun={onSelectRun}
        emptyText="Run ledger entries appear here after Butler returns summaries or reports."
        onArtifactStatusChange={onArtifactStatusChange}
      />

      <ContinuationDecisionPanel
        decision={currentLedgerEntry?.continuationDecision ?? null}
        selfEvaluation={currentLedgerEntry?.selfEvaluation ?? null}
        criteria={briefSpec.execution.acceptanceCriteria}
      />

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
