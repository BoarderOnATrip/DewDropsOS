import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { WorkflowCard } from '../freeform/types'
import type { ButlerSwarmRun } from '../lib/butlerBridge'
import { buildPhoneRelayShellData } from './phoneRelayModel'
import { PhoneRelayShell } from './phoneRelay'

function problem(overrides: Partial<WorkflowCard> = {}): WorkflowCard {
  return {
    id: 'p1',
    title: 'Phone Relay MVP',
    expanded: true,
    color: '#fff',
    kind: 'problem',
    x: 0,
    y: 0,
    width: 280,
    height: 180,
    butlerRoomId: 'room-1',
    mission: 'Make phone relay real.',
    preferredLaunchSurface: 'hybrid',
    memoryWing: 'relay-wing',
    memoryRoom: 'screening-bay',
    memoryContextSummary: 'Compact relay context.',
    memoryAnchors: ['drawer/phone'],
    memoryPalaceLoci: [
      {
        id: 'north-star',
        title: 'North Star',
        kind: 'north_star',
        detail: 'Keep the relay mission visible.',
      },
    ],
    phoneRelayBrief: 'Escalate only urgent approvals.',
    desktopSessionBrief: 'Use the desktop for deep implementation.',
    ...overrides,
  }
}

function run(overrides: Partial<ButlerSwarmRun> = {}): ButlerSwarmRun {
  return {
    id: 'run-1',
    run_id: 'run-1',
    contract_id: 'contract-1',
    room_id: 'room-1',
    title: 'Latest pass',
    status: 'running',
    summary: 'Actively relaying.',
    updated_at: '2026-04-15T12:30:00Z',
    ...overrides,
  }
}

describe('PhoneRelayShell', () => {
  it('renders the selected problem detail and focuses a problem on tap', async () => {
    const user = userEvent.setup()
    const onFocusProblem = vi.fn()

    const data = buildPhoneRelayShellData({
      workspaceName: 'DewDrops',
      workspaceSubtitle: 'Phone relay workspace snapshot',
      workspaceMode: 'phone',
      workspaceId: 'relay-1',
      bridgeHealth: { ok: true },
      cards: [
        problem(),
        problem({
          id: 'p2',
          title: 'Shipping flow',
          mission: 'Keep the release moving.',
          memoryWing: 'release-wing',
          memoryRoom: 'tracking-bay',
          memoryContextSummary: 'Release coordination context.',
          memoryAnchors: ['drawer/release'],
        }),
        {
          id: 'a1',
          title: 'Agent',
          expanded: true,
          color: '#0f0',
          kind: 'agent',
          x: 0,
          y: 0,
          width: 120,
          height: 44,
          assignedToProblemId: 'p1',
          parentAgentId: null,
        },
      ],
      runs: [run()],
    })

    const { selectedProblemId, ...relayData } = data
    void selectedProblemId

    render(<PhoneRelayShell {...relayData} onFocusProblem={onFocusProblem} onJumpToDesktop={vi.fn()} />)

    expect(screen.getAllByRole('heading', { name: 'relay-wing/screening-bay' })).toHaveLength(2)
    expect(screen.getAllByText('Launch ready').length).toBeGreaterThan(0)
    expect(screen.getByText(/latest_run: Latest pass \(running\)/)).toBeInTheDocument()
    expect(screen.getByText('Active room')).toBeInTheDocument()
    expect(screen.getAllByText('relay-wing/screening-bay').length).toBeGreaterThanOrEqual(2)
    expect(screen.getAllByText('Pocket projection').length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText('Room projection')).toBeInTheDocument()
    expect(screen.getAllByText('Spatial room').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Editable LiDAR room asset').length).toBeGreaterThan(0)
    expect(screen.getByText('Walk into relay-wing/screening-bay')).toBeInTheDocument()
    expect(screen.getByText('Visual memory palace')).toBeInTheDocument()
    expect(screen.getByText('Keep the relay mission visible.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Jump to desktop' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Focus Shipping flow' }))

    expect(onFocusProblem).toHaveBeenCalledWith('p2')
    expect(screen.getAllByRole('heading', { name: 'release-wing/tracking-bay' })).toHaveLength(2)
    expect(screen.getByText('Keep the release moving.')).toBeInTheDocument()
  }, 10000)

  it('falls back to an empty-state prompt when there are no problems', () => {
    render(
      <PhoneRelayShell
        {...buildPhoneRelayShellData({
          workspaceName: 'DewDrops',
          cards: [],
        })}
      />,
    )

    expect(screen.getByText('No problem cards yet.')).toBeInTheDocument()
    expect(screen.getByText('Select a problem')).toBeInTheDocument()
  })
})
