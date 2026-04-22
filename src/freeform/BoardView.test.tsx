import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import BoardView from './BoardView'
import type { WorkflowCard } from './types'

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

function problemCard(overrides: Partial<WorkflowCard> = {}): WorkflowCard {
  return {
    id: 'problem-1',
    title: 'Launch room',
    expanded: true,
    color: '#7fd4ff',
    kind: 'problem',
    x: 120,
    y: 120,
    width: 360,
    height: 260,
    ...overrides,
  }
}

describe('BoardView', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createMemoryStorage())
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))))
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    )
  })

  it('renders an expanded problem card without falling into a render loop', () => {
    render(
      <BoardView
        bootId="board-smoke"
        bootState={{
          camera: { x: 0, y: 0, zoom: 0.9 },
          cards: [problemCard()],
          wires: [],
        }}
      />,
    )

    expect(screen.getByText('Launch room')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Big picture/i })).toBeInTheDocument()
  })

  it('keeps the problem inspector available when agent selection replaces the focused problem selection', async () => {
    const user = userEvent.setup()
    const onFocusedProblemChange = vi.fn()

    render(
      <BoardView
        bootId="board-focus-preserved"
        bootState={{
          camera: { x: 0, y: 0, zoom: 0.9 },
          cards: [
            problemCard(),
            {
              id: 'agent-1',
              title: 'Agent 1',
              expanded: true,
              color: '#b3ffcf',
              kind: 'agent',
              x: 520,
              y: 120,
              width: 176,
              height: 112,
              assignedToProblemId: null,
              parentAgentId: null,
            },
          ],
          wires: [],
        }}
        focusedProblemId="problem-1"
        onFocusedProblemChange={onFocusedProblemChange}
      />,
    )

    expect(screen.getByText('Session surface')).toBeInTheDocument()
    await user.click(screen.getByText('Agent 1'))
    expect(screen.getByText('Session surface')).toBeInTheDocument()
    expect(onFocusedProblemChange).not.toHaveBeenCalledWith(null)
  })

  it('shows a direct DewDrop inspector when a single agent is selected', async () => {
    const user = userEvent.setup()

    render(
      <BoardView
        bootId="board-single-agent"
        bootState={{
          camera: { x: 0, y: 0, zoom: 0.9 },
          cards: [
            {
              id: 'agent-1',
              title: 'Agent 1',
              expanded: true,
              color: '#b3ffcf',
              kind: 'agent',
              x: 520,
              y: 120,
              width: 176,
              height: 112,
              assignedToProblemId: null,
              parentAgentId: null,
              agentRuntime: {
                kind: 'terminal',
                profile: 'codex',
                transport: 'cli',
                instanceLabel: 'agent-1',
                command: 'codex',
                workspaceRoot: '.',
                vpnAlias: 'agent-1',
                sessionPolicy: {
                  allowNetwork: false,
                  maxRuntimeMs: 120000,
                  maxSteps: 40,
                  requiresApprovalFor: ['destructive', 'external_network', 'privileged'],
                  writableRoots: [],
                },
                sessionState: {
                  status: 'idle',
                },
              },
            },
          ],
          wires: [],
        }}
      />,
    )

    await user.click(screen.getByText('Agent 1'))

    expect(screen.getByText('Selected terminal')).toBeInTheDocument()
    expect(screen.getByLabelText('Runtime')).toHaveValue('codex')
    expect(screen.getByLabelText('Shell')).toHaveValue('codex')
    expect(screen.getByLabelText('Root')).toHaveValue('.')
  })

  it('keeps the inline DewDrop terminal active while a room stays focused', async () => {
    const user = userEvent.setup()

    render(
      <BoardView
        bootId="board-focused-inline-terminal"
        bootState={{
          camera: { x: 0, y: 0, zoom: 0.9 },
          cards: [
            problemCard(),
            {
              id: 'agent-1',
              title: 'Agent 1',
              expanded: true,
              color: '#b3ffcf',
              kind: 'agent',
              x: 520,
              y: 120,
              width: 176,
              height: 112,
              assignedToProblemId: null,
              parentAgentId: null,
              agentRuntime: {
                kind: 'terminal',
                profile: 'custom',
                transport: 'cli',
                instanceLabel: 'agent-1',
                command: 'zsh -f',
                workspaceRoot: '.',
                vpnAlias: 'agent-1',
                sessionPolicy: {
                  allowNetwork: false,
                  maxRuntimeMs: 120000,
                  maxSteps: 40,
                  requiresApprovalFor: ['destructive', 'external_network', 'privileged'],
                  writableRoots: [],
                },
                sessionState: {
                  status: 'idle',
                },
              },
            },
          ],
          wires: [],
        }}
        focusedProblemId="problem-1"
      />,
    )

    await user.click(screen.getByText('Agent 1'))

    expect(screen.getByText('Start the terminal and the DewDrop becomes a live shell.')).toBeInTheDocument()
    expect(screen.getByText('zsh -f')).toBeInTheDocument()
  })

  it('spins up a selected terminal from the toolbar instantly', async () => {
    const user = userEvent.setup()

    render(
      <BoardView
        bootId="board-new-terminal"
        bootState={{
          camera: { x: 32, y: 64, zoom: 0.9 },
          cards: [],
          wires: [],
        }}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'New terminal' }))

    expect(screen.getByText('Selected terminal')).toBeInTheDocument()
    expect(screen.getByLabelText('Runtime')).toHaveValue('custom')
    expect(screen.getByLabelText('Shell')).toHaveValue('zsh -i -f')
    expect(screen.getByLabelText('Root')).toHaveValue('.')
    expect(screen.getByLabelText('Host')).toHaveValue('')
  })

  it('spins up a Hermes node from the toolbar', async () => {
    const user = userEvent.setup()

    render(
      <BoardView
        bootId="board-new-hermes"
        bootState={{
          camera: { x: 32, y: 64, zoom: 0.9 },
          cards: [],
          wires: [],
        }}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'New Hermes' }))

    expect(screen.getByText('Selected terminal')).toBeInTheDocument()
    expect(screen.getByLabelText('Runtime')).toHaveValue('hermes')
    expect(screen.getByLabelText('Shell')).toHaveValue('hermes')
    expect(screen.getByLabelText('Host')).toHaveValue('')
  })

  it('spins up a browser node from the toolbar', async () => {
    const user = userEvent.setup()

    render(
      <BoardView
        bootId="board-new-browser"
        bootState={{
          camera: { x: 32, y: 64, zoom: 0.9 },
          cards: [],
          wires: [],
        }}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'New browser' }))

    expect(screen.getByText('Selected terminal')).toBeInTheDocument()
    expect(screen.getByLabelText('Runtime')).toHaveValue('browser-harness')
    expect(screen.getByLabelText('Shell')).toHaveValue('browser-harness')
    expect(screen.getByLabelText('Host')).toHaveValue('')
  })

  it('spins up a Playwright node from the toolbar', async () => {
    const user = userEvent.setup()

    render(
      <BoardView
        bootId="board-new-playwright"
        bootState={{
          camera: { x: 32, y: 64, zoom: 0.9 },
          cards: [],
          wires: [],
        }}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'New Playwright' }))

    expect(screen.getByText('Selected terminal')).toBeInTheDocument()
    expect(screen.getByLabelText('Runtime')).toHaveValue('playwright')
    expect(screen.getByLabelText('Shell')).toHaveValue('npx playwright test')
    expect(screen.getByLabelText('Host')).toHaveValue('')
  })

  it('returns a selected terminal artifact into the room ledger', async () => {
    const user = userEvent.setup()

    render(
      <BoardView
        bootId="board-return-artifact"
        bootState={{
          camera: { x: 0, y: 0, zoom: 0.9 },
          cards: [
            problemCard(),
            {
              id: 'agent-1',
              title: 'Builder',
              expanded: true,
              color: '#b3ffcf',
              kind: 'agent',
              x: 520,
              y: 120,
              width: 176,
              height: 112,
              assignedToProblemId: 'problem-1',
              parentAgentId: null,
              agentRuntime: {
                kind: 'terminal',
                profile: 'hermes',
                transport: 'cli',
                instanceLabel: 'builder',
                command: 'hermes',
                workspaceRoot: '.',
                sessionPolicy: {
                  allowNetwork: false,
                  maxRuntimeMs: 120000,
                  maxSteps: 40,
                  requiresApprovalFor: ['destructive', 'external_network', 'privileged'],
                  writableRoots: [],
                },
                sessionState: {
                  status: 'running',
                  sessionId: 'session-1',
                  startedAt: '2026-04-19T10:00:00.000Z',
                  lastHeartbeatAt: '2026-04-19T10:02:00.000Z',
                  currentTask: 'hermes',
                  outputVersion: 2,
                  terminalBuffer: 'build complete\nall green',
                  logTail: ['build complete', 'all green'],
                },
              },
            },
          ],
          wires: [],
        }}
        focusedProblemId="problem-1"
      />,
    )

    const builderCardTitle = screen
      .getAllByText('Builder')
      .find((element) => element.classList.contains('freeform-card-title'))
    expect(builderCardTitle).toBeTruthy()
    await user.click(builderCardTitle as HTMLElement)
    await user.click(screen.getByRole('button', { name: 'Return artifact' }))

    expect(screen.getByText('Builder return')).toBeInTheDocument()
    expect(screen.getAllByText(/Builder returned from hermes with status running/i).length).toBeGreaterThan(0)
  })

  it('persists mission edits made directly inside the briefcase harness', async () => {
    const user = userEvent.setup()

    render(
      <BoardView
        bootId="board-inline-brief-edit"
        bootState={{
          camera: { x: 0, y: 0, zoom: 0.9 },
          cards: [
            problemCard({
              briefSpec: {
                id: 'brief-problem-1',
                creative: {
                  mission: 'Old mission',
                  beneficiary: 'Operators',
                  references: [],
                },
                execution: {
                  task: 'Build the room.',
                  acceptanceCriteria: [],
                  scope: { in: [], out: [] },
                  antiPatterns: [],
                  deliverables: [],
                },
                escalationPolicy: 'outcome-contradiction-only',
                autonomyPolicy: 'full-auto',
              },
            }),
          ],
          wires: [],
        }}
      />,
    )

    const mission = screen.getByRole('textbox', { name: 'Mission' })
    await user.clear(mission)
    await user.type(mission, 'Harness mission')

    expect(screen.getByDisplayValue('Harness mission')).toBeInTheDocument()
  })
})
