import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  BOARD_STORAGE_KEY,
  ACTIVE_WORKSPACE_KEY,
  buildBoardPayload,
  clearPersistedBoard,
  createPersistedWorkspace,
  deletePersistedWorkspace,
  getActiveWorkspaceId,
  listPersistedWorkspaces,
  loadPersistedBoard,
  loadPersistedWorkspace,
  parseBoardJsonString,
  parsePersistedBoardJson,
  savePersistedBoard,
  subscribeToWorkspaceStore,
  stringifyBoard,
  updatePersistedWorkspaceFocus,
} from './persistBoard'
import { clearWorkspaceStoreForTests } from './workspaceStore'

function createMemoryStorage(): Storage {
  const data = new Map<string, string>()
  return {
    get length() {
      return data.size
    },
    clear() {
      data.clear()
    },
    getItem(key: string) {
      return data.get(key) ?? null
    },
    key(index: number) {
      return Array.from(data.keys())[index] ?? null
    },
    removeItem(key: string) {
      data.delete(key)
    },
    setItem(key: string, value: string) {
      data.set(key, value)
    },
  } as Storage
}

beforeEach(() => {
  vi.stubGlobal('localStorage', createMemoryStorage())
})

afterEach(() => {
  clearWorkspaceStoreForTests()
  vi.unstubAllGlobals()
})

describe('parsePersistedBoardJson', () => {
  it('accepts a minimal valid v1 payload with terminal profile metadata', () => {
    const raw = {
      v: 1,
      camera: { x: 1, y: -2, zoom: 0.9 },
      cards: [
        {
          id: 'a1',
          x: 0,
          y: 0,
          width: 100,
          height: 80,
          title: 'Test',
          expanded: true,
          color: '#fff',
          kind: 'agent' as const,
          assignedToProblemId: null,
          agentRuntime: {
            kind: 'terminal' as const,
            profile: 'openclaw' as const,
            instanceLabel: 'agent-a1',
            command: 'openclaw',
            vpnAlias: 'agent-a1',
            transport: 'cli' as const,
            sessionPolicy: {
              allowNetwork: false,
              maxSteps: 24,
              maxRuntimeMs: 900_000,
              writableRoots: ['/tmp/agent-a1'],
              requiresApprovalFor: ['destructive', 'privileged'] as const,
            },
            sessionState: {
              status: 'idle' as const,
              logTail: ['ready'],
            },
          },
        },
      ],
      wires: [],
    }
    const p = parsePersistedBoardJson(raw)
    expect(p).not.toBeNull()
    expect(p!.camera.zoom).toBe(0.9)
    expect(p!.cards[0].title).toBe('Test')
    expect(p!.cards[0].agentRuntime).toEqual(
      expect.objectContaining({
        kind: 'terminal',
        profile: 'openclaw',
        transport: 'cli',
        instanceLabel: 'agent-a1',
        sessionPolicy: expect.objectContaining({
          allowNetwork: false,
          maxSteps: 24,
        }),
      }),
    )
    expect(p!.cards[0].agentRuntime?.sessionState).toBeUndefined()
    expect(p!.wires).toEqual([])
  })

  it('does not persist live terminal session state into saved boards', () => {
    const board = buildBoardPayload(
      { x: 0, y: 0, zoom: 1 },
      [
        {
          id: 'a1',
          x: 0,
          y: 0,
          width: 100,
          height: 80,
          title: 'Test',
          expanded: true,
          color: '#fff',
          kind: 'agent' as const,
          assignedToProblemId: null,
          agentRuntime: {
            kind: 'terminal' as const,
            profile: 'custom' as const,
            instanceLabel: 'agent-a1',
            command: 'zsh -i -f',
            vpnAlias: 'agent-a1',
            transport: 'cli' as const,
            sessionState: {
              status: 'running' as const,
              sessionId: 'session-1',
              outputVersion: 3,
              terminalBuffer: 'prompt',
            },
          },
        },
      ],
      [],
    )

    expect(board.cards[0].agentRuntime?.sessionState).toBeUndefined()
  })

  it('accepts legacy provider transport runtime payloads and normalizes them into the new runtime shape', () => {
    const raw = {
      v: 1,
      camera: { x: 0, y: 0, zoom: 1 },
      cards: [
        {
          id: 'a1',
          x: 0,
          y: 0,
          width: 100,
          height: 80,
          title: 'Legacy Agent',
          expanded: true,
          color: '#fff',
          kind: 'agent' as const,
          assignedToProblemId: null,
          agentRuntime: {
            provider: 'paperclip' as const,
            transport: 'api' as const,
            instanceLabel: 'legacy-agent',
          },
        },
      ],
      wires: [],
    }

    const parsed = parsePersistedBoardJson(raw)
    expect(parsed).not.toBeNull()
    expect(parsed!.cards[0].agentRuntime).toEqual(
      expect.objectContaining({
        kind: 'service',
        profile: 'paperclip',
        transport: 'api',
        instanceLabel: 'legacy-agent',
      }),
    )
  })

  it('round-trips structured local-model tags through persisted runtime state', () => {
    const raw = {
      v: 1,
      camera: { x: 0, y: 0, zoom: 1 },
      cards: [
        {
          id: 'a1',
          x: 0,
          y: 0,
          width: 100,
          height: 80,
          title: 'Local model',
          expanded: true,
          color: '#fff',
          kind: 'agent' as const,
          assignedToProblemId: null,
          agentRuntime: {
            kind: 'terminal' as const,
            profile: 'ollama' as const,
            instanceLabel: 'local-model-a1',
            modelTag: 'llama3.1:8b',
            command: 'ollama run llama3.1:8b',
            transport: 'cli' as const,
          },
        },
      ],
      wires: [],
    }

    const parsed = parsePersistedBoardJson(raw)
    expect(parsed).not.toBeNull()
    expect(parsed!.cards[0].agentRuntime).toEqual(
      expect.objectContaining({
        profile: 'ollama',
        modelTag: 'llama3.1:8b',
        command: 'ollama run llama3.1:8b',
      }),
    )

    const board = buildBoardPayload(parsed!.camera, parsed!.cards, parsed!.wires)
    expect(board.cards[0].agentRuntime).toEqual(
      expect.objectContaining({
        profile: 'ollama',
        modelTag: 'llama3.1:8b',
      }),
    )
  })

  it('rejects wrong version', () => {
    expect(parsePersistedBoardJson({ v: 2, camera: { x: 0, y: 0, zoom: 1 }, cards: [], wires: [] })).toBeNull()
  })

  it('rejects garbage', () => {
    expect(parsePersistedBoardJson(null)).toBeNull()
    expect(parsePersistedBoardJson({})).toBeNull()
    expect(parsePersistedBoardJson({ v: 1, camera: 'nope', cards: [], wires: [] })).toBeNull()
  })

  it('round-trips through stringifyBoard and parseBoardJsonString', () => {
    const camera = { x: 12, y: -3, zoom: 0.85 }
    const cards = [
      {
        id: 'p1',
        x: 0,
        y: 0,
        width: 200,
        height: 120,
        title: 'Problem',
        expanded: true,
        color: '#34c759',
        kind: 'problem' as const,
        problemShape: 'panel' as const,
        preferredLaunchSurface: 'hybrid' as const,
        capabilityPackId: 'relationship-memory',
        memoryWing: 'butler',
        memoryRoom: 'phone-relay',
        memoryContextSummary: 'Keep the paired phone in the loop.',
        memoryAnchors: ['compartment/phone', 'entity/tyler'],
        memoryPalaceLoci: [
          {
            id: 'north-star',
            title: 'North Star',
            kind: 'north_star' as const,
            detail: 'Keep the paired phone loop visible.',
          },
        ],
        briefCompartmentAssets: [
          {
            id: 'compartment-asset-1',
            name: 'contacts.csv',
            mimeType: 'text/csv',
            sizeBytes: 2048,
            addedAt: '2026-04-19T10:00:00.000Z',
            compartmentId: 'system:data',
            compartmentLabel: 'Data Compartment',
            compartmentKind: 'data' as const,
            anchorRef: 'compartment/data-compartment',
            extension: 'csv',
            organizeStatus: 'sorted' as const,
            organizeReason: 'Sorted into Data Compartment because .csv file signal.',
          },
        ],
        paperclipCompanyId: 'company-1',
        paperclipProjectId: 'project-1',
        paperclipLeadAgentId: 'agent-1',
        paperclipAgentIds: ['agent-1', 'agent-2'],
        lastPaperclipIssueId: 'issue-1',
        lastPaperclipRunId: 'run-1',
        phoneRelayBrief: 'Urgent only.',
        desktopSessionBrief: 'Long-form build stays on desktop.',
      },
    ]
    const wires = [{ id: 'w1', fromCardId: 'p1', toCardId: 'a1' }]
    const s = stringifyBoard(camera, cards, wires)
    const back = parseBoardJsonString(s)
    expect(back).not.toBeNull()
    expect(back!.camera).toEqual(camera)
    expect(back!.cards[0].title).toBe('Problem')
    expect(back!.cards[0].memoryWing).toBe('butler')
    expect(back!.cards[0].preferredLaunchSurface).toBe('hybrid')
    expect(back!.cards[0].capabilityPackId).toBe('relationship-memory')
    expect(back!.cards[0].paperclipCompanyId).toBe('company-1')
    expect(back!.cards[0].paperclipAgentIds).toEqual(['agent-1', 'agent-2'])
    expect(back!.cards[0].memoryPalaceLoci).toEqual([
      expect.objectContaining({ id: 'north-star', kind: 'north_star' }),
    ])
    expect(back!.cards[0].briefCompartmentAssets).toEqual([
      expect.objectContaining({
        id: 'compartment-asset-1',
        compartmentLabel: 'Data Compartment',
        compartmentKind: 'data',
      }),
    ])
    expect(back!.wires).toHaveLength(1)
  })

  it('parseBoardJsonString rejects invalid JSON text', () => {
    expect(parseBoardJsonString('')).toBeNull()
    expect(parseBoardJsonString('{')).toBeNull()
    expect(parseBoardJsonString('{"v":1}')).toBeNull()
  })
})

describe('workspace records', () => {
  it('saves, loads, and lists workspace records with metadata', () => {
    const board = {
      v: 1 as const,
      camera: { x: 12, y: -3, zoom: 0.85 },
      cards: [],
      wires: [],
    }

    const saved = savePersistedBoard(board.camera, board.cards, board.wires, {
      workspaceId: 'alpha',
      name: 'Alpha Room',
      focusedProblemId: 'p1',
    })

    expect(saved.id).toBe('alpha')
    expect(saved.name).toBe('Alpha Room')
    expect(saved.focusedProblemId).toBe('p1')
    expect(loadPersistedWorkspace('alpha')?.board).toEqual(board)
    expect(listPersistedWorkspaces()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'alpha',
          name: 'Alpha Room',
          focusedProblemId: 'p1',
        }),
      ]),
    )
  })

  it('persists the active workspace id and clears it when a workspace is deleted', () => {
    const alpha = createPersistedWorkspace('Alpha')
    const beta = createPersistedWorkspace('Beta')

    expect(alpha.id).not.toBe(beta.id)
    expect(getActiveWorkspaceId()).toBe(beta.id)

    const deleted = deletePersistedWorkspace(beta.id)
    expect(deleted.deleted).toBe(true)
    expect(getActiveWorkspaceId()).toBe(alpha.id)
  })

  it('loads and saves by workspace id while preserving the board JSON contract', () => {
    const board = {
      v: 1 as const,
      camera: { x: 4, y: 5, zoom: 0.75 },
      cards: [],
      wires: [],
    }

    createPersistedWorkspace('Room A', board)
    const roomB = savePersistedBoard(board.camera, board.cards, board.wires, {
      workspaceId: 'room-b',
      name: 'Room B',
    })

    expect(loadPersistedBoard('room-b')).toEqual(board)
    expect(roomB.id).toBe('room-b')

    savePersistedBoard({ x: 1, y: 2, zoom: 1.25 }, [], [], { workspaceId: 'room-b' })
    expect(loadPersistedWorkspace('room-b')?.board.camera.zoom).toBe(1.25)
  })

  it('updates focused problem metadata without rewriting the board snapshot', () => {
    const board = {
      v: 1 as const,
      camera: { x: 0, y: 0, zoom: 1 },
      cards: [],
      wires: [],
    }

    const saved = savePersistedBoard(board.camera, board.cards, board.wires, {
      workspaceId: 'focus-room',
      name: 'Focus Room',
      focusedProblemId: 'p1',
    })
    const updated = updatePersistedWorkspaceFocus(saved.id, 'p2')

    expect(updated?.focusedProblemId).toBe('p2')
    expect(loadPersistedWorkspace('focus-room')?.focusedProblemId).toBe('p2')
    expect(loadPersistedWorkspace('focus-room')?.board).toEqual(board)
  })

  it('allows creating a workspace record with a generated id', () => {
    const created = createPersistedWorkspace('Fresh Room')
    expect(created.id).toMatch(/^workspace-/)
    expect(loadPersistedWorkspace(created.id)?.name).toBe('Fresh Room')
    expect(loadPersistedWorkspace(created.id)?.lastSurface).toBe('desktop')
    expect(loadPersistedWorkspace(created.id)?.lastProjection).toBe('room')
  })

  it('clears the requested workspace without touching others', () => {
    const board = {
      v: 1 as const,
      camera: { x: 0, y: 0, zoom: 1 },
      cards: [],
      wires: [],
    }

    createPersistedWorkspace('Keep Me', board)
    savePersistedBoard(board.camera, board.cards, board.wires, {
      workspaceId: 'remove-me',
      name: 'Remove Me',
    })

    clearPersistedBoard('remove-me')

    expect(loadPersistedWorkspace('remove-me')).toBeNull()
    expect(loadPersistedWorkspace(getActiveWorkspaceId()!)).not.toBeNull()
  })

  it('notifies subscribers when the store changes', () => {
    const calls: number[] = []
    const unsubscribe = subscribeToWorkspaceStore(() => {
      calls.push(calls.length + 1)
    })

    savePersistedBoard({ x: 0, y: 0, zoom: 1 }, [], [], {
      workspaceId: 'notify-room',
      name: 'Notify Room',
    })
    expect(calls).toHaveLength(1)

    const activeEnvelope = JSON.stringify('notify-room')
    localStorage.setItem(ACTIVE_WORKSPACE_KEY, activeEnvelope)
    const storageEvent = new Event('storage') as StorageEvent
    Object.defineProperty(storageEvent, 'key', { value: ACTIVE_WORKSPACE_KEY })
    Object.defineProperty(storageEvent, 'newValue', { value: activeEnvelope })
    Object.defineProperty(storageEvent, 'storageArea', { value: localStorage })
    window.dispatchEvent(storageEvent)

    expect(calls).toHaveLength(2)
    unsubscribe()
  })
})

describe('legacy migration', () => {
  it('migrates the legacy single-board key into a workspace record', () => {
    const camera = { x: 9, y: -4, zoom: 0.9 }
    const cards = [
      {
        id: 'p1',
        x: 0,
        y: 0,
        width: 100,
        height: 80,
        title: 'Legacy',
        expanded: true,
        color: '#fff',
        kind: 'problem' as const,
      },
    ]
    const wires = [{ id: 'w1', fromCardId: 'p1', toCardId: 'p2' }]
    localStorage.setItem(BOARD_STORAGE_KEY, stringifyBoard(camera, cards, wires))

    const loaded = loadPersistedBoard()

    expect(loaded).toEqual({ v: 1, camera, cards, wires })
    expect(localStorage.getItem(BOARD_STORAGE_KEY)).toBeNull()
    expect(getActiveWorkspaceId()).toBeDefined()
    expect(loadPersistedWorkspace(getActiveWorkspaceId()!)?.board).toEqual({ v: 1, camera, cards, wires })
  })
})

function minimalProblemCard(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'room-1',
    x: 0,
    y: 0,
    width: 280,
    height: 180,
    title: 'Test Room',
    expanded: true,
    color: '#fff',
    kind: 'problem',
    ...overrides,
  }
}

function minimalBoard(cards: Record<string, unknown>[]): Record<string, unknown> {
  return {
    v: 1,
    camera: { x: 0, y: 0, zoom: 1 },
    cards,
    wires: [],
  }
}

describe('briefSpec round-trip', () => {
  it('parses a full brief spec with all optional fields', () => {
    const rawBriefSpec = {
      id: 'brief-contacts',
      creative: {
        mission: 'Build a relationship memory layer.',
        beneficiary: 'Stephanie',
        audience: 'Agents and operators.',
        tone: 'Trustworthy.',
        references: [
          { label: 'Good ref', ref: 'room/example', note: 'Context-rich.', polarity: 'good' },
          { label: 'Bad ref', ref: 'anti-pattern/flat', note: 'Flat rows.', polarity: 'bad' },
        ],
      },
      execution: {
        task: 'Define the contact and relationship model.',
        acceptanceCriteria: [
          { id: 'ac-1', description: 'Core entities identified.', verificationHint: 'Check schema.' },
          { id: 'ac-2', description: 'Context captured.' },
        ],
        scope: { in: ['Entity model', 'Relationship map'], out: ['Message automation'] },
        projectStructure: ['src/', 'src/freeform/', 'src/freeform/briefSpec.ts'],
        antiPatterns: ['Flat contact table'],
        deliverables: ['Contact schema'],
        milestone: 'CRM foundation',
        dependsOn: [],
        blockedBy: [],
        effortHint: '1 focused build pass',
      },
      escalationPolicy: 'outcome-contradiction-only',
      autonomyPolicy: 'full-auto',
      capabilityProfileId: 'research-standard',
      swarmRecipeId: 'relationship-map',
      projectId: 'stephanie-crm',
    }

    const board = parsePersistedBoardJson(minimalBoard([minimalProblemCard({ briefSpec: rawBriefSpec, briefVersion: 2, briefLocked: true })]))
    const card = board?.cards[0]

    expect(card?.briefSpec).toBeDefined()
    expect(card?.briefSpec?.id).toBe('brief-contacts')
    expect(card?.briefSpec?.creative.mission).toContain('relationship memory')
    expect(card?.briefSpec?.creative.audience).toBe('Agents and operators.')
    expect(card?.briefSpec?.creative.tone).toBe('Trustworthy.')
    expect(card?.briefSpec?.creative.references).toHaveLength(2)
    expect(card?.briefSpec?.creative.references[0]?.polarity).toBe('good')
    expect(card?.briefSpec?.execution.task).toContain('contact and relationship')
    expect(card?.briefSpec?.execution.acceptanceCriteria).toHaveLength(2)
    expect(card?.briefSpec?.execution.acceptanceCriteria[0]?.verificationHint).toBe('Check schema.')
    expect(card?.briefSpec?.execution.acceptanceCriteria[1]?.verificationHint).toBeUndefined()
    expect(card?.briefSpec?.execution.scope.in).toContain('Entity model')
    expect(card?.briefSpec?.execution.scope.out).toContain('Message automation')
    expect(card?.briefSpec?.execution.projectStructure).toEqual(['src/', 'src/freeform/', 'src/freeform/briefSpec.ts'])
    expect(card?.briefSpec?.execution.milestone).toBe('CRM foundation')
    expect(card?.briefSpec?.execution.dependsOn).toEqual([])
    expect(card?.briefSpec?.execution.blockedBy).toEqual([])
    expect(card?.briefSpec?.execution.effortHint).toBe('1 focused build pass')
    expect(card?.briefSpec?.escalationPolicy).toBe('outcome-contradiction-only')
    expect(card?.briefSpec?.autonomyPolicy).toBe('full-auto')
    expect(card?.briefSpec?.capabilityProfileId).toBe('research-standard')
    expect(card?.briefSpec?.swarmRecipeId).toBe('relationship-map')
    expect(card?.briefSpec?.projectId).toBe('stephanie-crm')
    expect(card?.briefVersion).toBe(2)
    expect(card?.briefLocked).toBe(true)
  })

  it('silently drops a brief spec with missing required fields', () => {
    const rawBriefSpec = { id: 'brief-bad', creative: { mission: 'No beneficiary here.' } }
    const board = parsePersistedBoardJson(minimalBoard([minimalProblemCard({ briefSpec: rawBriefSpec })]))
    expect(board?.cards[0]?.briefSpec).toBeUndefined()
  })

  it('normalises an unknown autonomyPolicy to full-auto', () => {
    const rawBriefSpec = {
      id: 'brief-1',
      creative: { mission: 'Ship.', beneficiary: 'User', references: [] },
      execution: {
        task: 'Build it.',
        acceptanceCriteria: [],
        scope: { in: [], out: [] },
        antiPatterns: [],
        deliverables: [],
      },
      escalationPolicy: 'outcome-contradiction-only',
      autonomyPolicy: 'totally-unknown-value',
    }
    const board = parsePersistedBoardJson(minimalBoard([minimalProblemCard({ briefSpec: rawBriefSpec })]))
    expect(board?.cards[0]?.briefSpec?.autonomyPolicy).toBe('full-auto')
  })

  it('parses persisted auto-continuation metadata for problem rooms', () => {
    const board = parsePersistedBoardJson(
      minimalBoard([
        minimalProblemCard({
          autoContinuationEnabled: true,
          lastAutoContinuationSourceRunId: 'run-continue-1',
        }),
      ]),
    )

    const card = board?.cards[0]
    expect(card?.autoContinuationEnabled).toBe(true)
    expect(card?.lastAutoContinuationSourceRunId).toBe('run-continue-1')
  })
})

describe('briefCompartmentAssets round-trip', () => {
  it('parses indexed room compartment assets when present on a problem card', () => {
    const board = parsePersistedBoardJson(
      minimalBoard([
        minimalProblemCard({
          briefCompartmentAssets: [
            {
              id: 'compartment-1',
              name: 'final-cut.mp4',
              mimeType: 'video/mp4',
              sizeBytes: 1250000,
              addedAt: '2026-04-19T10:00:00.000Z',
              compartmentId: 'system:publish',
              compartmentLabel: 'Publish Gate',
              compartmentKind: 'publish',
              anchorRef: 'compartment/publish-gate',
              extension: 'mp4',
              organizeStatus: 'sorted',
              organizeReason: 'Sorted into Publish Gate because publish keywords matched.',
              matchedLocusId: 'publish-gate',
            },
          ],
        }),
      ]),
    )

    expect(board?.cards[0]?.briefCompartmentAssets).toEqual([
      expect.objectContaining({
        id: 'compartment-1',
        name: 'final-cut.mp4',
        compartmentKind: 'publish',
        matchedLocusId: 'publish-gate',
      }),
    ])
  })
})

describe('runLedger round-trip', () => {
  it('parses a complete run ledger entry with self-evaluation and artifact status', () => {
    const rawEntry = {
      runId: 'run-abc',
      contractId: 'contract-1',
      roomId: 'room-1',
      title: 'Build sweep',
      status: 'completed',
      startedAt: '2026-01-01T00:01:00.000Z',
      completedAt: '2026-01-01T00:05:00.000Z',
      briefSpecId: 'brief-1',
      briefVersion: 3,
      briefHash: 'abc123',
      capabilityProfileId: 'build-local',
      swarmRecipeId: 'build-review-ship',
      continuationDecision: 'continue',
      selfEvaluation: {
        alignmentSummary: 'Implemented the contact model.',
        criteriaChecks: [
          { criterionId: 'ac-1', met: true, evidence: 'Schema defined.', confidence: 'high' },
          { criterionId: 'ac-2', met: false, evidence: 'Context missing.', confidence: 'medium' },
        ],
        allCriteriaMet: false,
        criteriaCovered: ['ac-1'],
        criteriaRemaining: ['ac-2'],
        nextAction: 'Add context capture.',
        escalationReason: null,
        assumptions: ['Local store wiring stays stable.'],
        handoffNotes: 'Verifier should check the context capture step.',
      },
      artifacts: [
        {
          id: 'artifact-1',
          runId: 'run-abc',
          kind: 'report',
          title: 'Contact schema',
          summary: 'Schema defined.',
          createdAt: '2026-01-01T00:05:00.000Z',
          content: '# Schema\n\nDetails here.',
          status: 'provisional',
        },
      ],
    }

    const board = parsePersistedBoardJson(minimalBoard([minimalProblemCard({ runLedger: [rawEntry] })]))
    const entry = board?.cards[0]?.runLedger?.[0]

    expect(entry).toBeDefined()
    expect(entry?.runId).toBe('run-abc')
    expect(entry?.briefSpecId).toBe('brief-1')
    expect(entry?.briefVersion).toBe(3)
    expect(entry?.briefHash).toBe('abc123')
    expect(entry?.capabilityProfileId).toBe('build-local')
    expect(entry?.swarmRecipeId).toBe('build-review-ship')
    expect(entry?.continuationDecision).toBe('continue')
    expect(entry?.selfEvaluation?.alignmentSummary).toContain('contact model')
    expect(entry?.selfEvaluation?.criteriaChecks).toHaveLength(2)
    expect(entry?.selfEvaluation?.criteriaChecks[0]?.confidence).toBe('high')
    expect(entry?.selfEvaluation?.criteriaCovered).toEqual(['ac-1'])
    expect(entry?.selfEvaluation?.criteriaRemaining).toEqual(['ac-2'])
    expect(entry?.selfEvaluation?.nextAction).toBe('Add context capture.')
    expect(entry?.selfEvaluation?.escalationReason).toBeNull()
    expect(entry?.selfEvaluation?.assumptions).toEqual(['Local store wiring stays stable.'])
    expect(entry?.selfEvaluation?.handoffNotes).toContain('Verifier')
    expect(entry?.artifacts[0]?.status).toBe('provisional')
    expect(entry?.artifacts[0]?.content).toBe('# Schema\n\nDetails here.')
  })

  it('silently drops malformed ledger entries and keeps valid ones', () => {
    const validEntry = {
      runId: 'run-1',
      contractId: 'c1',
      roomId: 'r1',
      title: 'Good run',
      status: 'completed',
      startedAt: '2026-01-01T00:00:00.000Z',
      artifacts: [],
    }
    const board = parsePersistedBoardJson(
      minimalBoard([
        minimalProblemCard({
          runLedger: [
            validEntry,
            { runId: 'bad', status: 'missing required fields' },
          ],
        }),
      ]),
    )
    expect(board?.cards[0]?.runLedger).toHaveLength(1)
    expect(board?.cards[0]?.runLedger?.[0]?.runId).toBe('run-1')
  })

  it('ignores a run ledger entry with an unknown continuationDecision', () => {
    const entry = {
      runId: 'run-2',
      contractId: 'c1',
      roomId: 'r1',
      title: 'Unknown decision run',
      status: 'completed',
      startedAt: '2026-01-01T00:00:00.000Z',
      artifacts: [],
      continuationDecision: 'something-else',
    }
    const board = parsePersistedBoardJson(minimalBoard([minimalProblemCard({ runLedger: [entry] })]))
    expect(board?.cards[0]?.runLedger?.[0]?.continuationDecision).toBeUndefined()
  })
})
