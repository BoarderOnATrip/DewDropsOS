import { describe, expect, it } from 'vitest'
import type { BriefPacket } from './briefSpec'
import { buildSelfEvalPromptSection } from './selfEvalTemplate'

function makeBriefPacket(overrides: Partial<BriefPacket> = {}): BriefPacket {
  return {
    briefVersion: 1,
    briefHash: 'abc123',
    compiledAt: '2026-04-18T00:00:00Z',
    roomId: 'room-eval-test',
    creative: {
      mission: 'Give agents clear self-evaluation structure.',
      beneficiary: 'Developers building on DewDrops',
      references: [],
    },
    execution: {
      task: 'Build the selfEvalTemplate module with SELF_EVAL_FIELDS_GUIDE and buildSelfEvalPromptSection.',
      acceptanceCriteria: [
        { id: 'ac-1', description: 'SELF_EVAL_FIELDS_GUIDE is exported as a string', verificationHint: 'typeof check' },
        { id: 'ac-2', description: 'buildSelfEvalPromptSection returns a string containing all criterion IDs' },
        { id: 'ac-3', description: 'Output includes dec/why/rej/watch format example' },
      ],
      scope: { in: ['selfEvalTemplate.ts'], out: ['types.ts', 'briefSpec.ts'] },
      antiPatterns: ['Structured data output instead of human-readable string'],
      deliverables: ['selfEvalTemplate.ts', 'selfEvalTemplate.test.ts'],
    },
    escalationPolicy: 'outcome-contradiction-only',
    autonomyPolicy: 'full-auto',
    ...overrides,
  }
}

describe('buildSelfEvalPromptSection', () => {
  it('includes all criterion IDs from the brief', () => {
    const output = buildSelfEvalPromptSection(makeBriefPacket())
    expect(output).toContain('ac-1')
    expect(output).toContain('ac-2')
    expect(output).toContain('ac-3')
  })

  it('includes each criterion description', () => {
    const output = buildSelfEvalPromptSection(makeBriefPacket())
    expect(output).toContain('SELF_EVAL_FIELDS_GUIDE is exported as a string')
    expect(output).toContain('buildSelfEvalPromptSection returns a string containing all criterion IDs')
  })

  it('includes the escalation policy', () => {
    const output = buildSelfEvalPromptSection(makeBriefPacket())
    expect(output).toContain('outcome-contradiction-only')
  })

  it('includes the autonomy policy', () => {
    const output = buildSelfEvalPromptSection(makeBriefPacket())
    expect(output).toContain('full-auto')
  })

  it('contains the dec: format marker showing the handoff convention', () => {
    const output = buildSelfEvalPromptSection(makeBriefPacket())
    expect(output).toContain('dec:')
  })

  it('contains nextAction guidance', () => {
    const output = buildSelfEvalPromptSection(makeBriefPacket())
    expect(output).toContain('nextAction')
  })

  it('works correctly with zero acceptance criteria', () => {
    const packet = makeBriefPacket({
      execution: {
        task: 'Spike: explore the API surface.',
        acceptanceCriteria: [],
        scope: { in: [], out: [] },
        antiPatterns: [],
        deliverables: [],
      },
    })
    const output = buildSelfEvalPromptSection(packet)
    expect(output).toContain('none')
    expect(output).toContain('allCriteriaMet is true by default')
  })

  it('includes the task text from the brief', () => {
    const output = buildSelfEvalPromptSection(makeBriefPacket())
    expect(output).toContain('Build the selfEvalTemplate module')
  })

  it('includes the verificationHint as a verify: line when present', () => {
    const output = buildSelfEvalPromptSection(makeBriefPacket())
    // ac-1 has verificationHint: 'typeof check'
    expect(output).toContain('verify: typeof check')
  })

  it('omits the verify: line when verificationHint is absent', () => {
    const output = buildSelfEvalPromptSection(makeBriefPacket())
    // ac-2 has no verificationHint — its line should not be followed by a verify: line
    // The simplest check: count verify: occurrences — should match number of hints present
    const verifyLines = output.split('\n').filter((l) => l.trim().startsWith('verify:'))
    // Only ac-1 has a verificationHint in the default packet
    expect(verifyLines).toHaveLength(1)
  })

  it('returns a non-empty string', () => {
    const output = buildSelfEvalPromptSection(makeBriefPacket())
    expect(typeof output).toBe('string')
    expect(output.length).toBeGreaterThan(100)
  })
})
