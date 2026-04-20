import { describe, expect, it } from 'vitest'
import type { BriefSpec } from './briefSpec'
import { bumpBriefVersion, compileBriefPacket, detectBriefHashDrift, getBriefDriftInfo } from './briefCompiler'
import type { RunLedgerEntry, WorkflowCard } from './types'

function card(overrides: Partial<WorkflowCard> = {}): WorkflowCard {
  return {
    id: 'room-1',
    title: 'Contact Management',
    expanded: true,
    color: '#fff',
    kind: 'problem',
    x: 0,
    y: 0,
    width: 280,
    height: 180,
    ...overrides,
  }
}

function briefSpec(): BriefSpec {
  return {
    id: 'brief-1',
    creative: {
      mission: 'Give Stephanie instant access to her contacts.',
      beneficiary: 'Stephanie, real estate agent.',
      references: [],
    },
    execution: {
      task: 'Build a contact list with search and notes.',
      acceptanceCriteria: [{ id: 'ac-1', description: 'Search returns results in < 300ms' }],
      scope: { in: ['contacts', 'search'], out: ['email integration'] },
      projectStructure: ['src/', 'src/app/', 'src/app/contact/page.tsx'],
      antiPatterns: ['Desktop-first UI'],
      deliverables: ['Contact list screen'],
    },
    escalationPolicy: 'outcome-contradiction-only',
    autonomyPolicy: 'full-auto',
  }
}

describe('compileBriefPacket', () => {
  it('returns null when the card has no briefSpec', () => {
    expect(compileBriefPacket(card(), 'room-1')).toBeNull()
  })

  it('compiles a BriefPacket from a card with a briefSpec', () => {
    const packet = compileBriefPacket(card({ briefSpec: briefSpec(), briefVersion: 2 }), 'room-1')
    expect(packet).not.toBeNull()
    expect(packet!.roomId).toBe('room-1')
    expect(packet!.briefVersion).toBe(2)
    expect(packet!.briefHash).toBeTruthy()
    expect(packet!.compiledAt).toBeTruthy()
    expect(packet!.creative.mission).toContain('Stephanie')
    expect(packet!.execution.task).toContain('contact list')
    expect(packet!.execution.projectStructure).toEqual(['src/', 'src/app/', 'src/app/contact/page.tsx'])
    expect(packet!.escalationPolicy).toBe('outcome-contradiction-only')
    expect(packet!.autonomyPolicy).toBe('full-auto')
  })

  it('defaults briefVersion to 1 when not set on the card', () => {
    const packet = compileBriefPacket(card({ briefSpec: briefSpec() }), 'room-1')
    expect(packet!.briefVersion).toBe(1)
  })

  it('produces the same hash for the same briefSpec content', () => {
    const spec = briefSpec()
    const p1 = compileBriefPacket(card({ briefSpec: spec }), 'room-1')
    const p2 = compileBriefPacket(card({ briefSpec: spec }), 'room-1')
    expect(p1!.briefHash).toBe(p2!.briefHash)
  })

  it('produces a different hash when briefSpec content changes', () => {
    const spec1 = briefSpec()
    const spec2 = { ...briefSpec(), creative: { ...briefSpec().creative, mission: 'Different mission.' } }
    const p1 = compileBriefPacket(card({ briefSpec: spec1 }), 'room-1')
    const p2 = compileBriefPacket(card({ briefSpec: spec2 }), 'room-1')
    expect(p1!.briefHash).not.toBe(p2!.briefHash)
  })

  it('BriefPacket does not include the briefSpec id — it is a snapshot, not a reference', () => {
    const packet = compileBriefPacket(card({ briefSpec: briefSpec() }), 'room-1')
    expect((packet as Record<string, unknown>).id).toBeUndefined()
  })
})

describe('bumpBriefVersion', () => {
  it('increments briefVersion by 1', () => {
    expect(bumpBriefVersion(card({ briefVersion: 3 })).briefVersion).toBe(4)
  })

  it('initialises to 1 when briefVersion is not set', () => {
    expect(bumpBriefVersion(card()).briefVersion).toBe(1)
  })
})

function ledgerEntry(overrides: Partial<RunLedgerEntry> = {}): RunLedgerEntry {
  return {
    runId: 'run-1',
    contractId: 'contract-1',
    roomId: 'room-1',
    title: 'Run 1',
    status: 'complete',
    startedAt: '2026-04-18T00:00:00Z',
    artifacts: [],
    ...overrides,
  }
}

describe('detectBriefHashDrift', () => {
  it('returns false when card has no briefSpec', () => {
    const c = card({ runLedger: [ledgerEntry({ briefHash: 'abc' })] })
    expect(detectBriefHashDrift(c)).toBe(false)
  })

  it('returns false when runLedger is empty', () => {
    const c = card({ briefSpec: briefSpec(), runLedger: [] })
    expect(detectBriefHashDrift(c)).toBe(false)
  })

  it('returns false when runLedger is absent', () => {
    const c = card({ briefSpec: briefSpec() })
    expect(detectBriefHashDrift(c)).toBe(false)
  })

  it('returns false when latest run has no briefHash', () => {
    const c = card({ briefSpec: briefSpec(), runLedger: [ledgerEntry()] })
    expect(detectBriefHashDrift(c)).toBe(false)
  })

  it('returns false when hashes match', () => {
    // Compile a packet to get the real hash, then use that hash in the ledger.
    const spec = briefSpec()
    const packet = compileBriefPacket(card({ briefSpec: spec }), 'room-1')!
    const c = card({ briefSpec: spec, runLedger: [ledgerEntry({ briefHash: packet.briefHash })] })
    expect(detectBriefHashDrift(c)).toBe(false)
  })

  it('returns true when brief was edited after the run recorded its hash', () => {
    const spec = briefSpec()
    const packet = compileBriefPacket(card({ briefSpec: spec }), 'room-1')!
    // Simulate editing the brief after the run was recorded.
    const editedSpec = { ...spec, creative: { ...spec.creative, mission: 'Changed mission.' } }
    const c = card({ briefSpec: editedSpec, runLedger: [ledgerEntry({ briefHash: packet.briefHash })] })
    expect(detectBriefHashDrift(c)).toBe(true)
  })
})

describe('getBriefDriftInfo', () => {
  it('returns currentHash null and runHash null when card has no briefSpec or runs', () => {
    const info = getBriefDriftInfo(card())
    expect(info.currentHash).toBeNull()
    expect(info.runHash).toBeNull()
    expect(info.hasDrift).toBe(false)
  })

  it('returns currentHash and runHash null when card has briefSpec but no runs', () => {
    const info = getBriefDriftInfo(card({ briefSpec: briefSpec() }))
    expect(info.currentHash).toBeTruthy()
    expect(info.runHash).toBeNull()
    expect(info.hasDrift).toBe(false)
  })

  it('returns both hashes and hasDrift false when hashes match', () => {
    const spec = briefSpec()
    const packet = compileBriefPacket(card({ briefSpec: spec }), 'room-1')!
    const c = card({ briefSpec: spec, runLedger: [ledgerEntry({ briefHash: packet.briefHash })] })
    const info = getBriefDriftInfo(c)
    expect(info.currentHash).toBe(packet.briefHash)
    expect(info.runHash).toBe(packet.briefHash)
    expect(info.hasDrift).toBe(false)
  })

  it('returns both hashes and hasDrift true when brief was edited', () => {
    const spec = briefSpec()
    const packet = compileBriefPacket(card({ briefSpec: spec }), 'room-1')!
    const editedSpec = { ...spec, creative: { ...spec.creative, mission: 'Different mission.' } }
    const c = card({ briefSpec: editedSpec, runLedger: [ledgerEntry({ briefHash: packet.briefHash })] })
    const info = getBriefDriftInfo(c)
    expect(info.currentHash).not.toBe(packet.briefHash)
    expect(info.runHash).toBe(packet.briefHash)
    expect(info.hasDrift).toBe(true)
  })
})
