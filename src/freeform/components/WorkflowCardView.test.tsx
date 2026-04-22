import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { WorkflowCard } from '../types'
import { WorkflowCardView } from './WorkflowCardView'

function surfaceCard(overrides: Partial<WorkflowCard> = {}): WorkflowCard {
  return {
    id: 's1',
    title: 'Note surface',
    expanded: false,
    color: '#aabbcc',
    kind: 'surface',
    x: 0,
    y: 0,
    width: 200,
    height: 120,
    ...overrides,
  }
}

function terminalCard(overrides: Partial<WorkflowCard> = {}): WorkflowCard {
  return {
    id: 'a1',
    title: 'Terminal 1',
    expanded: true,
    color: '#af52de',
    kind: 'agent',
    x: 0,
    y: 0,
    width: 176,
    height: 112,
    assignedToProblemId: null,
    parentAgentId: null,
    agentRuntime: {
      kind: 'terminal',
      profile: 'custom',
      transport: 'cli',
      instanceLabel: 'terminal-1',
      command: 'zsh -f',
      workspaceRoot: '.',
      vpnAlias: 'terminal-1',
      sessionPolicy: {
        allowNetwork: false,
        maxRuntimeMs: 120000,
        maxSteps: 40,
        requiresApprovalFor: ['destructive', 'external_network', 'privileged'],
        writableRoots: [],
      },
      sessionState: {
        status: 'running',
        sessionId: 'session-terminal-1',
        outputVersion: 1,
        terminalBuffer: 'pwd\r\n/Users/demo\r\n',
        logTail: ['[stdout] ready'],
      },
    },
    ...overrides,
  }
}

describe('WorkflowCardView', () => {
  it('renders the card title in the header', () => {
    const card = surfaceCard()
    render(
      <WorkflowCardView
        card={card}
        cards={[card]}
        wires={[]}
        handshakeFocus={null}
        selected={false}
        camera={{ x: 0, y: 0, zoom: 1 }}
        onSelect={vi.fn()}
        onMove={vi.fn()}
        onResize={vi.fn()}
        onDragEnd={vi.fn()}
        onToggleExpand={vi.fn()}
        onReleaseNod={vi.fn()}
      />,
    )
    expect(screen.getByText('Note surface')).toBeInTheDocument()
  })

  it('calls onToggleExpand when the card is double-clicked', async () => {
    const user = userEvent.setup()
    const card = surfaceCard()
    const onToggleExpand = vi.fn()
    const { container } = render(
      <WorkflowCardView
        card={card}
        cards={[card]}
        wires={[]}
        handshakeFocus={null}
        selected={false}
        camera={{ x: 0, y: 0, zoom: 1 }}
        onSelect={vi.fn()}
        onMove={vi.fn()}
        onResize={vi.fn()}
        onDragEnd={vi.fn()}
        onToggleExpand={onToggleExpand}
        onReleaseNod={vi.fn()}
      />,
    )
    const root = container.querySelector('[data-board-card="s1"]')
    expect(root).toBeTruthy()
    await user.dblClick(root!)
    expect(onToggleExpand).toHaveBeenCalledTimes(1)
  })

  it('shows swarm mass badge on an expanded problem with assigned agents', () => {
    const problem: WorkflowCard = {
      id: 'p1',
      title: 'Launch',
      expanded: true,
      color: '#fff',
      kind: 'problem',
      x: 0,
      y: 0,
      width: 240,
      height: 160,
    }
    const agent: WorkflowCard = {
      id: 'a1',
      title: 'Worker',
      expanded: true,
      color: '#0f0',
      kind: 'agent',
      x: 10,
      y: 10,
      width: 120,
      height: 44,
      assignedToProblemId: 'p1',
      parentAgentId: null,
    }
    render(
      <WorkflowCardView
        card={problem}
        cards={[problem, agent]}
        wires={[]}
        handshakeFocus={null}
        selected={false}
        camera={{ x: 0, y: 0, zoom: 1 }}
        onSelect={vi.fn()}
        onMove={vi.fn()}
        onResize={vi.fn()}
        onDragEnd={vi.fn()}
        onToggleExpand={vi.fn()}
        onReleaseNod={vi.fn()}
      />,
    )
    expect(screen.getByTitle(/Swarm mass/)).toHaveTextContent('×1')
  })

  it('shows session badges for problem cards when session metadata is available', () => {
    const problem: WorkflowCard = {
      id: 'p1',
      title: 'Launch',
      expanded: true,
      color: '#fff',
      kind: 'problem',
      x: 0,
      y: 0,
      width: 240,
      height: 160,
    }
    render(
      <WorkflowCardView
        card={problem}
        cards={[problem]}
        wires={[]}
        handshakeFocus={null}
        selected={false}
        camera={{ x: 0, y: 0, zoom: 1 }}
        problemSessionSummary={{
          workspaceLabel: 'Desktop session',
          launchSurfaceLabel: 'Hybrid',
          memoryLabel: 'hedgerows/launch-garden',
          anchorCount: 2,
          readinessLabel: 'Launch ready',
          readinessTone: 'ready',
        }}
        onSelect={vi.fn()}
        onMove={vi.fn()}
        onResize={vi.fn()}
        onDragEnd={vi.fn()}
        onToggleExpand={vi.fn()}
        onReleaseNod={vi.fn()}
      />,
    )

    expect(screen.getAllByText('Hybrid').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Launch ready').length).toBeGreaterThan(0)
    expect(screen.getByText('hedgerows/launch-garden')).toBeInTheDocument()
    expect(screen.getByText('2 anchors')).toBeInTheDocument()
  })

  it('renders the briefcase interior for expanded problem cards', () => {
    const problem: WorkflowCard = {
      id: 'p1',
      title: 'Launch',
      expanded: true,
      color: '#fff',
      kind: 'problem',
      x: 0,
      y: 0,
      width: 240,
      height: 180,
      mission: 'Ship the first working pass.',
      memoryAnchors: ['compartment/launch-map'],
      briefCompartmentAssets: [
        {
          id: 'compartment-1',
          name: 'launch-plan.md',
          mimeType: 'text/markdown',
          sizeBytes: 1200,
          addedAt: '2026-04-19T10:00:00.000Z',
          compartmentId: 'system:source',
          compartmentLabel: 'Source Compartment',
          compartmentKind: 'source',
          anchorRef: 'compartment/source-compartment',
          organizeStatus: 'sorted',
        },
      ],
      runLedger: [
        {
          runId: 'run-1',
          contractId: 'contract-1',
          roomId: 'p1',
          title: 'First pass',
          status: 'completed',
          startedAt: '2026-04-19T10:00:00.000Z',
          artifacts: [],
        },
      ],
    }

    render(
      <WorkflowCardView
        card={problem}
        cards={[problem]}
        wires={[]}
        handshakeFocus={null}
        selected={false}
        camera={{ x: 0, y: 0, zoom: 1 }}
        onSelect={vi.fn()}
        onMove={vi.fn()}
        onResize={vi.fn()}
        onDragEnd={vi.fn()}
        onToggleExpand={vi.fn()}
        onReleaseNod={vi.fn()}
      />,
    )

    expect(screen.getByLabelText('Briefcase structure')).toBeInTheDocument()
    expect(screen.getByText('Brief')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Big picture/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Work surface/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Close read/i })).toBeInTheDocument()
    expect(screen.getByText('Recorded provenance available')).toBeInTheDocument()
  })

  it('shows the latest returned artifact when no Butler run is active', () => {
    const problem: WorkflowCard = {
      id: 'p1',
      title: 'Launch',
      expanded: true,
      color: '#fff',
      kind: 'problem',
      x: 0,
      y: 0,
      width: 240,
      height: 180,
      runLedger: [
        {
          runId: 'dewdrop-session-1',
          contractId: 'dewdrop:agent-1',
          roomId: 'p1',
          title: 'Builder return',
          status: 'done',
          startedAt: '2026-04-19T10:00:00.000Z',
          artifacts: [
            {
              id: 'artifact-1',
              runId: 'dewdrop-session-1',
              kind: 'note',
              title: 'Builder return summary',
              summary: 'Builder returned from hermes with status done. all green',
              createdAt: '2026-04-19T10:10:00.000Z',
              status: 'provisional',
            },
          ],
        },
      ],
    }

    render(
      <WorkflowCardView
        card={problem}
        cards={[problem]}
        wires={[]}
        handshakeFocus={null}
        selected={false}
        camera={{ x: 0, y: 0, zoom: 1 }}
        onSelect={vi.fn()}
        onMove={vi.fn()}
        onResize={vi.fn()}
        onDragEnd={vi.fn()}
        onToggleExpand={vi.fn()}
        onReleaseNod={vi.fn()}
      />,
    )

    expect(screen.getByText('Latest return')).toBeInTheDocument()
    expect(screen.getByText(/Builder returned from hermes/i)).toBeInTheDocument()
  })

  it('treats the inline terminal surface as interactive instead of reselecting the card shell', () => {
    const onSelect = vi.fn()
    render(
      <WorkflowCardView
        card={terminalCard()}
        cards={[terminalCard()]}
        wires={[]}
        handshakeFocus={null}
        selected={false}
        activeTerminal
        camera={{ x: 0, y: 0, zoom: 1 }}
        onSelect={onSelect}
        onMove={vi.fn()}
        onResize={vi.fn()}
        onDragEnd={vi.fn()}
        onToggleExpand={vi.fn()}
        onReleaseNod={vi.fn()}
      />,
    )

    fireEvent.pointerDown(screen.getByText('Type directly in the terminal surface.'))
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('resizes the briefcase when the perception lens changes', async () => {
    const user = userEvent.setup()
    const problem: WorkflowCard = {
      id: 'p1',
      title: 'Launch',
      expanded: true,
      color: '#fff',
      kind: 'problem',
      x: 0,
      y: 0,
      width: 240,
      height: 180,
      mission: 'Ship the first working pass.',
    }

    const onResize = vi.fn()
    render(
      <WorkflowCardView
        card={problem}
        cards={[problem]}
        wires={[]}
        handshakeFocus={null}
        selected={false}
        camera={{ x: 0, y: 0, zoom: 1 }}
        onSelect={vi.fn()}
        onMove={vi.fn()}
        onResize={onResize}
        onDragEnd={vi.fn()}
        onToggleExpand={vi.fn()}
        onReleaseNod={vi.fn()}
      />,
    )

    await waitFor(() => expect(onResize).toHaveBeenCalledWith(388, 336))
    onResize.mockClear()

    await user.click(screen.getByRole('button', { name: /Close read/i }))

    await waitFor(() => expect(onResize).toHaveBeenCalledWith(588, 418))
  })

  it('requests more height when expanded briefcase content would clip', async () => {
    const scrollHeightSpy = vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(420)
    const clientHeightSpy = vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(180)
    const rectSpy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      width: 240,
      height: 54,
      top: 0,
      left: 0,
      right: 240,
      bottom: 54,
      toJSON: () => ({}),
    } as DOMRect)

    const problem: WorkflowCard = {
      id: 'p1',
      title: 'Launch',
      expanded: true,
      color: '#fff',
      kind: 'problem',
      x: 0,
      y: 0,
      width: 240,
      height: 180,
      mission: 'Ship the first working pass.',
    }

    const onResize = vi.fn()
    render(
      <WorkflowCardView
        card={problem}
        cards={[problem]}
        wires={[]}
        handshakeFocus={null}
        selected={false}
        camera={{ x: 0, y: 0, zoom: 1 }}
        onSelect={vi.fn()}
        onMove={vi.fn()}
        onResize={onResize}
        onDragEnd={vi.fn()}
        onToggleExpand={vi.fn()}
        onReleaseNod={vi.fn()}
      />,
    )

    await waitFor(() => expect(onResize).toHaveBeenCalledWith(388, 486))

    scrollHeightSpy.mockRestore()
    clientHeightSpy.mockRestore()
    rectSpy.mockRestore()
  })

  it('allows dragging from the expanded card body', () => {
    const card = surfaceCard({ expanded: true, x: 40, y: 60, height: 180 })
    const onMove = vi.fn()
    const onDragEnd = vi.fn()
    const { container } = render(
      <WorkflowCardView
        card={card}
        cards={[card]}
        wires={[]}
        handshakeFocus={null}
        selected={false}
        camera={{ x: 0, y: 0, zoom: 1 }}
        onSelect={vi.fn()}
        onMove={onMove}
        onResize={vi.fn()}
        onDragEnd={onDragEnd}
        onToggleExpand={vi.fn()}
        onReleaseNod={vi.fn()}
      />,
    )

    const body = container.querySelector('.freeform-card-body')
    expect(body).toBeTruthy()

    fireEvent.pointerDown(body!, { button: 0, clientX: 120, clientY: 140 })
    fireEvent.pointerMove(body!, { clientX: 150, clientY: 170 })
    fireEvent.pointerUp(body!, { clientX: 150, clientY: 170 })

    expect(onMove).toHaveBeenCalledWith(70, 90)
    expect(onDragEnd).toHaveBeenCalledTimes(1)
  })

  it('edits the core brief directly from the briefcase harness', async () => {
    const user = userEvent.setup()
    const onProblemBriefChange = vi.fn()
    const problem: WorkflowCard = {
      id: 'p1',
      title: 'Launch',
      expanded: true,
      color: '#fff',
      kind: 'problem',
      x: 0,
      y: 0,
      width: 360,
      height: 240,
      briefSpec: {
        id: 'brief-p1',
        creative: {
          mission: 'Ship the first pass.',
          beneficiary: 'Operators',
          references: [],
        },
        execution: {
          task: 'Build the launch room.',
          acceptanceCriteria: [],
          scope: { in: [], out: [] },
          antiPatterns: [],
          deliverables: [],
        },
        escalationPolicy: 'outcome-contradiction-only',
        autonomyPolicy: 'full-auto',
      },
    }

    render(
      <WorkflowCardView
        card={problem}
        cards={[problem]}
        wires={[]}
        handshakeFocus={null}
        selected
        camera={{ x: 0, y: 0, zoom: 1 }}
        onSelect={vi.fn()}
        onMove={vi.fn()}
        onResize={vi.fn()}
        onDragEnd={vi.fn()}
        onToggleExpand={vi.fn()}
        onProblemBriefChange={onProblemBriefChange}
        onReleaseNod={vi.fn()}
      />,
    )

    fireEvent.change(screen.getByRole('textbox', { name: 'Mission' }), {
      target: { value: 'Ship the room with a clean harness.' },
    })

    expect(onProblemBriefChange).toHaveBeenLastCalledWith(
      'p1',
      expect.objectContaining({
        creative: expect.objectContaining({
          mission: 'Ship the room with a clean harness.',
        }),
      }),
    )

    await user.click(screen.getByRole('button', { name: 'Add criterion' }))

    expect(onProblemBriefChange).toHaveBeenLastCalledWith(
      'p1',
      expect.objectContaining({
        execution: expect.objectContaining({
          acceptanceCriteria: [
            expect.objectContaining({
              id: 'criterion-1',
              description: '',
            }),
          ],
        }),
      }),
    )
  })

  it('turns an active DewDrop into a live terminal surface', async () => {
    const card = terminalCard()
    const onSendInput = vi.fn().mockResolvedValue(undefined)

    render(
      <WorkflowCardView
        card={card}
        cards={[card]}
        wires={[]}
        handshakeFocus={null}
        selected
        activeTerminal
        camera={{ x: 0, y: 0, zoom: 1 }}
        onSelect={vi.fn()}
        onMove={vi.fn()}
        onResize={vi.fn()}
        onDragEnd={vi.fn()}
        onToggleExpand={vi.fn()}
        onAgentTerminalStart={vi.fn()}
        onAgentTerminalStop={vi.fn()}
        onAgentTerminalRefresh={vi.fn()}
        onAgentTerminalSendInput={onSendInput}
        onAgentTerminalResize={vi.fn()}
        onReleaseNod={vi.fn()}
      />,
    )

    expect(screen.getByText('zsh -f')).toBeInTheDocument()
    expect(screen.getByText('Type directly in the terminal surface.')).toBeInTheDocument()
    expect(screen.getByText(/\/Users\/demo/)).toBeInTheDocument()
    expect(onSendInput).not.toHaveBeenCalled()
  })

  it('grows an active DewDrop terminal to a usable footprint', async () => {
    const card = terminalCard()
    const onResize = vi.fn()

    render(
      <WorkflowCardView
        card={card}
        cards={[card]}
        wires={[]}
        handshakeFocus={null}
        selected
        activeTerminal
        camera={{ x: 0, y: 0, zoom: 1 }}
        onSelect={vi.fn()}
        onMove={vi.fn()}
        onResize={onResize}
        onDragEnd={vi.fn()}
        onToggleExpand={vi.fn()}
        onAgentTerminalStart={vi.fn()}
        onAgentTerminalStop={vi.fn()}
        onAgentTerminalRefresh={vi.fn()}
        onAgentTerminalSendInput={vi.fn()}
        onAgentTerminalResize={vi.fn()}
        onReleaseNod={vi.fn()}
      />,
    )

    await waitFor(() => expect(onResize).toHaveBeenCalledWith(360, 320))
  })
})
