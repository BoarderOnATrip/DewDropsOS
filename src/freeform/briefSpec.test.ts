import { describe, expect, it } from 'vitest'
import { emptyBriefSpec, normalizeBriefSpec } from './briefSpec'
import type { BriefSpec } from './briefSpec'

function fullBriefSpec(overrides: Partial<BriefSpec> = {}): BriefSpec {
  return {
    id: 'brief-1',
    creative: {
      mission: 'Give Stephanie instant access to her contact history from her phone.',
      beneficiary: 'Stephanie — real estate agent who needs context before every call.',
      audience: 'Real estate clients',
      references: [
        { label: 'Good example', ref: 'https://example.com/good', note: 'Fast, thumb-friendly', polarity: 'good' },
        { label: 'Bad example', ref: 'https://example.com/bad', note: 'Requires keyboard', polarity: 'bad' },
      ],
      tone: 'Direct and reliable',
    },
      execution: {
        task: 'Build a contact list with search, notes, last-contact date, and deal stage.',
        acceptanceCriteria: [
          { id: 'ac-1', description: 'Search returns results in < 300ms', verificationHint: 'Measure with performance test' },
          { id: 'ac-2', description: 'Notes can be added in < 3 taps' },
        ],
        scope: {
          in: ['contacts', 'search', 'notes', 'deal stage badge'],
          out: ['email integration', 'bulk import', 'team sharing'],
        },
        projectStructure: ['src/', 'src/app/', 'src/app/contacts/', 'src/app/contacts/page.tsx'],
        antiPatterns: ['Desktop-first UI that requires a keyboard', 'Any feature that needs wifi to load'],
        deliverables: ['Contact list screen', 'Note entry flow', 'Deal stage indicator'],
        milestone: 'Sprint 1',
        dependsOn: ['room-auth'],
      deadline: '2026-05-01',
      effortHint: 'medium',
    },
    capabilityProfileId: 'build-local',
    swarmRecipeId: 'build-review-ship',
    escalationPolicy: 'outcome-contradiction-only',
    autonomyPolicy: 'full-auto',
    projectId: 'stephanie-crm',
    ...overrides,
  }
}

describe('BriefSpec', () => {
  it('emptyBriefSpec produces a valid blank brief', () => {
    const spec = emptyBriefSpec('brief-new')
    expect(spec.id).toBe('brief-new')
    expect(spec.creative.mission).toBe('')
    expect(spec.creative.references).toEqual([])
    expect(spec.execution.acceptanceCriteria).toEqual([])
    expect(spec.execution.scope.in).toEqual([])
    expect(spec.execution.scope.out).toEqual([])
    expect(spec.escalationPolicy).toBe('outcome-contradiction-only')
    expect(spec.autonomyPolicy).toBe('full-auto')
  })

  it('a full brief spec contains all creative and execution fields', () => {
    const spec = fullBriefSpec()
    expect(spec.creative.mission).toContain('Stephanie')
    expect(spec.creative.references).toHaveLength(2)
    expect(spec.creative.references[0]?.polarity).toBe('good')
    expect(spec.creative.references[1]?.polarity).toBe('bad')
    expect(spec.execution.task).toContain('contact list')
    expect(spec.execution.acceptanceCriteria).toHaveLength(2)
    expect(spec.execution.scope.in).toContain('contacts')
    expect(spec.execution.scope.out).toContain('email integration')
    expect(spec.execution.projectStructure).toHaveLength(4)
    expect(spec.execution.antiPatterns).toHaveLength(2)
    expect(spec.execution.deliverables).toHaveLength(3)
  })

  it('escalationPolicy is always outcome-contradiction-only', () => {
    const spec = fullBriefSpec()
    expect(spec.escalationPolicy).toBe('outcome-contradiction-only')
  })

  it('autonomyPolicy supports all valid values', () => {
    expect(fullBriefSpec({ autonomyPolicy: 'full-auto' }).autonomyPolicy).toBe('full-auto')
    expect(fullBriefSpec({ autonomyPolicy: 'milestone-checkpoint' }).autonomyPolicy).toBe('milestone-checkpoint')
    expect(fullBriefSpec({ autonomyPolicy: 'per-run-checkpoint' }).autonomyPolicy).toBe('per-run-checkpoint')
  })

  it('normalizeBriefSpec fills missing nested fields from a partial runtime brief', () => {
    const spec = normalizeBriefSpec(
      {
        id: 'brief-legacy',
        creative: { mission: 'Keep the room moving.' },
        execution: { task: 'Ship the next pass.' },
      },
      'brief-fallback',
    )

    expect(spec.id).toBe('brief-legacy')
    expect(spec.creative.mission).toBe('Keep the room moving.')
    expect(spec.creative.beneficiary).toBe('')
    expect(spec.creative.references).toEqual([])
    expect(spec.execution.task).toBe('Ship the next pass.')
    expect(spec.execution.acceptanceCriteria).toEqual([])
    expect(spec.execution.scope).toEqual({ in: [], out: [] })
    expect(spec.execution.projectStructure).toEqual([])
    expect(spec.execution.deliverables).toEqual([])
    expect(spec.autonomyPolicy).toBe('full-auto')
  })

  it('creative and execution are distinct sub-objects', () => {
    const spec = fullBriefSpec()
    expect(spec.creative).toBeDefined()
    expect(spec.execution).toBeDefined()
    // Execution fields should not be on creative
    expect((spec.creative as Record<string, unknown>).task).toBeUndefined()
    // Creative fields should not be on execution
    expect((spec.execution as Record<string, unknown>).mission).toBeUndefined()
  })
})
