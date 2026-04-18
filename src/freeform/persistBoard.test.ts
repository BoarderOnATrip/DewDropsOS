import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  BOARD_STORAGE_KEY,
  ACTIVE_WORKSPACE_KEY,
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
  it('accepts a minimal valid v1 payload', () => {
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
        },
      ],
      wires: [],
    }
    const p = parsePersistedBoardJson(raw)
    expect(p).not.toBeNull()
    expect(p!.camera.zoom).toBe(0.9)
    expect(p!.cards[0].title).toBe('Test')
    expect(p!.wires).toEqual([])
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
        memoryWing: 'butler',
        memoryRoom: 'phone-relay',
        memoryContextSummary: 'Keep the paired phone in the loop.',
        memoryAnchors: ['drawer/phone', 'entity/tyler'],
        memoryPalaceLoci: [
          {
            id: 'north-star',
            title: 'North Star',
            kind: 'north_star' as const,
            detail: 'Keep the paired phone loop visible.',
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
    expect(back!.cards[0].paperclipCompanyId).toBe('company-1')
    expect(back!.cards[0].paperclipAgentIds).toEqual(['agent-1', 'agent-2'])
    expect(back!.cards[0].memoryPalaceLoci).toEqual([
      expect.objectContaining({ id: 'north-star', kind: 'north_star' }),
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
