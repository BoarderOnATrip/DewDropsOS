import { fireEvent, render, screen } from '@testing-library/react'
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
})
