import { describe, expect, it } from 'vitest'
import type { BriefPacket } from './briefSpec'
import { evaluateContinuation } from './continuationPolicy'
import type { SelfEvaluation } from './types'

function briefPacket(): BriefPacket {
  return {
    briefVersion: 1,
    briefHash: 'abc123',
    compiledAt: '2026-01-01T00:00:00.000Z',
    roomId: 'room-1',
    creative: {
      mission: 'Build the contact list.',
      beneficiary: 'Stephanie',
      references: [],
    },
    execution: {
      task: 'Build a contact list with search and notes.',
      acceptanceCriteria: [
        { id: 'ac-1', description: 'Search returns results in < 300ms' },
        { id: 'ac-2', description: 'Notes can be added in < 3 taps' },
      ],
      scope: { in: ['contacts', 'search'], out: ['email integration'] },
      antiPatterns: [],
      deliverables: ['Contact list screen'],
    },
    escalationPolicy: 'outcome-contradiction-only',
    autonomyPolicy: 'full-auto',
  }
}

function selfEval(overrides: Partial<SelfEvaluation> = {}): SelfEvaluation {
  return {
    alignmentSummary: 'Built the contact list screen with search.',
    criteriaChecks: [],
    allCriteriaMet: false,
    criteriaCovered: ['ac-1'],
    criteriaRemaining: ['ac-2'],
    nextAction: 'Add the note entry flow next.',
    escalationReason: null,
    assumptions: [],
    handoffNotes: '',
    ...overrides,
  }
}

describe('evaluateContinuation', () => {
  it('escalates when escalationReason is set', () => {
    const result = evaluateContinuation(
      selfEval({ escalationReason: 'The brief says offline-first but requires a live API.' }),
      briefPacket(),
    )
    expect(result.decision).toBe('escalate')
    expect(result.reason).toContain('brief says offline-first')
  })

  it('completes when all criteria are met and none remain', () => {
    const result = evaluateContinuation(
      selfEval({ allCriteriaMet: true, criteriaRemaining: [], nextAction: null, escalationReason: null }),
      briefPacket(),
    )
    expect(result.decision).toBe('complete')
  })

  it('continues when criteria are still remaining', () => {
    const result = evaluateContinuation(selfEval(), briefPacket())
    expect(result.decision).toBe('continue')
    expect(result.reason).toContain('note entry flow')
  })

  it('continues using remaining criteria count when nextAction is null', () => {
    const result = evaluateContinuation(
      selfEval({ nextAction: null, criteriaRemaining: ['ac-2'] }),
      briefPacket(),
    )
    expect(result.decision).toBe('continue')
    expect(result.reason).toContain('1 acceptance criterion')
  })

  it('uses plural "criteria" when multiple criteria remain', () => {
    const result = evaluateContinuation(
      selfEval({ nextAction: null, criteriaRemaining: ['ac-1', 'ac-2'] }),
      briefPacket(),
    )
    expect(result.reason).toContain('2 acceptance criteria')
  })

  it('escalation takes priority over incomplete criteria', () => {
    const result = evaluateContinuation(
      selfEval({
        escalationReason: 'Contradiction found.',
        criteriaRemaining: ['ac-2'],
        nextAction: 'Do more work.',
      }),
      briefPacket(),
    )
    expect(result.decision).toBe('escalate')
  })

  it('completes when there are no remaining actions and no remaining criteria', () => {
    const result = evaluateContinuation(
      selfEval({ allCriteriaMet: false, criteriaRemaining: [], nextAction: null, escalationReason: null }),
      briefPacket(),
    )
    expect(result.decision).toBe('complete')
  })
})
