import { describe, expect, it } from 'vitest'
import type { BoardWire, RunLedgerEntry, SelfEvaluation, WorkflowCard } from '../freeform/types'
import type { BriefSpec } from '../freeform/briefSpec'
import { buildWorldShellData } from './worldShellModel'
import { buildWorkspaceWorldGraph } from './workspaceWorld'

function problem(overrides: Partial<WorkflowCard> = {}): WorkflowCard {
  return {
    id: 'problem-1',
    title: 'Launch Garden',
    expanded: true,
    color: '#fff',
    kind: 'problem',
    x: 0,
    y: 0,
    width: 280,
    height: 180,
    mission: 'Ship the next DewDrops Swarm OS slice.',
    memoryContextSummary: 'Keep launch context and operator intent visible.',
    preferredLaunchSurface: 'hybrid',
    openQuestions: [],
    ...overrides,
  }
}

function selfEval(overrides: Partial<SelfEvaluation> = {}): SelfEvaluation {
  return {
    alignmentSummary: 'Built the initial pass.',
    criteriaChecks: [],
    allCriteriaMet: false,
    criteriaCovered: [],
    criteriaRemaining: [],
    nextAction: null,
    escalationReason: null,
    assumptions: [],
    handoffNotes: '',
    ...overrides,
  }
}

function ledgerEntry(overrides: Partial<RunLedgerEntry> = {}): RunLedgerEntry {
  return {
    runId: 'run-1',
    contractId: 'contract-1',
    roomId: 'problem-1',
    title: 'Research sweep',
    status: 'completed',
    startedAt: '2026-01-01T00:01:00.000Z',
    completedAt: '2026-01-01T00:05:00.000Z',
    artifacts: [],
    ...overrides,
  }
}

function worldShellData(cards: WorkflowCard[]) {
  const graph = buildWorkspaceWorldGraph('Test workspace', cards)
  return buildWorldShellData(graph, {
    workspaceName: 'Test workspace',
    cards,
    selectedProjectionId: 'earth',
  })
}

function earthSections(cards: WorkflowCard[]) {
  return worldShellData(cards).activeProjection.detailSections ?? []
}

function agent(overrides: Partial<WorkflowCard> = {}): WorkflowCard {
  return {
    id: 'agent-1',
    title: 'Agent',
    expanded: true,
    color: '#0f0',
    kind: 'agent',
    x: 0,
    y: 0,
    width: 120,
    height: 44,
    assignedToProblemId: 'problem-2',
    parentAgentId: null,
    ...overrides,
  }
}

describe('buildWorldShellData', () => {
  it('maps the generated workspace world graph into room cards and detail', () => {
    const wires: BoardWire[] = [{ id: 'wire-1', fromCardId: 'problem-1', toCardId: 'problem-2' }]
    const graph = buildWorkspaceWorldGraph(
      'Primary workspace',
      [
        problem(),
        problem({
          id: 'problem-2',
          title: 'Phone Relay',
          phoneRelayBrief: 'Keep phone approvals tight.',
          openQuestions: ['Need iPhone shell.'],
        }),
        agent(),
      ],
      wires,
    )

    const data = buildWorldShellData(graph, {
      workspaceName: 'Primary workspace',
      cards: [
        problem(),
        problem({
          id: 'problem-2',
          title: 'Phone Relay',
          phoneRelayBrief: 'Keep phone approvals tight.',
          openQuestions: ['Need iPhone shell.'],
        }),
        agent(),
      ],
      focusedProblemId: 'problem-2',
      selectedProjectionId: 'packet',
      selectedFocusRef: {
        kind: 'locus',
        id: 'problem-2-locus-phone-checkpoint',
      },
    })

    expect(data.title).toBe('Primary workspace')
    expect(data.hierarchy.earth).toBe('Planet Earth')
    expect(data.hierarchy.wing).toBe('Primary workspace')
    expect(data.hierarchy.room).toBe('Phone Relay')
    expect(data.selectedRoomId).toBe('problem-2')
    expect(data.projectionChips).toHaveLength(6)
    expect(data.selectedDrillStageId).toBe('locus')
    expect(data.selectedLocusId).toBe('problem-2-locus-phone-checkpoint')
    expect(data.drillStages.map((stage) => stage.label)).toEqual(['Earth', 'Wing', 'Room', 'Locus'])
    expect(data.selectedClosetId).toBe('projection-packet')
    expect(data.closetCards.map((closet) => closet.title)).toEqual(
      expect.arrayContaining(['Packet closet', 'Briefcase', 'Anchor closet']),
    )
    expect(data.activeProjection.id).toBe('packet')
    expect(data.activeProjection.modeLabel).toBe('Packet')
    expect(data.activeProjection.breadcrumb).toEqual([
      'Primary workspace',
      'Primary workspace',
      'Phone Relay',
      'Phone relay checkpoint',
    ])
    expect(data.activeProjection.breadcrumbItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'Planet Earth',
          drillStageId: 'earth',
        }),
        expect.objectContaining({
          label: 'Phone Relay',
          focusRef: { kind: 'room', id: 'problem-2' },
        }),
        expect.objectContaining({
          label: 'Phone relay checkpoint',
          focusRef: { kind: 'locus', id: 'problem-2-locus-phone-checkpoint' },
        }),
      ]),
    )
    expect(data.activeProjection.returnVectors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'Planet Earth',
          drillStageId: 'earth',
        }),
        expect.objectContaining({
          label: 'Phone Relay',
          focusRef: { kind: 'room', id: 'problem-2' },
        }),
        expect.objectContaining({
          label: 'Phone relay checkpoint',
          focusRef: { kind: 'locus', id: 'problem-2-locus-phone-checkpoint' },
        }),
      ]),
    )
    expect(
      data.activeProjection.detailSections?.find((section) => section.title === 'Relay packet')?.items,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: expect.stringContaining('focus_locus: Phone relay checkpoint'),
          focusRef: { kind: 'locus', id: 'problem-2-locus-phone-checkpoint' },
        }),
        expect.objectContaining({
          label: 'ls:hybrid',
        }),
      ]),
    )
    expect(
      data.activeProjection.detailSections?.find((section) => section.title === 'Source refs')?.items,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'problem-2',
          focusRef: { kind: 'room', id: 'problem-2' },
        }),
        expect.objectContaining({
          label: expect.stringContaining('phone-relay'),
          focusRef: { kind: 'wing', id: 'wing-primary-workspace' },
        }),
      ]),
    )
    expect(data.roomCards?.[1]).toEqual(
      expect.objectContaining({
        id: 'problem-2',
        tone: 'attention',
        meta: expect.arrayContaining(['Hybrid', '1 actors']),
      }),
    )
    expect(data.roomPreview).toEqual(
      expect.objectContaining({
        title: 'Phone Relay',
        surfaceLabel: 'Hybrid',
        openQuestionLabels: ['Need iPhone shell.'],
        tunnelLabels: expect.arrayContaining(['context tunnel']),
        actorItems: expect.arrayContaining([
          expect.objectContaining({
            label: 'Agent',
            focusRef: { kind: 'agent', id: 'agent-1' },
          }),
        ]),
        tunnelItems: expect.arrayContaining([
          expect.objectContaining({
            label: 'context tunnel -> Launch Garden',
            focusRef: { kind: 'room', id: 'problem-1' },
          }),
        ]),
      }),
    )
    expect(data.locusPreview).toEqual(
      expect.objectContaining({
        title: 'Phone relay checkpoint',
        kindLabel: 'Console',
        actorItems: expect.arrayContaining([
          expect.objectContaining({
            label: 'Agent',
            focusRef: { kind: 'agent', id: 'agent-1' },
          }),
        ]),
      }),
    )
  })
})

describe('run monitor (earth projection)', () => {
  it('shows no run monitor sections when no runs exist', () => {
    const sections = earthSections([problem()])
    const monitorSections = sections.filter((s) => s.id.startsWith('run-monitor-'))
    expect(monitorSections).toHaveLength(0)
  })

  it('surfaces an active run when the status indicates in-flight work', () => {
    const cards = [
      problem({
        runLedger: [ledgerEntry({ status: 'running', completedAt: undefined })],
      }),
    ]
    const sections = earthSections(cards)
    const active = sections.find((s) => s.id === 'run-monitor-active')
    expect(active).toBeDefined()
    expect(active?.tone).toBe('ready')
    expect(active?.items).toBeDefined()
    expect(active!.items!.some((item) => item.label.includes('Launch Garden'))).toBe(true)
  })

  it('surfaces an escalation when the self-eval carries an escalation reason', () => {
    const cards = [
      problem({
        runLedger: [
          ledgerEntry({
            status: 'completed',
            completedAt: '2026-01-01T00:05:00.000Z',
            selfEvaluation: selfEval({ escalationReason: 'Brief says offline-first but requires a live API.' }),
            continuationDecision: 'escalate',
          }),
        ],
      }),
    ]
    const sections = earthSections(cards)
    const escalation = sections.find((s) => s.id === 'run-monitor-escalations')
    expect(escalation).toBeDefined()
    expect(escalation?.tone).toBe('attention')
    expect(escalation?.items).toBeDefined()
    expect(escalation!.items!.some((item) => item.label.includes('Launch Garden'))).toBe(true)
  })

  it('surfaces an acceptance queue item when a complete run has provisional artifacts', () => {
    const cards = [
      problem({
        runLedger: [
          ledgerEntry({
            status: 'completed',
            completedAt: '2026-01-01T00:05:00.000Z',
            continuationDecision: 'complete',
            artifacts: [
              {
                id: 'artifact-1',
                runId: 'run-1',
                kind: 'report',
                title: 'Final report',
                summary: 'The room shipped.',
                createdAt: '2026-01-01T00:05:00.000Z',
                status: 'provisional',
              },
            ],
          }),
        ],
      }),
    ]
    const sections = earthSections(cards)
    const acceptance = sections.find((s) => s.id === 'run-monitor-acceptance')
    expect(acceptance).toBeDefined()
    expect(acceptance?.tone).toBe('attention')
    expect(acceptance?.items).toBeDefined()
    expect(acceptance!.items!.some((item) => item.label.includes('1 provisional artifact'))).toBe(true)
  })

  it('does not put an escalated run into the acceptance queue', () => {
    const cards = [
      problem({
        runLedger: [
          ledgerEntry({
            status: 'completed',
            completedAt: '2026-01-01T00:05:00.000Z',
            selfEvaluation: selfEval({ escalationReason: 'Contradiction.' }),
            continuationDecision: 'escalate',
            artifacts: [
              {
                id: 'artifact-1',
                runId: 'run-1',
                kind: 'note',
                title: 'Note',
                summary: 'Some note.',
                createdAt: '2026-01-01T00:05:00.000Z',
                status: 'provisional',
              },
            ],
          }),
        ],
      }),
    ]
    const sections = earthSections(cards)
    expect(sections.find((s) => s.id === 'run-monitor-acceptance')).toBeUndefined()
    expect(sections.find((s) => s.id === 'run-monitor-escalations')).toBeDefined()
  })

  it('surfaces criteria coverage when the self-eval has checked criteria', () => {
    const cards = [
      problem({
        runLedger: [
          ledgerEntry({
            status: 'completed',
            completedAt: '2026-01-01T00:05:00.000Z',
            selfEvaluation: selfEval({
              criteriaChecks: [
                { criterionId: 'ac-1', met: true, evidence: 'Search is fast.', confidence: 'high' },
                { criterionId: 'ac-2', met: false, evidence: 'Notes flow incomplete.', confidence: 'medium' },
              ],
            }),
          }),
        ],
      }),
    ]
    const sections = earthSections(cards)
    const coverage = sections.find((s) => s.id === 'run-monitor-coverage')
    expect(coverage).toBeDefined()
    expect(coverage?.tone).toBe('calm')
    expect(coverage?.items).toBeDefined()
    expect(coverage!.items!.some((item) => item.label.includes('1/2 criteria covered'))).toBe(true)
  })

  it('aggregates runs across multiple rooms', () => {
    const cards = [
      problem({
        id: 'problem-1',
        title: 'Room A',
        runLedger: [ledgerEntry({ status: 'running', completedAt: undefined, roomId: 'problem-1' })],
      }),
      problem({
        id: 'problem-2',
        title: 'Room B',
        runLedger: [
          ledgerEntry({
            runId: 'run-2',
            roomId: 'problem-2',
            status: 'completed',
            completedAt: '2026-01-01T00:05:00.000Z',
            selfEvaluation: selfEval({ escalationReason: 'Outcome contradiction.' }),
            continuationDecision: 'escalate',
          }),
        ],
      }),
    ]
    const sections = earthSections(cards)
    const active = sections.find((s) => s.id === 'run-monitor-active')
    const escalation = sections.find((s) => s.id === 'run-monitor-escalations')
    expect(active?.items).toBeDefined()
    expect(escalation?.items).toBeDefined()
    expect(active!.items!.some((item) => item.label.includes('Room A'))).toBe(true)
    expect(escalation!.items!.some((item) => item.label.includes('Room B'))).toBe(true)
  })

  it('omits accepted artifacts from the acceptance queue', () => {
    const cards = [
      problem({
        runLedger: [
          ledgerEntry({
            status: 'completed',
            completedAt: '2026-01-01T00:05:00.000Z',
            continuationDecision: 'complete',
            artifacts: [
              {
                id: 'artifact-1',
                runId: 'run-1',
                kind: 'report',
                title: 'Final report',
                summary: 'Accepted already.',
                createdAt: '2026-01-01T00:05:00.000Z',
                status: 'accepted',
              },
            ],
          }),
        ],
      }),
    ]
    const sections = earthSections(cards)
    expect(sections.find((s) => s.id === 'run-monitor-acceptance')).toBeUndefined()
  })
})

function briefSpec(overrides: Partial<BriefSpec> = {}): BriefSpec {
  return {
    id: 'brief-1',
    creative: {
      mission: 'Ship the feature.',
      beneficiary: 'End user',
      references: [],
    },
    execution: {
      task: 'Build and test the feature.',
      acceptanceCriteria: [
        { id: 'ac-1', description: 'Search returns results in < 200ms' },
        { id: 'ac-2', description: 'Notes flow saves without errors' },
      ],
      scope: { in: [], out: [] },
      antiPatterns: [],
      deliverables: [],
    },
    escalationPolicy: 'outcome-contradiction-only',
    autonomyPolicy: 'full-auto',
    ...overrides,
  }
}

function roomSections(cards: WorkflowCard[]) {
  const graph = buildWorkspaceWorldGraph('Test workspace', cards)
  return (
    buildWorldShellData(graph, {
      workspaceName: 'Test workspace',
      cards,
      selectedProjectionId: 'room',
      focusedProblemId: cards[0]?.id ?? null,
    }).activeProjection.detailSections ?? []
  )
}

function outlineSections(cards: WorkflowCard[]) {
  const graph = buildWorkspaceWorldGraph('Test workspace', cards)
  return (
    buildWorldShellData(graph, {
      workspaceName: 'Test workspace',
      cards,
      selectedProjectionId: 'outline',
      focusedProblemId: cards[0]?.id ?? null,
    }).activeProjection.detailSections ?? []
  )
}

describe('buildBriefStatusSections — brief-missing', () => {
  it('emits brief-missing section with missing tone when no briefSpec in room mode', () => {
    const cards = [problem()]
    const sections = roomSections(cards)
    const missing = sections.find((s) => s.id === 'brief-missing')
    expect(missing).toBeDefined()
    expect(missing?.tone).toBe('missing')
    expect(missing?.copy).toContain('No brief defined')
  })

  it('emits brief-missing section in outline mode when no briefSpec', () => {
    const cards = [problem()]
    const sections = outlineSections(cards)
    const missing = sections.find((s) => s.id === 'brief-missing')
    expect(missing).toBeDefined()
    expect(missing?.tone).toBe('missing')
  })
})

describe('buildBriefStatusSections — brief criteria', () => {
  it('shows acceptance criteria as items with no prefix when no run yet', () => {
    const cards = [problem({ briefSpec: briefSpec() })]
    const sections = roomSections(cards)
    const criteria = sections.find((s) => s.id === 'brief-criteria')
    expect(criteria).toBeDefined()
    expect(criteria?.tone).toBe('calm')
    expect(criteria?.items?.some((item) => item.label.includes('Search returns results'))).toBe(true)
    expect(criteria?.items?.some((item) => item.label.includes('Notes flow saves'))).toBe(true)
    // No ✓ or · prefix when there is no run yet
    expect(criteria?.items?.every((item) => !item.label.startsWith('✓') && !item.label.startsWith('·'))).toBe(true)
  })

  it('prefixes met criteria with ✓ and unmet with · when run has criteriaChecks', () => {
    const cards = [
      problem({
        briefSpec: briefSpec(),
        runLedger: [
          ledgerEntry({
            selfEvaluation: selfEval({
              criteriaChecks: [
                { criterionId: 'ac-1', met: true, evidence: 'Fast enough.', confidence: 'high' },
                { criterionId: 'ac-2', met: false, evidence: 'Save failed intermittently.', confidence: 'medium' },
              ],
            }),
          }),
        ],
      }),
    ]
    const sections = roomSections(cards)
    const criteria = sections.find((s) => s.id === 'brief-criteria')
    expect(criteria).toBeDefined()
    expect(criteria?.items?.some((item) => item.label.startsWith('✓'))).toBe(true)
    expect(criteria?.items?.some((item) => item.label.startsWith('·'))).toBe(true)
  })

  it('uses ready tone when all criteria are met', () => {
    const cards = [
      problem({
        briefSpec: briefSpec(),
        runLedger: [
          ledgerEntry({
            selfEvaluation: selfEval({
              criteriaChecks: [
                { criterionId: 'ac-1', met: true, evidence: 'Fast.', confidence: 'high' },
                { criterionId: 'ac-2', met: true, evidence: 'Saved OK.', confidence: 'high' },
              ],
            }),
          }),
        ],
      }),
    ]
    const sections = roomSections(cards)
    const criteria = sections.find((s) => s.id === 'brief-criteria')
    expect(criteria?.tone).toBe('ready')
  })

  it('uses attention tone when any criterion is unmet', () => {
    const cards = [
      problem({
        briefSpec: briefSpec(),
        runLedger: [
          ledgerEntry({
            selfEvaluation: selfEval({
              criteriaChecks: [
                { criterionId: 'ac-1', met: true, evidence: 'Fast.', confidence: 'high' },
                { criterionId: 'ac-2', met: false, evidence: 'Broke.', confidence: 'low' },
              ],
            }),
          }),
        ],
      }),
    ]
    const sections = outlineSections(cards)
    const criteria = sections.find((s) => s.id === 'brief-criteria')
    expect(criteria?.tone).toBe('attention')
  })
})

describe('buildBriefStatusSections — continuation state', () => {
  it('surfaces continue signal with nextAction as copy', () => {
    const cards = [
      problem({
        briefSpec: briefSpec(),
        runLedger: [
          ledgerEntry({
            continuationDecision: 'continue',
            selfEvaluation: selfEval({
              nextAction: 'Finish the notes flow integration.',
              criteriaRemaining: ['ac-2'],
            }),
          }),
        ],
      }),
    ]
    const sections = roomSections(cards)
    const continuation = sections.find((s) => s.id === 'brief-continuation')
    expect(continuation).toBeDefined()
    expect(continuation?.tone).toBe('ready')
    expect(continuation?.copy).toContain('Finish the notes flow integration.')
  })

  it('surfaces escalate signal with escalation reason as copy', () => {
    const cards = [
      problem({
        briefSpec: briefSpec(),
        runLedger: [
          ledgerEntry({
            continuationDecision: 'escalate',
            selfEvaluation: selfEval({
              escalationReason: 'Brief requires offline-first but the API demands a live connection.',
            }),
          }),
        ],
      }),
    ]
    const sections = roomSections(cards)
    const continuation = sections.find((s) => s.id === 'brief-continuation')
    expect(continuation).toBeDefined()
    expect(continuation?.tone).toBe('attention')
    expect(continuation?.copy).toContain('offline-first')
  })

  it('surfaces complete signal with awaiting acceptance copy', () => {
    const cards = [
      problem({
        briefSpec: briefSpec(),
        runLedger: [
          ledgerEntry({
            continuationDecision: 'complete',
          }),
        ],
      }),
    ]
    const sections = outlineSections(cards)
    const continuation = sections.find((s) => s.id === 'brief-continuation')
    expect(continuation).toBeDefined()
    expect(continuation?.tone).toBe('calm')
    expect(continuation?.copy).toContain('Awaiting acceptance')
  })

  it('omits continuation section when no continuationDecision on latest run', () => {
    const cards = [
      problem({
        briefSpec: briefSpec(),
        runLedger: [ledgerEntry()],
      }),
    ]
    const sections = roomSections(cards)
    expect(sections.find((s) => s.id === 'brief-continuation')).toBeUndefined()
  })
})

describe('buildBriefStatusSections — handoff reasoning', () => {
  it('shows dec and why as items when parseHandoffNotes succeeds', () => {
    const cards = [
      problem({
        briefSpec: briefSpec(),
        runLedger: [
          ledgerEntry({
            selfEvaluation: selfEval({
              handoffNotes: 'dec:Used the streaming API\nwhy:Reduces latency by 40%',
            }),
          }),
        ],
      }),
    ]
    const sections = roomSections(cards)
    const handoff = sections.find((s) => s.id === 'brief-handoff')
    expect(handoff).toBeDefined()
    expect(handoff?.tone).toBe('calm')
    expect(handoff?.items?.some((item) => item.label.includes('dec:'))).toBe(true)
    expect(handoff?.items?.some((item) => item.label.includes('why:'))).toBe(true)
    expect(handoff?.items?.some((item) => item.label.includes('streaming API'))).toBe(true)
    expect(handoff?.items?.some((item) => item.label.includes('latency'))).toBe(true)
  })

  it('omits handoff section when handoffNotes is empty', () => {
    const cards = [
      problem({
        briefSpec: briefSpec(),
        runLedger: [
          ledgerEntry({
            selfEvaluation: selfEval({ handoffNotes: '' }),
          }),
        ],
      }),
    ]
    const sections = roomSections(cards)
    expect(sections.find((s) => s.id === 'brief-handoff')).toBeUndefined()
  })

  it('omits handoff section when handoffNotes lacks dec or why fields', () => {
    const cards = [
      problem({
        briefSpec: briefSpec(),
        runLedger: [
          ledgerEntry({
            selfEvaluation: selfEval({ handoffNotes: 'some: unstructured notes here' }),
          }),
        ],
      }),
    ]
    const sections = outlineSections(cards)
    expect(sections.find((s) => s.id === 'brief-handoff')).toBeUndefined()
  })
})

describe('buildDependencySatisfactionSections', () => {
  it('returns no dependencies section when dependsOn is empty', () => {
    const cards = [
      problem({
        briefSpec: briefSpec({
          execution: {
            task: 'Build the feature.',
            acceptanceCriteria: [],
            scope: { in: [], out: [] },
            antiPatterns: [],
            deliverables: [],
            dependsOn: [],
          },
        }),
      }),
    ]
    const sections = roomSections(cards)
    expect(sections.find((s) => s.id === 'brief-dependencies')).toBeUndefined()
  })

  it('returns no dependencies section when dependsOn is undefined', () => {
    const cards = [problem({ briefSpec: briefSpec() })]
    const sections = roomSections(cards)
    expect(sections.find((s) => s.id === 'brief-dependencies')).toBeUndefined()
  })

  it('shows ready tone and all-satisfied copy when all deps are complete', () => {
    const depCard = problem({
      id: 'dep-room-1',
      title: 'Dep Room A',
      runLedger: [ledgerEntry({ continuationDecision: 'complete' })],
    })
    const mainCard = problem({
      id: 'problem-1',
      title: 'Launch Garden',
      briefSpec: briefSpec({
        execution: {
          task: 'Build the feature.',
          acceptanceCriteria: [],
          scope: { in: [], out: [] },
          antiPatterns: [],
          deliverables: [],
          dependsOn: ['dep-room-1'],
        },
      }),
    })
    const sections = roomSections([mainCard, depCard])
    const dep = sections.find((s) => s.id === 'brief-dependencies')
    expect(dep).toBeDefined()
    expect(dep?.tone).toBe('ready')
    expect(dep?.copy).toBe('All 1 dependencies satisfied.')
    expect(dep?.items?.some((item) => item.label.includes('✓ complete'))).toBe(true)
  })

  it('shows ready tone when dep is satisfied via allCriteriaMet', () => {
    const depCard = problem({
      id: 'dep-room-2',
      title: 'Dep Room B',
      runLedger: [
        ledgerEntry({
          selfEvaluation: selfEval({ allCriteriaMet: true }),
        }),
      ],
    })
    const mainCard = problem({
      id: 'problem-1',
      title: 'Launch Garden',
      briefSpec: briefSpec({
        execution: {
          task: 'Build the feature.',
          acceptanceCriteria: [],
          scope: { in: [], out: [] },
          antiPatterns: [],
          deliverables: [],
          dependsOn: ['dep-room-2'],
        },
      }),
    })
    const sections = roomSections([mainCard, depCard])
    const dep = sections.find((s) => s.id === 'brief-dependencies')
    expect(dep?.tone).toBe('ready')
    expect(dep?.items?.some((item) => item.label.includes('✓ complete'))).toBe(true)
  })

  it('shows attention tone and correct copy when some deps are unsatisfied', () => {
    const depA = problem({
      id: 'dep-room-a',
      title: 'Dep Room A',
      runLedger: [ledgerEntry({ continuationDecision: 'complete' })],
    })
    const depB = problem({
      id: 'dep-room-b',
      title: 'Dep Room B',
      runLedger: [ledgerEntry({ status: 'running', completedAt: undefined })],
    })
    const mainCard = problem({
      id: 'problem-1',
      title: 'Launch Garden',
      briefSpec: briefSpec({
        execution: {
          task: 'Build the feature.',
          acceptanceCriteria: [],
          scope: { in: [], out: [] },
          antiPatterns: [],
          deliverables: [],
          dependsOn: ['dep-room-a', 'dep-room-b'],
        },
      }),
    })
    const sections = roomSections([mainCard, depA, depB])
    const dep = sections.find((s) => s.id === 'brief-dependencies')
    expect(dep).toBeDefined()
    expect(dep?.tone).toBe('attention')
    expect(dep?.copy).toBe('1 of 2 dependencies still in progress.')
    expect(dep?.items?.some((item) => item.label.includes('✓ complete'))).toBe(true)
    expect(dep?.items?.some((item) => item.label.includes('· in progress'))).toBe(true)
  })

  it('shows not-found label when a dep room id is unknown', () => {
    const mainCard = problem({
      id: 'problem-1',
      title: 'Launch Garden',
      briefSpec: briefSpec({
        execution: {
          task: 'Build the feature.',
          acceptanceCriteria: [],
          scope: { in: [], out: [] },
          antiPatterns: [],
          deliverables: [],
          dependsOn: ['ghost-room-id'],
        },
      }),
    })
    const sections = roomSections([mainCard])
    const dep = sections.find((s) => s.id === 'brief-dependencies')
    expect(dep).toBeDefined()
    expect(dep?.tone).toBe('attention')
    expect(dep?.items?.some((item) => item.label.includes('ghost-room-id') && item.label.includes('· not found'))).toBe(true)
    // No focusRef for unknown dep
    const notFoundItem = dep?.items?.find((item) => item.label.includes('· not found'))
    expect(notFoundItem?.focusRef).toBeUndefined()
  })

  it('brief-dependencies section appears in room projection mode when deps are present', () => {
    const depCard = problem({
      id: 'dep-room-1',
      title: 'Dep Room A',
      runLedger: [ledgerEntry({ continuationDecision: 'complete' })],
    })
    const mainCard = problem({
      id: 'problem-1',
      title: 'Launch Garden',
      briefSpec: briefSpec({
        execution: {
          task: 'Build the feature.',
          acceptanceCriteria: [],
          scope: { in: [], out: [] },
          antiPatterns: [],
          deliverables: [],
          dependsOn: ['dep-room-1'],
        },
      }),
    })
    const graph = buildWorkspaceWorldGraph('Test workspace', [mainCard, depCard])
    const data = buildWorldShellData(graph, {
      workspaceName: 'Test workspace',
      cards: [mainCard, depCard],
      selectedProjectionId: 'room',
      focusedProblemId: 'problem-1',
    })
    const sections = data.activeProjection.detailSections ?? []
    const dep = sections.find((s) => s.id === 'brief-dependencies')
    expect(dep).toBeDefined()
    expect(dep?.title).toBe('Dependencies')
    expect(dep?.tone).toBe('ready')
  })
})
