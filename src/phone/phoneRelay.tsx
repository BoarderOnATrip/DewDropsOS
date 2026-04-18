import { useState } from 'react'
import type {
  PhoneRelayCurrentProblem,
  PhoneRelayShellData,
} from './phoneRelayModel'
import { memoryPalaceKindLabel } from '../freeform/visualMemoryPalace'
import { SpatialRoomStage } from '../spatial/SpatialRoomStage'
import './phoneRelay.css'

export type PhoneRelayShellProps = PhoneRelayShellData & {
  onFocusProblem?: (problemId: string) => void
  onJumpToDesktop?: () => void
  className?: string
}

function chipTone(status: 'ready' | 'attention' | 'missing'): string {
  if (status === 'ready') return 'is-ready'
  if (status === 'attention') return 'is-attention'
  return 'is-missing'
}

function briefValue(value: string | undefined, fallback: string): string {
  return value?.trim() || fallback
}

export function PhoneRelayShell({
  workspaceId,
  workspaceName,
  workspaceSubtitle = 'Phone relay workspace snapshot',
  workspaceMode,
  workspaceProjectionLabel,
  bridgeStatusLabel,
  bridgeTone,
  selectedProblemId,
  problemList,
  currentProblem,
  readinessText,
  packetText,
  onFocusProblem,
  onJumpToDesktop,
  className,
}: PhoneRelayShellProps) {
  const [internalProblemId, setInternalProblemId] = useState<string | null>(
    selectedProblemId ?? problemList[0]?.id ?? null,
  )
  const focusedProblemId = selectedProblemId ?? internalProblemId ?? problemList[0]?.id ?? null
  const selectedProblem: PhoneRelayCurrentProblem | null =
    (currentProblem?.id === focusedProblemId ? currentProblem : null) ??
    problemList.find((entry) => entry.id === focusedProblemId) ??
    currentProblem ??
    null

  function focusProblem(problemId: string) {
    if (selectedProblemId === undefined) {
      setInternalProblemId(problemId)
    }
    onFocusProblem?.(problemId)
  }

  const problemCountLabel = `${problemList.length} problem${problemList.length === 1 ? '' : 's'}`
  const selectedAgentCount = selectedProblem?.agentCount ?? 0
  const selectedAgentLabel = `${selectedAgentCount} agent${selectedAgentCount === 1 ? '' : 's'}`
  const roomLabel = selectedProblem?.roomLabel ?? 'Select a room'
  const projectionLabel = selectedProblem?.projectionLabel ?? workspaceProjectionLabel

  return (
    <main className={`phone-relay-shell${className ? ` ${className}` : ''}`}>
      <header className="phone-relay-hero">
        <div className="phone-relay-hero-copy">
          <p className="phone-relay-kicker">{workspaceMode === 'phone' ? 'Phone relay' : 'Workspace relay'}</p>
          <h1>{workspaceName}</h1>
          <p className="phone-relay-subtitle">{workspaceSubtitle}</p>
        </div>
        <div className="phone-relay-status-stack">
          {workspaceId ? <span className="phone-relay-chip">#{workspaceId}</span> : null}
          <span className={`phone-relay-chip ${bridgeTone ? chipTone(bridgeTone) : 'is-missing'}`}>
            {bridgeStatusLabel ?? 'Bridge offline'}
          </span>
          <span
            className={`phone-relay-chip ${currentProblem?.readinessTone ? chipTone(currentProblem.readinessTone) : 'is-missing'}`}
          >
            {currentProblem?.readinessLabel ?? 'No focus'}
          </span>
          <span className="phone-relay-chip">{problemCountLabel}</span>
          <span className="phone-relay-chip">{selectedAgentLabel}</span>
          <span className="phone-relay-chip">{workspaceProjectionLabel}</span>
          {onJumpToDesktop ? (
            <button type="button" className="phone-relay-focus-button" onClick={onJumpToDesktop}>
              Jump to desktop
            </button>
          ) : null}
        </div>
      </header>

      <section className="phone-relay-grid" aria-label="Workspace snapshot">
        <section className="phone-relay-room-strip" aria-label="Active room projection">
          <div className="phone-relay-room-strip-copy">
            <p className="phone-relay-section-label">Active room</p>
            <h2>{roomLabel}</h2>
            <p>{currentProblem?.roomSummary ?? 'Pick a room to see its projection, anchors, and tunnel packet.'}</p>
          </div>
          <div className="phone-relay-room-strip-meta">
            <span>{projectionLabel}</span>
            <span>{selectedProblem?.surfaceLabel ?? 'Relay'}</span>
            <span>{selectedProblem?.roomLabel ? `${selectedAgentLabel}` : 'No room selected'}</span>
          </div>
        </section>

        <div className="phone-relay-panel phone-relay-panel-list">
          <div className="phone-relay-panel-head">
            <div>
              <p className="phone-relay-section-label">Room index</p>
              <h2>Focus a room</h2>
            </div>
            {currentProblem ? (
              <span className={`phone-relay-chip ${currentProblem.readinessTone ? chipTone(currentProblem.readinessTone) : 'is-attention'}`}>
                {currentProblem.readinessLabel ?? 'Ready'}
              </span>
            ) : null}
          </div>

          {problemList.length === 0 ? (
            <div className="phone-relay-empty">
              <strong>No problem cards yet.</strong>
              <p>Add a problem on the desktop board and the phone relay will pick it up here.</p>
            </div>
          ) : (
            <div className="phone-relay-problem-list">
              {problemList.map((entry) => {
                const selected = entry.id === focusedProblemId
                const latestRunLabel = entry.latestRunLabel
                  ? `${entry.latestRunLabel}${entry.latestRunSummary ? ` · ${entry.latestRunSummary}` : ''}`
                  : 'No run yet'
                return (
                  <article key={entry.id} className={`phone-relay-problem-card${selected ? ' is-selected' : ''}`}>
                    <button
                      type="button"
                      className="phone-relay-problem-button"
                      onClick={() => focusProblem(entry.id)}
                      aria-pressed={selected}
                      aria-label={`Focus ${entry.title}`}
                    >
                      <div className="phone-relay-problem-head">
                        <strong>{entry.title}</strong>
                        {entry.readinessLabel ? (
                          <span className={`phone-relay-chip ${entry.readinessTone ? chipTone(entry.readinessTone) : 'is-attention'}`}>
                            {entry.readinessLabel}
                          </span>
                        ) : null}
                      </div>
                      <p>{briefValue(entry.mission, 'No mission brief yet. Add one on the desktop board.')}</p>
                      <div className="phone-relay-problem-meta">
                        {entry.roomLabel ? <span>{entry.roomLabel}</span> : null}
                        {entry.projectionLabel ? <span>{entry.projectionLabel}</span> : null}
                        <span>{entry.agentCount ?? 0} agent{(entry.agentCount ?? 0) === 1 ? '' : 's'}</span>
                        <span>{latestRunLabel}</span>
                      </div>
                    </button>
                  </article>
                )
              })}
            </div>
          )}
        </div>

        <div className="phone-relay-panel phone-relay-panel-detail">
          <div className="phone-relay-panel-head">
            <div>
              <p className="phone-relay-section-label">Focused room</p>
              <h2>{selectedProblem?.roomLabel ?? selectedProblem?.title ?? 'Select a problem'}</h2>
            </div>
            {selectedProblem ? (
              <button
                type="button"
                className="phone-relay-focus-button"
                onClick={() => focusProblem(selectedProblem.id)}
              >
                Focus
              </button>
            ) : null}
          </div>

          {selectedProblem ? (
            <div className="phone-relay-detail-stack">
              <section className="phone-relay-section-card">
                <div className="phone-relay-section-card-head">
                  <h3>Room projection</h3>
                  <span className="phone-relay-chip">{selectedProblem.projectionLabel ?? workspaceProjectionLabel}</span>
                </div>
                <div className="phone-relay-room-essentials">
                  <div className="phone-relay-room-essence">
                    <span>Room</span>
                    <strong>{selectedProblem.roomLabel ?? 'Unmapped room'}</strong>
                  </div>
                  <div className="phone-relay-room-essence">
                    <span>Surface</span>
                    <strong>{selectedProblem.surfaceLabel ?? 'Relay'}</strong>
                  </div>
                  <div className="phone-relay-room-essence">
                    <span>Actors</span>
                    <strong>{selectedAgentLabel}</strong>
                  </div>
                  <div className="phone-relay-room-essence">
                    <span>Anchors</span>
                    <strong>{selectedProblem.anchorLabels?.length ?? 0}</strong>
                  </div>
                </div>
                <p className="phone-relay-detail-copy">
                  {briefValue(selectedProblem.roomSummary, 'This room will hold the active context snapshot.')}
                </p>
              </section>

              {selectedProblem.spatialRoomScene ? (
                <section className="phone-relay-section-card">
                  <div className="phone-relay-section-card-head">
                    <h3>Spatial room</h3>
                    <span className="phone-relay-chip">{selectedProblem.spatialRoomScene.captureLabel}</span>
                  </div>
                  <SpatialRoomStage scene={selectedProblem.spatialRoomScene} size="compact" />
                </section>
              ) : null}

              <section className="phone-relay-section-card">
                <div className="phone-relay-section-card-head">
                  <h3>Readiness</h3>
                  <span className={`phone-relay-chip ${selectedProblem.readinessTone ? chipTone(selectedProblem.readinessTone) : 'is-attention'}`}>
                    {selectedProblem.readinessLabel ?? 'Ready'}
                  </span>
                </div>
                <p className="phone-relay-detail-copy">{readinessText}</p>
              </section>

              <section className="phone-relay-section-card">
                <div className="phone-relay-section-card-head">
                  <h3>Handoff packet</h3>
                  <span className="phone-relay-chip">Ready to relay</span>
                </div>
                <ul className="phone-relay-packet-list">
                  {packetText.split('\n').filter(Boolean).map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </section>

              <section className="phone-relay-section-card">
                <div className="phone-relay-section-card-head">
                  <h3>Tunnel brief</h3>
                  <span className="phone-relay-chip">{selectedProblem.surfaceLabel ?? 'Relay'}</span>
                </div>
                <div className="phone-relay-briefs">
                  <div className="phone-relay-brief">
                    <span>Relay brief</span>
                    <p>{briefValue(selectedProblem.brief, 'No brief yet.')}</p>
                  </div>
                  <div className="phone-relay-brief">
                    <span>Latest run</span>
                    <p>
                      {selectedProblem.latestRunLabel
                        ? `${selectedProblem.latestRunLabel}${selectedProblem.latestRunSummary ? ` · ${selectedProblem.latestRunSummary}` : ''}`
                        : 'No run yet.'}
                    </p>
                  </div>
                </div>
              </section>

              {selectedProblem.memoryPalaceLoci && selectedProblem.memoryPalaceLoci.length > 0 ? (
                <section className="phone-relay-section-card">
                  <div className="phone-relay-section-card-head">
                    <h3>Visual memory palace</h3>
                    <span className="phone-relay-chip">{selectedProblem.memoryPalaceLoci.length} loci</span>
                  </div>
                  <div className="phone-relay-palace-grid">
                    {selectedProblem.memoryPalaceLoci.map((locus) => (
                      <article key={locus.id} className={`phone-relay-palace-card is-${locus.kind}`}>
                        <span className="phone-relay-chip">{memoryPalaceKindLabel(locus.kind)}</span>
                        <strong>{locus.title}</strong>
                        <p>{locus.detail}</p>
                      </article>
                    ))}
                  </div>
                </section>
              ) : null}
            </div>
          ) : (
            <div className="phone-relay-empty phone-relay-empty-detail">
              <strong>No problem selected.</strong>
              <p>Pick a problem from the list to inspect its readiness, packet, and latest run.</p>
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
