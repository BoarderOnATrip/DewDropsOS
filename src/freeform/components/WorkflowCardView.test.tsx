import { render, screen } from '@testing-library/react'
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
})
