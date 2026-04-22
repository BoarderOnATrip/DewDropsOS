import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { RoomAssetStudio, type RoomAssetStudioAsset } from './RoomAssetStudio'

function asset(overrides: Partial<RoomAssetStudioAsset> = {}): RoomAssetStudioAsset {
  return {
    id: 'room-asset-launch-garden',
    title: 'Launch Garden',
    summary: 'A room asset for active customer work, memory, and portal routing.',
    roomLabel: 'Revenue wing',
    memoryLabel: 'revenue/launch-garden',
    captureLabel: 'Desktop capture',
    editLabel: 'Spatial editor',
    zones: [
      {
        id: 'door',
        label: 'Door',
        summary: 'Entry and handoff threshold.',
        tone: 'ready',
      },
      {
        id: 'table',
        label: 'Table',
        summary: 'Active commitments and notes.',
        tone: 'calm',
      },
      {
        id: 'console',
        label: 'Console',
        summary: 'Agent actions and live controls.',
        tone: 'attention',
      },
    ],
    portals: [
      {
        id: 'portal-retention',
        label: 'Retention Vault',
        summary: 'Open the follow-up room.',
        target: 'Retention Vault',
        tone: 'ready',
      },
      {
        id: 'portal-earth',
        label: 'Earth return',
        summary: 'Return to the planetary shell.',
        target: 'Planet Earth',
        tone: 'calm',
      },
    ],
    loci: [
      {
        id: 'locus-north-star',
        label: 'North Star',
        summary: 'The primary remembering point.',
        tone: 'ready',
      },
      {
        id: 'locus-checkpoint',
        label: 'Checkpoint',
        summary: 'A pause for review and sync.',
        tone: 'attention',
      },
    ],
    props: [
      {
        id: 'prop-launch-brief',
        label: 'Launch brief',
        summary: 'The current operating brief.',
        tone: 'ready',
      },
      {
        id: 'prop-signal-transcript',
        label: 'Signal transcript',
        summary: 'A captured exchange to review.',
        tone: 'calm',
      },
    ],
    mediaSurfaces: [
      {
        id: 'media-screen',
        label: 'Live screen',
        summary: 'A desktop capture surface.',
        format: 'Video',
        tone: 'ready',
      },
      {
        id: 'media-scan',
        label: 'Room scan',
        summary: 'A spatial map of the room.',
        format: 'Image',
        tone: 'calm',
      },
    ],
    notes: ['Use the door for entry.', 'Keep the console reserved for agents.'],
    ...overrides,
  }
}

describe('RoomAssetStudio', () => {
  it('renders the room asset surfaces and metadata', () => {
    render(
      <RoomAssetStudio
        asset={asset()}
        selectedZoneId="table"
        selectedPortalId="portal-retention"
      />,
    )

    expect(screen.getByRole('heading', { name: 'Launch Garden' })).toBeInTheDocument()
    expect(screen.getByText('A room asset for active customer work, memory, and portal routing.')).toBeInTheDocument()
    expect(screen.getByText('Revenue wing')).toBeInTheDocument()
    expect(screen.getByText('North Star')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Retention Vault Open the follow-up room/i })).toBeInTheDocument()
    expect(screen.getByText('Launch brief')).toBeInTheDocument()
    expect(screen.getByText('Live screen')).toBeInTheDocument()
    expect(screen.getByText('Use the door for entry.')).toBeInTheDocument()
    expect(screen.getByText('Canonical room interior')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Door Entry and handoff threshold/i })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: /Table Active commitments and notes/i })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /Retention Vault Open the follow-up room/i })).toHaveAttribute('aria-pressed', 'true')
  })

  it('exposes zone and portal selection callbacks', async () => {
    const user = userEvent.setup()
    const onZoneSelect = vi.fn()
    const onPortalSelect = vi.fn()

    function ControlledStudio() {
      const [selectedZoneId, setSelectedZoneId] = useState<string | null>('door')
      const [selectedPortalId, setSelectedPortalId] = useState<string | null>('portal-earth')

      return (
        <RoomAssetStudio
          asset={asset()}
          selectedZoneId={selectedZoneId}
          selectedPortalId={selectedPortalId}
          onZoneSelect={(zoneId) => {
            onZoneSelect(zoneId)
            setSelectedZoneId(zoneId)
          }}
          onPortalSelect={(portalId) => {
            onPortalSelect(portalId)
            setSelectedPortalId(portalId)
          }}
        />
      )
    }

    render(<ControlledStudio />)

    await user.click(screen.getByRole('button', { name: /Console Agent actions and live controls/i }))
    await user.click(screen.getByRole('button', { name: /Retention Vault Open the follow-up room/i }))

    expect(onZoneSelect).toHaveBeenCalledWith('console')
    expect(onPortalSelect).toHaveBeenCalledWith('portal-retention')
    expect(screen.getByRole('button', { name: /Console Agent actions and live controls/i })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /Retention Vault Open the follow-up room/i })).toHaveAttribute('aria-pressed', 'true')
  })

  it('handles empty surfaces without throwing', () => {
    render(
      <RoomAssetStudio
        asset={asset({
          zones: [],
          portals: [],
          loci: [],
          props: [],
          mediaSurfaces: [],
          notes: [],
        })}
      />,
    )

    expect(screen.getByText('No zones yet')).toBeInTheDocument()
    expect(screen.getByText('No portals configured')).toBeInTheDocument()
    expect(screen.getByText('No loci anchored yet')).toBeInTheDocument()
    expect(screen.getByText('No props yet')).toBeInTheDocument()
    expect(screen.getByText('No media surfaces yet')).toBeInTheDocument()
  })
})
