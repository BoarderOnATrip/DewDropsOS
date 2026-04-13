import type { ButlerSwarmRun } from '../../lib/butlerBridge'
import { formatRunStatus, swarmRunIsActive } from '../runFormat'

type SwarmRunListProps = {
  runs: ButlerSwarmRun[]
  currentRunId?: string
  onSelectRun?: (runId: string) => void
  emptyText?: string
}

export function SwarmRunList({
  runs,
  currentRunId,
  onSelectRun,
  emptyText = 'No swarm runs yet.',
}: SwarmRunListProps) {
  if (runs.length === 0) {
    return <p className="freeform-toolbar-panel-hint">{emptyText}</p>
  }

  return (
    <ul className="freeform-run-list">
      {runs.map((run) => {
        const runId = run.id || run.run_id
        const isCurrent = currentRunId === run.id || currentRunId === run.run_id
        return (
          <li
            key={runId}
            className={`freeform-run-list-item${isCurrent ? ' is-current' : ''}`}
          >
            <button
              type="button"
              className="freeform-run-list-button"
              onClick={() => {
                if (runId) onSelectRun?.(runId)
              }}
            >
              <div className="freeform-run-list-head">
                <strong>{run.title}</strong>
                <span className={`freeform-run-pill${swarmRunIsActive(run.status) ? ' is-active' : ''}`}>
                  {formatRunStatus(run.status)}
                </span>
              </div>
              {run.summary ? <p>{run.summary}</p> : null}
              <div className="freeform-run-list-meta">
                <span>{runId}</span>
                {run.updated_at ? <span>{run.updated_at.slice(11, 19)} UTC</span> : null}
              </div>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
