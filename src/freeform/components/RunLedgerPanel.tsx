import type { ArtifactStatus, RunArtifact, RunLedgerEntry } from '../types'

export type RunLedgerPanelProps = {
  entries: readonly RunLedgerEntry[]
  title?: string
  description?: string
  emptyText?: string
  currentRunId?: string | null
  onSelectRun?: (runId: string) => void
  showArtifacts?: boolean
  onArtifactStatusChange?: (runId: string, artifactId: string, status: ArtifactStatus) => void
  onArtifactOpen?: (runId: string, artifactId: string) => void
}

function formatArtifactLabel(artifact: RunArtifact): string {
  return `${artifact.kind}: ${artifact.title}`
}

function artifactStatusLabel(status: ArtifactStatus | undefined): string {
  if (status === 'accepted') return 'accepted'
  if (status === 'rejected') return 'rejected'
  return 'provisional'
}

function artifactStatusTone(status: ArtifactStatus | undefined): string {
  if (status === 'accepted') return ' is-online'
  if (status === 'rejected') return ' is-offline'
  return ''
}

function formatArtifactMeta(artifact: RunArtifact): string | null {
  const parts = [
    artifact.path,
    typeof artifact.sizeBytes === 'number' ? `${artifact.sizeBytes} bytes` : null,
    artifact.mimeType ?? null,
  ].filter((value): value is string => Boolean(value))
  return parts.length > 0 ? parts.join(' • ') : null
}

export function RunLedgerPanel({
  entries,
  title = 'Run ledger',
  description = 'Completed runs and their materialized artifacts for this room. Review provisional artifacts here.',
  emptyText = 'No run ledger entries yet.',
  currentRunId = null,
  onSelectRun,
  showArtifacts = true,
  onArtifactStatusChange,
  onArtifactOpen,
}: RunLedgerPanelProps) {
  return (
    <section className="freeform-problem-inspector-section" aria-label={title}>
      <div className="freeform-toolbar-panel-problem">
        <div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
        <span className="freeform-run-pill">{entries.length}</span>
      </div>

      {entries.length === 0 ? (
        <p className="freeform-toolbar-panel-hint">{emptyText}</p>
      ) : (
        <ul className="freeform-run-list">
          {entries.map((entry) => {
            const isCurrent = currentRunId !== null && currentRunId === entry.runId
            const header = (
              <>
                <div className="freeform-run-list-head">
                  <strong>{entry.title}</strong>
                  <span className={`freeform-run-pill${isCurrent ? ' is-active' : ''}`}>{entry.status}</span>
                </div>
                <div className="freeform-run-list-meta">
                  <span>{entry.runId}</span>
                  <span>{entry.startedAt}</span>
                </div>
                <div className="freeform-mode-chip-row">
                  {entry.capabilityProfileId ? (
                    <div className="freeform-mode-chip">
                      <strong>Profile</strong>
                      <span>{entry.capabilityProfileId}</span>
                    </div>
                  ) : null}
                  {entry.swarmRecipeId ? (
                    <div className="freeform-mode-chip">
                      <strong>Recipe</strong>
                      <span>{entry.swarmRecipeId}</span>
                    </div>
                  ) : null}
                </div>
              </>
            )

            return (
              <li key={entry.runId} className={`freeform-run-list-item${isCurrent ? ' is-current' : ''}`}>
                {onSelectRun ? (
                  <button
                    type="button"
                    className="freeform-run-list-button"
                    onClick={() => onSelectRun(entry.runId)}
                  >
                    {header}
                  </button>
                ) : (
                  <div className="freeform-run-list-button" role="group" aria-label={entry.title}>
                    {header}
                  </div>
                )}
                {showArtifacts && entry.artifacts.length > 0 ? (
                  <ul className="freeform-packet-list">
                    {entry.artifacts.map((artifact) => (
                      <li key={artifact.id}>
                        <div className="freeform-run-list-head">
                          <strong>{formatArtifactLabel(artifact)}</strong>
                          <span className={`freeform-run-pill${artifactStatusTone(artifact.status)}`}>
                            {artifactStatusLabel(artifact.status)}
                          </span>
                        </div>
                        <span>{artifact.summary}</span>
                        {formatArtifactMeta(artifact) ? (
                          <span className="freeform-toolbar-panel-hint">{formatArtifactMeta(artifact)}</span>
                        ) : null}
                        {onArtifactOpen && artifact.path ? (
                          <div className="freeform-toolbar-panel-actions">
                            <button
                              type="button"
                              className="freeform-btn freeform-btn--tool"
                              onClick={() => onArtifactOpen(entry.runId, artifact.id)}
                            >
                              Open artifact
                            </button>
                          </div>
                        ) : null}
                        {onArtifactStatusChange ? (
                          <label className="freeform-field">
                            <span>Artifact review</span>
                            <select
                              value={artifact.status ?? 'provisional'}
                              onChange={(event) =>
                                onArtifactStatusChange(
                                  entry.runId,
                                  artifact.id,
                                  event.target.value as ArtifactStatus,
                                )
                              }
                            >
                              <option value="provisional">Provisional</option>
                              <option value="accepted">Accepted</option>
                              <option value="rejected">Rejected</option>
                            </select>
                          </label>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
