import type { BriefPacket } from './briefSpec'
import type { SelfEvaluation } from './types'

export type ContinuationDecision = 'continue' | 'complete' | 'escalate'

export type ContinuationResult = {
  decision: ContinuationDecision
  reason: string
}

// Pure evaluator: takes a self-evaluation and the brief packet that produced it,
// returns the continuation decision. No side effects, no I/O.
//
// Decision rules (evaluated in priority order):
//  1. escalationReason present → escalate (outcome contradiction in brief)
//  2. allCriteriaMet and no remaining criteria → complete
//  3. criteriaRemaining or nextAction present → continue
//  4. default → complete (no remaining work identified)
//
// Note: autonomyPolicy affects WHO sees the result downstream, not the decision
// itself. The caller respects the policy — this function only judges the work.
export function evaluateContinuation(
  selfEval: SelfEvaluation,
  briefPacket: BriefPacket,
): ContinuationResult {
  void briefPacket
  if (selfEval.escalationReason) {
    return {
      decision: 'escalate',
      reason: selfEval.escalationReason,
    }
  }

  if (selfEval.allCriteriaMet && selfEval.criteriaRemaining.length === 0) {
    return {
      decision: 'complete',
      reason: 'All acceptance criteria satisfied and no remaining scope.',
    }
  }

  if (selfEval.criteriaRemaining.length > 0 || selfEval.nextAction) {
    const reason =
      selfEval.nextAction ??
      `${selfEval.criteriaRemaining.length} acceptance ${selfEval.criteriaRemaining.length === 1 ? 'criterion' : 'criteria'} still pending.`
    return { decision: 'continue', reason }
  }

  return {
    decision: 'complete',
    reason: 'No remaining criteria or actions identified.',
  }
}
