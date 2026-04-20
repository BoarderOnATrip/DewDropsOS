import type { AcceptanceCriterion } from '../briefSpec'
import { parseHandoffNotes } from '../rtk'
import type { CriterionCheck, RunLedgerEntry, SelfEvaluation } from '../types'

export type ContinuationDecisionPanelProps = {
  title?: string
  description?: string
  decision?: RunLedgerEntry['continuationDecision'] | null
  selfEvaluation?: SelfEvaluation | null
  criteria?: readonly AcceptanceCriterion[]
  emptyText?: string
}

function decisionLabel(decision: RunLedgerEntry['continuationDecision'] | null | undefined): string {
  if (decision === 'continue') return 'Continue'
  if (decision === 'complete') return 'Complete'
  if (decision === 'escalate') return 'Escalate'
  return 'Pending'
}

function decisionTone(decision: RunLedgerEntry['continuationDecision'] | null | undefined): string {
  if (decision === 'continue') return 'is-active'
  if (decision === 'complete') return 'is-online'
  if (decision === 'escalate') return 'is-offline'
  return ''
}

function confidenceLabel(confidence: CriterionCheck['confidence'] | undefined): string {
  if (confidence === 'high') return 'high confidence'
  if (confidence === 'medium') return 'medium confidence'
  if (confidence === 'low') return 'low confidence'
  return 'unspecified confidence'
}

function criterionMeta(criteria: readonly AcceptanceCriterion[]): Map<string, AcceptanceCriterion> {
  return new Map(criteria.map((criterion) => [criterion.id, criterion]))
}

export function ContinuationDecisionPanel({
  title = 'Continuation decision',
  description = 'Agent self-evaluation against the brief, with the next move or escalation reason.',
  decision = null,
  selfEvaluation,
  criteria = [],
  emptyText = 'No self-evaluation has been recorded yet.',
}: ContinuationDecisionPanelProps) {
  const meta = criterionMeta(criteria)
  const checks = selfEvaluation?.criteriaChecks ?? []
  const assumptions = selfEvaluation?.assumptions ?? []
  const parsedHandoffNotes = selfEvaluation?.handoffNotes ? parseHandoffNotes(selfEvaluation.handoffNotes) : null

  return (
    <section className="freeform-problem-inspector-section" aria-label={title}>
      <div className="freeform-toolbar-panel-problem">
        <div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
        <span className={`freeform-run-pill ${decisionTone(decision)}`.trim()}>{decisionLabel(decision)}</span>
      </div>

      {!selfEvaluation ? (
        <p className="freeform-toolbar-panel-hint">{emptyText}</p>
      ) : (
        <>
          <div className="freeform-mode-chip-row">
            <div className="freeform-mode-chip">
              <strong>Alignment</strong>
              <span>{selfEvaluation.alignmentSummary || 'No alignment summary provided.'}</span>
            </div>
            <div className="freeform-mode-chip">
              <strong>Next action</strong>
              <span>{selfEvaluation.nextAction?.trim() ? selfEvaluation.nextAction : 'No next action queued.'}</span>
            </div>
          </div>

          <div className="freeform-mode-chip-row">
            <div className="freeform-mode-chip">
              <strong>Criteria covered</strong>
              <span>{selfEvaluation.criteriaCovered.length}</span>
            </div>
            <div className="freeform-mode-chip">
              <strong>Criteria remaining</strong>
              <span>{selfEvaluation.criteriaRemaining.length}</span>
            </div>
          </div>

          {selfEvaluation.escalationReason?.trim() ? (
            <div className="freeform-toolbar-panel-hint" role="note">
              <strong>Escalation</strong>
              <p>{selfEvaluation.escalationReason}</p>
            </div>
          ) : null}

          {selfEvaluation.handoffNotes.trim() ? (
            <div className="freeform-toolbar-panel-hint" role="note">
              <strong>Handoff notes</strong>
              {parsedHandoffNotes ? (
                <div className="freeform-mode-chip-row">
                  <div className="freeform-mode-chip">
                    <strong>Decision</strong>
                    <span>{parsedHandoffNotes.dec}</span>
                  </div>
                  <div className="freeform-mode-chip">
                    <strong>Why</strong>
                    <span>{parsedHandoffNotes.why}</span>
                  </div>
                  {parsedHandoffNotes.rej ? (
                    <div className="freeform-mode-chip">
                      <strong>Rejected</strong>
                      <span>{parsedHandoffNotes.rej}</span>
                    </div>
                  ) : null}
                  {parsedHandoffNotes.watch ? (
                    <div className="freeform-mode-chip">
                      <strong>Watch</strong>
                      <span>{parsedHandoffNotes.watch}</span>
                    </div>
                  ) : null}
                </div>
              ) : (
                <p>{selfEvaluation.handoffNotes}</p>
              )}
            </div>
          ) : null}

          <div className="freeform-toolbar-panel-problem">
            <div>
              <h3>Criteria checks</h3>
              <p>What the agent checked against the execution brief.</p>
            </div>
            <span className="freeform-run-pill">{checks.length}</span>
          </div>

          {checks.length === 0 ? (
            <p className="freeform-toolbar-panel-hint">No criteria checks available.</p>
          ) : (
            <ul className="freeform-readiness-list">
              {checks.map((check) => {
                const resolved = meta.get(check.criterionId)
                return (
                  <li key={check.criterionId} className={`freeform-readiness-item is-${check.met ? 'ready' : 'attention'}`}>
                    <div className="freeform-readiness-item-head">
                      <strong>{resolved?.description ?? check.criterionId}</strong>
                      <span className={`freeform-session-pill is-${check.met ? 'ready' : 'attention'}`}>
                        {check.met ? 'met' : 'open'}
                      </span>
                    </div>
                    <span>{check.evidence}</span>
                    <div className="freeform-mode-chip-row">
                      <div className="freeform-mode-chip">
                        <strong>Criterion</strong>
                        <span>{check.criterionId}</span>
                      </div>
                      <div className="freeform-mode-chip">
                        <strong>Confidence</strong>
                        <span>{confidenceLabel(check.confidence)}</span>
                      </div>
                      {resolved?.verificationHint ? (
                        <div className="freeform-mode-chip">
                          <strong>Verify</strong>
                          <span>{resolved.verificationHint}</span>
                        </div>
                      ) : null}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}

          <div className="freeform-toolbar-panel-problem">
            <div>
              <h3>Assumptions</h3>
              <p>Documented judgment calls that kept the run moving.</p>
            </div>
            <span className="freeform-run-pill">{assumptions.length}</span>
          </div>

          {assumptions.length === 0 ? (
            <p className="freeform-toolbar-panel-hint">No assumptions recorded.</p>
          ) : (
            <ul className="freeform-packet-list">
              {assumptions.map((assumption, index) => (
                <li key={`${index}-${assumption}`}>
                  <strong>{index + 1}</strong>
                  <span>{assumption}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  )
}
