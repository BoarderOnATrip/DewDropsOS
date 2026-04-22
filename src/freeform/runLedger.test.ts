import { describe, expect, it } from 'vitest'
import type { ButlerSwarmRun } from '../lib/butlerBridge'
import type { RuntimeSessionArtifact } from '../lib/runtimeSessionTypes'
import type { BriefPacket } from './briefSpec'
import {
  buildDewDropRunLedgerEntry,
  buildRunLedgerEntry,
  setRunPendingArtifactsStatus,
  updateRunArtifactStatus,
  upsertRunLedgerEntry,
} from './runLedger'
import type { RunLedgerEntry, SelfEvaluation, WorkflowCard } from './types'

function run(overrides: Partial<ButlerSwarmRun> = {}): ButlerSwarmRun {
  return {
    id: 'run-1',
    run_id: 'run-abc',
    contract_id: 'contract-1',
    room_id: 'room-1',
    title: 'Research sweep',
    status: 'completed',
    created_at: '2026-01-01T00:00:00.000Z',
    launched_at: '2026-01-01T00:01:00.000Z',
    completed_at: '2026-01-01T00:05:00.000Z',
    ...overrides,
  }
}

function briefPacket(overrides: Partial<BriefPacket> = {}): BriefPacket {
  return {
    briefVersion: 3,
    briefHash: 'hash-123',
    compiledAt: '2026-01-01T00:00:00.000Z',
    roomId: 'room-1',
    creative: {
      mission: 'Ship the room.',
      beneficiary: 'Stephanie',
      references: [],
    },
    execution: {
      task: 'Finish the room.',
      acceptanceCriteria: [{ id: 'ac-1', description: 'The room ships.' }],
      scope: { in: ['build'], out: ['rewrite'] },
      antiPatterns: [],
      deliverables: ['room'],
    },
    escalationPolicy: 'outcome-contradiction-only',
    autonomyPolicy: 'full-auto',
    ...overrides,
  }
}

function selfEvaluation(overrides: Partial<SelfEvaluation> = {}): SelfEvaluation {
  return {
    alignmentSummary: 'Implemented the core room.',
    criteriaChecks: [
      {
        criterionId: 'ac-1',
        met: false,
        evidence: 'UI is live but verification remains.',
        confidence: 'medium',
      },
    ],
    allCriteriaMet: false,
    criteriaCovered: [],
    criteriaRemaining: ['ac-1'],
    nextAction: 'Run the final verification sweep.',
    escalationReason: null,
    assumptions: ['Used the existing local store wiring.'],
    handoffNotes: 'Verifier should run the acceptance pass.',
    ...overrides,
  }
}

function dewdropAgent(overrides: Partial<WorkflowCard> = {}): WorkflowCard {
  return {
    id: 'agent-1',
    title: 'Builder',
    expanded: true,
    color: '#0f0',
    kind: 'agent',
    x: 0,
    y: 0,
    width: 180,
    height: 120,
    assignedToProblemId: 'room-1',
    parentAgentId: null,
    agentRuntime: {
      kind: 'terminal',
      profile: 'hermes',
      transport: 'cli',
      instanceLabel: 'builder',
      command: 'hermes',
      workspaceRoot: '/tmp/project',
      sessionState: {
        status: 'done',
        sessionId: 'session-1',
        startedAt: '2026-01-01T00:00:00.000Z',
        lastHeartbeatAt: '2026-01-01T00:10:00.000Z',
        currentTask: 'hermes',
        outputVersion: 3,
        terminalBuffer: 'build complete\nall green',
        logTail: ['build complete', 'all green'],
      },
    },
    ...overrides,
  }
}

describe('buildRunLedgerEntry', () => {
  it('builds an entry from a completed run with a summary', () => {
    const entry = buildRunLedgerEntry(run({ summary: 'Found 3 relevant papers.' }))
    expect(entry.runId).toBe('run-abc')
    expect(entry.contractId).toBe('contract-1')
    expect(entry.roomId).toBe('room-1')
    expect(entry.status).toBe('completed')
    expect(entry.startedAt).toBe('2026-01-01T00:01:00.000Z')
    expect(entry.completedAt).toBe('2026-01-01T00:05:00.000Z')
    expect(entry.artifacts).toHaveLength(1)
    expect(entry.artifacts[0]?.kind).toBe('note')
    expect(entry.artifacts[0]?.summary).toBe('Found 3 relevant papers.')
  })

  it('materialises a full report artifact when report content is present', () => {
    const entry = buildRunLedgerEntry(run({ summary: 'Synthesis complete.' }), {
      report: {
        run_id: 'run-abc',
        report_path: '/reports/run-abc.md',
        exists: true,
        content: '# Report\n\nDetailed findings here.',
      },
    })
    expect(entry.artifacts[0]?.kind).toBe('report')
    expect(entry.artifacts[0]?.content).toBe('# Report\n\nDetailed findings here.')
  })

  it('captures agent result summaries as additional note artifacts', () => {
    const entry = buildRunLedgerEntry(
      run({
        summary: 'Run complete.',
        agent_states: [
          { agent_id: 'a1', title: 'Researcher', result_summary: 'Found 5 sources.' },
          { agent_id: 'a2', title: 'Synthesizer', result_summary: 'Written synthesis.' },
        ],
      }),
    )
    expect(entry.artifacts.length).toBeGreaterThanOrEqual(3)
    const titles = entry.artifacts.map((a) => a.title)
    expect(titles).toContain('Researcher result')
    expect(titles).toContain('Synthesizer result')
  })

  it('stores profile and recipe ids on the entry', () => {
    const entry = buildRunLedgerEntry(run(), {
      capabilityProfileId: 'build-local',
      swarmRecipeId: 'build-review-ship',
    })
    expect(entry.capabilityProfileId).toBe('build-local')
    expect(entry.swarmRecipeId).toBe('build-review-ship')
  })

  it('produces no artifacts for a run with no summary or agent results', () => {
    const entry = buildRunLedgerEntry(run({ summary: undefined }))
    expect(entry.artifacts).toHaveLength(0)
  })

  it('captures the brief snapshot and self-evaluation when present', () => {
    const entry = buildRunLedgerEntry(run({ summary: 'Run complete.' }), {
      briefPacket: briefPacket(),
      briefSpecId: 'brief-1',
      report: {
        run_id: 'run-abc',
        report_path: '/reports/run-abc.md',
        exists: true,
        content: '# Report',
        selfEvaluation: selfEvaluation(),
      },
    })

    expect(entry.briefSpecId).toBe('brief-1')
    expect(entry.briefVersion).toBe(3)
    expect(entry.briefHash).toBe('hash-123')
    expect(entry.selfEvaluation?.assumptions).toEqual(['Used the existing local store wiring.'])
    expect(entry.continuationDecision).toBe('continue')
    expect(entry.artifacts[0]?.status).toBe('provisional')
  })

  it('preserves stored brief metadata when a later sync lacks it', () => {
    const existing = buildRunLedgerEntry(run({ summary: 'First pass.' }), {
      briefPacket: briefPacket(),
      briefSpecId: 'brief-1',
    })

    const entry = buildRunLedgerEntry(run({ summary: 'Second pass.' }), {
      existingEntry: existing,
    })

    expect(entry.briefSpecId).toBe('brief-1')
    expect(entry.briefVersion).toBe(3)
    expect(entry.briefHash).toBe('hash-123')
  })

  it('preserves artifact acceptance state across resyncs', () => {
    const existing = buildRunLedgerEntry(run({ summary: 'First pass.' }))
    existing.artifacts[0] = {
      ...existing.artifacts[0]!,
      status: 'accepted',
    }

    const entry = buildRunLedgerEntry(run({ summary: 'First pass.' }), {
      existingEntry: existing,
    })

    expect(entry.artifacts[0]?.status).toBe('accepted')
  })

  it('preserves a richer report artifact when a later sync lacks report content', () => {
    const existing = buildRunLedgerEntry(run({ summary: 'Synthesis complete.' }), {
      report: {
        run_id: 'run-abc',
        report_path: '/reports/run-abc.md',
        exists: true,
        content: '# Report\n\nDetailed findings here.',
      },
    })

    const entry = buildRunLedgerEntry(run({ summary: 'Synthesis complete.' }), {
      existingEntry: existing,
    })

    expect(entry.artifacts.some((artifact) => artifact.kind === 'report')).toBe(true)
    expect(entry.artifacts.find((artifact) => artifact.kind === 'report')?.content).toContain('Detailed findings')
  })
})

describe('buildDewDropRunLedgerEntry', () => {
  it('materializes a DewDrop return into note and transcript artifacts', () => {
    const entry = buildDewDropRunLedgerEntry(dewdropAgent(), {
      roomId: 'room-1',
    })

    expect(entry.runId).toBe('dewdrop-session-1')
    expect(entry.contractId).toBe('dewdrop:agent-1')
    expect(entry.title).toBe('Builder return')
    expect(entry.status).toBe('done')
    expect(entry.artifacts).toHaveLength(2)
    expect(entry.artifacts[0]?.title).toBe('Builder return summary')
    expect(entry.artifacts[0]?.summary).toContain('Builder returned from hermes')
    expect(entry.artifacts[1]?.title).toBe('Builder transcript')
    expect(entry.artifacts[1]?.content).toContain('# Builder return')
    expect(entry.artifacts[1]?.content).toContain('build complete')
  })

  it('includes returned browser and Playwright files as room artifacts', () => {
    const runtimeArtifacts: RuntimeSessionArtifact[] = [
      {
        id: 'playwright-html-report',
        kind: 'report',
        title: 'Playwright HTML report',
        summary: '.dewdrops-artifacts/agent-1/playwright-report/index.html • 1024 bytes',
        path: '.dewdrops-artifacts/agent-1/playwright-report/index.html',
        mimeType: 'text/html',
        sizeBytes: 1024,
      },
      {
        id: 'failure-shot',
        kind: 'image',
        title: 'Screenshot failure.png',
        summary: '.dewdrops-artifacts/agent-1/test-results/failure.png • 256 bytes',
        path: '.dewdrops-artifacts/agent-1/test-results/failure.png',
        mimeType: 'image/png',
        sizeBytes: 256,
      },
    ]

    const entry = buildDewDropRunLedgerEntry(
      dewdropAgent({
        agentRuntime: {
          ...dewdropAgent().agentRuntime!,
          profile: 'playwright',
          command: 'npx playwright test',
        },
      }),
      {
        roomId: 'room-1',
        runtimeArtifacts,
      },
    )

    expect(entry.artifacts).toHaveLength(4)
    expect(entry.artifacts[0]?.summary).toContain('2 artifacts returned')
    expect(entry.artifacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'report',
          title: 'Playwright HTML report',
          path: '.dewdrops-artifacts/agent-1/playwright-report/index.html',
          mimeType: 'text/html',
        }),
        expect.objectContaining({
          kind: 'image',
          path: '.dewdrops-artifacts/agent-1/test-results/failure.png',
          sizeBytes: 256,
        }),
      ]),
    )
  })
})

describe('upsertRunLedgerEntry', () => {
  function entry(runId: string, title: string): RunLedgerEntry {
    return {
      runId,
      contractId: 'c1',
      roomId: 'r1',
      title,
      status: 'completed',
      startedAt: '2026-01-01T00:00:00.000Z',
      artifacts: [],
    }
  }

  it('prepends a new entry to an empty ledger', () => {
    const ledger = upsertRunLedgerEntry(undefined, entry('run-1', 'First'))
    expect(ledger).toHaveLength(1)
    expect(ledger[0]?.runId).toBe('run-1')
  })

  it('prepends a new entry to an existing ledger', () => {
    const existing = [entry('run-1', 'First')]
    const ledger = upsertRunLedgerEntry(existing, entry('run-2', 'Second'))
    expect(ledger).toHaveLength(2)
    expect(ledger[0]?.runId).toBe('run-2')
  })

  it('replaces an existing entry with the same runId', () => {
    const existing = [entry('run-1', 'First'), entry('run-2', 'Second')]
    const updated = { ...entry('run-1', 'First updated'), status: 'failed' }
    const ledger = upsertRunLedgerEntry(existing, updated)
    expect(ledger).toHaveLength(2)
    expect(ledger.find((e) => e.runId === 'run-1')?.status).toBe('failed')
  })
})

describe('updateRunArtifactStatus', () => {
  it('updates a single artifact without changing other runs', () => {
    const ledger: RunLedgerEntry[] = [
      {
        runId: 'run-1',
        contractId: 'c1',
        roomId: 'r1',
        title: 'First',
        status: 'completed',
        startedAt: '2026-01-01T00:00:00.000Z',
        artifacts: [
          {
            id: 'artifact-1',
            runId: 'run-1',
            kind: 'report',
            title: 'Launch report',
            summary: 'First pass.',
            createdAt: '2026-01-01T00:05:00.000Z',
            status: 'provisional',
          },
        ],
      },
      {
        runId: 'run-2',
        contractId: 'c2',
        roomId: 'r1',
        title: 'Second',
        status: 'completed',
        startedAt: '2026-01-01T00:10:00.000Z',
        artifacts: [
          {
            id: 'artifact-2',
            runId: 'run-2',
            kind: 'note',
            title: 'Second note',
            summary: 'Unchanged.',
            createdAt: '2026-01-01T00:12:00.000Z',
            status: 'provisional',
          },
        ],
      },
    ]

    const updated = updateRunArtifactStatus(ledger, 'run-1', 'artifact-1', 'accepted')

    expect(updated[0]?.artifacts[0]?.status).toBe('accepted')
    expect(updated[1]?.artifacts[0]?.status).toBe('provisional')
  })
})

describe('setRunPendingArtifactsStatus', () => {
  it('updates only provisional artifacts on the selected run', () => {
    const ledger: RunLedgerEntry[] = [
      {
        runId: 'run-1',
        contractId: 'c1',
        roomId: 'r1',
        title: 'First',
        status: 'completed',
        startedAt: '2026-01-01T00:00:00.000Z',
        artifacts: [
          {
            id: 'artifact-1',
            runId: 'run-1',
            kind: 'report',
            title: 'Launch report',
            summary: 'First pass.',
            createdAt: '2026-01-01T00:05:00.000Z',
            status: 'provisional',
          },
          {
            id: 'artifact-2',
            runId: 'run-1',
            kind: 'note',
            title: 'Accepted note',
            summary: 'Already reviewed.',
            createdAt: '2026-01-01T00:06:00.000Z',
            status: 'accepted',
          },
        ],
      },
      {
        runId: 'run-2',
        contractId: 'c2',
        roomId: 'r1',
        title: 'Second',
        status: 'completed',
        startedAt: '2026-01-01T00:10:00.000Z',
        artifacts: [
          {
            id: 'artifact-3',
            runId: 'run-2',
            kind: 'note',
            title: 'Second note',
            summary: 'Unchanged.',
            createdAt: '2026-01-01T00:12:00.000Z',
            status: 'provisional',
          },
        ],
      },
    ]

    const updated = setRunPendingArtifactsStatus(ledger, 'run-1', 'rejected')

    expect(updated[0]?.artifacts[0]?.status).toBe('rejected')
    expect(updated[0]?.artifacts[1]?.status).toBe('accepted')
    expect(updated[1]?.artifacts[0]?.status).toBe('provisional')
  })
})
