import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ContinuationDecisionPanel } from './ContinuationDecisionPanel'

describe('ContinuationDecisionPanel', () => {
  it('renders the evaluation summary, checks, assumptions, and decision', () => {
    render(
      <ContinuationDecisionPanel
        decision="continue"
        criteria={[
          {
            id: 'criteria-1',
            description: 'Search returns results quickly',
            verificationHint: 'npm test',
          },
          {
            id: 'criteria-2',
            description: 'Phone note creation stays under 3 taps',
          },
        ]}
        selfEvaluation={{
          alignmentSummary: 'The implementation matches the brief and only one scope item remains.',
          nextAction: 'Queue the follow-up room contract.',
          escalationReason: null,
          assumptions: ['Used SQLite for local-only storage.'],
          criteriaChecks: [
            {
              criterionId: 'criteria-1',
              met: true,
              evidence: 'Search test passed in CI.',
              confidence: 'high',
            },
            {
              criterionId: 'criteria-2',
              met: false,
              evidence: 'UI path still needs a compact button flow.',
              confidence: 'medium',
            },
          ],
          allCriteriaMet: false,
          criteriaCovered: ['criteria-1'],
          criteriaRemaining: ['criteria-2'],
          handoffNotes: [
            'dec:kept SQLite for the room-first pass',
            'why:offline-first phone flow still has no sync layer',
            'rej:skipped hosted Postgres for the MVP slice',
            'watch:revisit storage when multi-user sync lands',
          ].join('\n'),
        }}
      />,
    )

    expect(screen.getByText('Continuation decision')).toBeInTheDocument()
    expect(screen.getByText('Continue')).toBeInTheDocument()
    expect(screen.getByText('The implementation matches the brief and only one scope item remains.')).toBeInTheDocument()
    expect(screen.getByText('Queue the follow-up room contract.')).toBeInTheDocument()
    expect(screen.getByText('Search returns results quickly')).toBeInTheDocument()
    expect(screen.getByText('Phone note creation stays under 3 taps')).toBeInTheDocument()
    expect(screen.getByText('Used SQLite for local-only storage.')).toBeInTheDocument()
    expect(screen.getByText('high confidence')).toBeInTheDocument()
    expect(screen.getByText('kept SQLite for the room-first pass')).toBeInTheDocument()
    expect(screen.getByText('offline-first phone flow still has no sync layer')).toBeInTheDocument()
    expect(screen.getByText('skipped hosted Postgres for the MVP slice')).toBeInTheDocument()
    expect(screen.getByText('revisit storage when multi-user sync lands')).toBeInTheDocument()
  })

  it('shows an empty state when nothing has been evaluated yet', () => {
    render(<ContinuationDecisionPanel />)

    expect(screen.getByText('No self-evaluation has been recorded yet.')).toBeInTheDocument()
  })
})
