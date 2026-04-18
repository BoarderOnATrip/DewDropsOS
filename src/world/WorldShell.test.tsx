import { useState } from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { worldRef } from './model'
import {
  type WorldClosetCard,
  WorldShell,
  type WorldDrillStage,
  type WorldDrillStageId,
  type WorldLocusCard,
  type WorldLocusPreview,
  type WorldProjectionChip,
  type WorldRoomCard,
} from './WorldShell'

function room(overrides: Partial<WorldRoomCard> = {}): WorldRoomCard {
  return {
    id: 'room-1',
    title: 'Launch Garden',
    summary: 'A remembered place for active customer work, live context, and agent follow-through.',
    meta: ['CRM', '3 actors', '12 artifacts'],
    tone: 'ready',
    accent: '#7dd3fc',
    ...overrides,
  }
}

function projection(overrides: Partial<WorldProjectionChip> = {}): WorldProjectionChip {
  return {
    id: 'projection-3d',
    label: '3D',
    detail: 'Immersive spatial view',
    tone: 'calm',
    ...overrides,
  }
}

function drillStage(overrides: Partial<WorldDrillStage> = {}): WorldDrillStage {
  return {
    id: 'room',
    label: 'Room',
    value: 'Launch Garden',
    detail: 'Focused operating surface and memory frame.',
    ...overrides,
  }
}

function locus(overrides: Partial<WorldLocusCard> = {}): WorldLocusCard {
  return {
    id: 'locus-1',
    title: 'North Star Console',
    summary: 'A launch locus for live commitments, priority actors, and active handoff artifacts.',
    kindLabel: 'Console',
    roomLabel: 'Launch Garden',
    actorLabels: ['Avery', 'Butler CEO'],
    artifactLabels: ['Launch brief', 'Signal transcript'],
    tone: 'calm',
    accent: '#5eead4',
    ...overrides,
  }
}

function locusPreview(overrides: Partial<WorldLocusPreview> = {}): WorldLocusPreview {
  return {
    title: 'North Star Console',
    summary: 'A live control surface where the room keeps its launch commitments in view.',
    kindLabel: 'Console',
    actorLabels: ['Avery', 'Butler CEO'],
    artifactLabels: ['Launch brief', 'Signal transcript'],
    ...overrides,
  }
}

function closet(overrides: Partial<WorldClosetCard> = {}): WorldClosetCard {
  return {
    id: 'projection-room',
    title: 'Room closet',
    summary: 'The currently unfolded room view and its most important drawers.',
    sourceLabel: 'Room view',
    drawers: [
      {
        id: 'drawer-actor-avery',
        label: 'Room outline -> actor -> Avery',
        focusRef: worldRef('person', 'person-avery'),
      },
      {
        id: 'drawer-locus-north-star',
        label: 'Room outline -> locus -> North Star',
        focusRef: worldRef('locus', 'locus-1'),
      },
    ],
    tone: 'calm',
    accent: '#7dd3fc',
    ...overrides,
  }
}

describe('WorldShell', () => {
  it('renders an arrival re-entry overlay and allows skipping into context', async () => {
    const user = userEvent.setup()

    render(
      <WorldShell
        title="DewDrops"
        hierarchy={{
          earth: 'Planetary memory',
          wing: 'Revenue wing',
          actor: 'Avery',
          room: 'Launch Garden',
        }}
        arrivalMode="always"
        arrivalDurationMs={100000}
        drillStages={[
          drillStage({
            id: 'room',
            label: 'Room',
            value: 'Launch Garden',
            detail: 'Focused operating surface and memory frame.',
          }),
        ]}
      />,
    )

    expect(screen.getByLabelText('Arrival transition')).toBeInTheDocument()
    expect(screen.getByText('Collapsing Earth into your current room')).toBeInTheDocument()
    expect(screen.getByText('Planetary memory to Launch Garden')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Enter context now' }))

    expect(screen.queryByLabelText('Arrival transition')).not.toBeInTheDocument()
  })

  it('renders a clickable context tunnel with loci and detail panels', async () => {
    const user = userEvent.setup()

    render(
      <WorldShell
        title="DewDrops"
        subtitle="Spatial operating surface"
        arrivalMode="never"
        heroCopy="The world remembers where you left off and opens back into context."
        hierarchy={{
          earth: 'Planetary memory',
          wing: 'Revenue wing',
          actor: 'Avery',
          room: 'Launch Garden',
        }}
        roomPreview={{
          title: 'Launch Garden',
          summary: 'A room preview.',
          surfaceLabel: 'Hybrid',
          memoryLabel: 'revenue/launch-garden',
          actorLabels: ['Avery'],
          actorItems: [
            {
              id: 'room-preview-actor-avery',
              label: 'room actor -> Avery',
              focusRef: worldRef('person', 'person-avery'),
            },
          ],
          locusLabels: ['North Star'],
          locusItems: [
            {
              id: 'room-preview-locus-north-star',
              label: 'North Star',
              focusRef: worldRef('locus', 'locus-1'),
            },
          ],
          artifactLabels: ['Brief'],
          artifactItems: [
            {
              id: 'room-preview-artifact-brief',
              label: 'Brief',
              focusRef: worldRef('artifact', 'artifact-brief'),
            },
          ],
          tunnelLabels: ['handoff'],
          tunnelItems: [
            {
              id: 'room-preview-tunnel-handoff',
              label: 'handoff -> Retention Vault',
              focusRef: worldRef('room', 'room-2'),
            },
          ],
          anchorLabels: ['entity/avery'],
          openQuestionLabels: ['Need launch brief'],
          phoneBrief: 'Phone relay brief',
          desktopBrief: 'Desktop brief',
          latestRunLabel: 'Swarm run-1',
        }}
        drillStages={[
          drillStage({
            id: 'earth',
            label: 'Earth',
            value: 'Planetary memory',
            detail: 'Planetary shell and return vector.',
          }),
          drillStage({
            id: 'wing',
            label: 'Wing',
            value: 'Revenue wing',
            detail: 'Actor anchor: Avery',
          }),
          drillStage({
            id: 'room',
            label: 'Room',
            value: 'Launch Garden',
            detail: 'Focused operating surface and memory frame.',
          }),
          drillStage({
            id: 'locus',
            label: 'Locus',
            value: 'North Star Console',
            detail: 'Room interior anchor for precise context.',
          }),
        ]}
        selectedDrillStageId="room"
        activeProjection={{
          id: 'room',
          modeLabel: 'Room',
          modeDetail: 'Focused room view',
          focusTitle: 'Launch Garden',
          summary: '3 actors, 2 loci, 1 artifact',
          breadcrumb: ['Planetary memory', 'Revenue wing', 'Launch Garden'],
          breadcrumbItems: [
            {
              id: 'breadcrumb-earth',
              label: 'Planetary memory',
              drillStageId: 'earth',
            },
            {
              id: 'breadcrumb-wing',
              label: 'Revenue wing',
              focusRef: worldRef('wing', 'wing-revenue'),
            },
            {
              id: 'breadcrumb-room',
              label: 'Launch Garden',
              focusRef: worldRef('room', 'room-1'),
            },
          ],
          stats: ['6 nodes', '4 links'],
          returnVectors: [
            {
              id: 'return-earth',
              label: 'Earth return',
              detail: 'Reset to the planetary shell and last known territory.',
              tone: 'calm',
              orbit: 'outer',
              drillStageId: 'earth',
            },
            {
              id: 'return-retention',
              label: 'Retention Vault',
              detail: 'Magnetic room return',
              tone: 'ready',
              orbit: 'inner',
              focusRef: worldRef('room', 'room-2'),
            },
          ],
          cards: [
            {
              id: 'room-1',
              title: 'Launch Garden',
              summary: 'Room focus',
              kind: 'Room',
              emphasis: 'focus',
              focusRef: worldRef('room', 'room-1'),
            },
          ],
          links: [
            {
              id: 'link-1',
              label: 'context tunnel',
              detail: 'Launch Garden -> Retention Vault',
              kind: 'tunnel',
              focusRef: worldRef('room', 'room-2'),
            },
          ],
          detailSections: [
            {
              id: 'section-1',
              title: 'Room outline',
              copy: 'Folded but readable.',
              items: [
                {
                  id: 'item-actor-avery',
                  label: 'actor -> Avery',
                  focusRef: worldRef('person', 'person-avery'),
                },
                {
                  id: 'item-locus-north-star',
                  label: 'locus -> North Star',
                  focusRef: worldRef('locus', 'locus-1'),
                },
              ],
              style: 'list',
            },
          ],
        }}
        projectionChips={[projection(), projection({ id: 'fold', label: 'Fold', detail: 'Compressed 2D fold' })]}
        roomCards={[room(), room({ id: 'room-2', title: 'Retention Vault', summary: 'Long-lived follow-up context.', tone: 'attention' })]}
        locusCards={[
          locus(),
          locus({
            id: 'locus-2',
            title: 'Signal Desk',
            summary: 'A relay locus for forecast signals, escalation notes, and operator loops.',
            kindLabel: 'Desk',
            artifactLabels: ['Forecast board'],
          }),
        ]}
        selectedLocusId="locus-1"
        locusPreview={locusPreview({
          actorItems: [
            {
              id: 'locus-preview-actor-avery',
              label: 'Avery',
              focusRef: worldRef('person', 'person-avery'),
            },
          ],
          artifactItems: [
            {
              id: 'locus-preview-artifact-brief',
              label: 'Launch brief',
              focusRef: worldRef('artifact', 'artifact-brief'),
            },
          ],
        })}
        closetCards={[
          closet(),
          closet({
            id: 'closet-anchors',
            title: 'Anchor closet',
            sourceLabel: 'Memory bind',
            summary: 'Stable refs and loci that let the room collapse and unfold without losing shape.',
            drawers: [
              { id: 'anchor-entity-avery', label: 'entity/avery' },
              { id: 'anchor-locus-north-star', label: 'North Star', focusRef: worldRef('locus', 'locus-1') },
            ],
          }),
        ]}
        selectedClosetId="projection-room"
        onOpenDesktop={vi.fn()}
      />,
    )

    expect(screen.getByRole('heading', { name: 'DewDrops' })).toBeInTheDocument()
    expect(screen.getByText('Spatial operating surface')).toBeInTheDocument()
    expect(screen.getByText('Earth return')).toBeInTheDocument()
    expect(screen.getByText('Magnetic room return')).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Context tunnel path' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Planetary shell and return vector/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Room interior anchor for precise context/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /3D/ })).toBeInTheDocument()
    expect(screen.getByText('Unfold ladder')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Compressed 2D fold/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /A remembered place for active customer work/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Long-lived follow-up context/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /priority actors, and active handoff artifacts/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /forecast signals, escalation notes, and operator loops/i })).toBeInTheDocument()
    expect(screen.getByLabelText('Hero zoom tunnel')).toBeInTheDocument()
    expect(screen.getByText('Drill focus')).toBeInTheDocument()
    expect(screen.getAllByText('Focused operating surface and memory frame.')).toHaveLength(2)
    expect(screen.getByText('Locus detail')).toBeInTheDocument()
    expect(screen.getByText('A live control surface where the room keeps its launch commitments in view.')).toBeInTheDocument()
    expect(screen.getByText('Launch brief')).toBeInTheDocument()
    expect(screen.getByText('Room detail')).toBeInTheDocument()
    expect(screen.getByText('Room asset studio')).toBeInTheDocument()
    expect(screen.getAllByText('Editable LiDAR room asset').length).toBeGreaterThan(0)
    expect(screen.getByText('Canonical room interior')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Studio' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Palace' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.queryByLabelText('Room memory field')).not.toBeInTheDocument()
    expect(screen.getAllByText('North Star').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Work Table').length).toBeGreaterThan(0)
    expect(screen.getAllByText('People Wall').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Evidence Desk').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Future Window').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Control Surface').length).toBeGreaterThan(0)
    expect(screen.getAllByText('A room preview.').length).toBeGreaterThan(0)
    expect(screen.getByText('Focused room view')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Enter desktop room' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Palace' }))

    expect(screen.getByLabelText('Room memory field')).toBeInTheDocument()
    expect(screen.getByText('Room interior')).toBeInTheDocument()
    expect(screen.getAllByText('Phone Checkpoint').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Floor Walk').length).toBeGreaterThan(0)

    await user.click(screen.getByRole('button', { name: 'Closets' }))

    expect(screen.getByText('Drawer preview')).toBeInTheDocument()
    expect(screen.getByText('Room outline')).toBeInTheDocument()
    expect(screen.getByText('actor -> Avery')).toBeInTheDocument()
    const recentJumps = await screen.findByLabelText('Recent world jumps')
    expect(within(recentJumps).getByText('Launch Garden')).toBeInTheDocument()
  })

  it('allows controlled selection across projection, room, drill stage, and locus', async () => {
    const user = userEvent.setup()
    const roomCards = [room(), room({ id: 'room-2', title: 'Retention Vault', summary: 'Long-lived follow-up context.' })]
    const locusCards = [
      locus(),
      locus({
        id: 'locus-2',
        title: 'Signal Desk',
        summary: 'A relay locus for follow-up tasks and escalation signals.',
        kindLabel: 'Desk',
        actorLabels: ['Avery', 'Retention Butler'],
        artifactLabels: ['Forecast board'],
      }),
    ]
    const onFocusRefSelect = vi.fn()

    function ControlledShell() {
      const [selectedProjectionId, setSelectedProjectionId] = useState('projection-3d')
      const [selectedRoomId, setSelectedRoomId] = useState('room-1')
      const [selectedDrillStageId, setSelectedDrillStageId] = useState<WorldDrillStageId>('room')
      const [selectedLocusId, setSelectedLocusId] = useState('locus-1')
      const [selectedClosetId, setSelectedClosetId] = useState('projection-room')

      const activeLocus = locusCards.find((item) => item.id === selectedLocusId) ?? locusCards[0]

      return (
        <WorldShell
          title="DewDrops"
          arrivalMode="never"
          hierarchy={{
            earth: 'Planetary memory',
            wing: 'Revenue wing',
            actor: 'Avery',
            room: 'Launch Garden',
          }}
          roomPreview={{
            title: 'Launch Garden',
            summary: 'A room preview.',
            surfaceLabel: 'Hybrid',
            memoryLabel: 'revenue/launch-garden',
            actorLabels: ['Avery'],
            actorItems: [
              {
                id: 'room-preview-actor-avery',
                label: 'room actor -> Avery',
                focusRef: worldRef('person', 'person-avery'),
              },
            ],
            locusLabels: ['North Star'],
            artifactLabels: ['Brief'],
            tunnelLabels: ['handoff'],
            tunnelItems: [
              {
                id: 'room-preview-tunnel-handoff',
                label: 'context tunnel -> Retention Vault',
                focusRef: worldRef('room', 'room-2'),
              },
            ],
            anchorLabels: ['entity/avery'],
            openQuestionLabels: ['Need launch brief'],
            phoneBrief: 'Phone relay brief',
            desktopBrief: 'Desktop brief',
          }}
          drillStages={[
            drillStage({
              id: 'earth',
              label: 'Earth',
              value: 'Planetary memory',
              detail: 'Planetary shell and return vector.',
            }),
            drillStage({
              id: 'wing',
              label: 'Wing',
              value: 'Revenue wing',
              detail: 'Actor anchor: Avery',
            }),
            drillStage({
              id: 'room',
              label: 'Room',
              value: selectedRoomId === 'room-2' ? 'Retention Vault' : 'Launch Garden',
              detail: 'Focused operating surface and memory frame.',
            }),
            drillStage({
              id: 'locus',
              label: 'Locus',
              value: activeLocus.title,
              detail: 'Room interior anchor for precise context.',
            }),
          ]}
          selectedDrillStageId={selectedDrillStageId}
          onDrillStageSelect={setSelectedDrillStageId}
          activeProjection={{
            id: 'room',
            modeLabel: 'Room',
            modeDetail: 'Focused room view',
            focusTitle: 'Launch Garden',
            summary: '3 actors, 2 loci, 1 artifact',
            breadcrumb: ['Planetary memory', 'Revenue wing', 'Launch Garden'],
            breadcrumbItems: [
              {
                id: 'breadcrumb-earth',
                label: 'Planetary memory',
                drillStageId: 'earth',
              },
              {
                id: 'breadcrumb-wing',
                label: 'Revenue wing',
                focusRef: worldRef('wing', 'wing-revenue'),
              },
              {
                id: 'breadcrumb-room',
                label: 'Launch Garden',
                focusRef: worldRef('room', 'room-1'),
              },
            ],
            stats: ['6 nodes', '4 links'],
            returnVectors: [
              {
                id: 'return-earth',
                label: 'Earth return',
                detail: 'Reset to the planetary shell and last known territory.',
                tone: 'calm',
                orbit: 'outer',
                drillStageId: 'earth',
              },
              {
                id: 'return-retention',
                label: 'Retention Vault',
                detail: 'Magnetic room return',
                tone: 'ready',
                orbit: 'inner',
                focusRef: worldRef('room', 'room-2'),
              },
            ],
            cards: [
              {
                id: 'room-1',
                title: 'Launch Garden',
                summary: 'Room focus',
                kind: 'Room',
                emphasis: 'focus',
                focusRef: worldRef('room', 'room-1'),
              },
            ],
            links: [
              {
                id: 'link-1',
                label: 'context tunnel',
                detail: 'Launch Garden -> Retention Vault',
                kind: 'tunnel',
                focusRef: worldRef('room', 'room-2'),
              },
            ],
            detailSections: [
              {
                id: 'section-1',
                title: 'Room outline',
                items: [
                  {
                    id: 'item-actor-avery',
                    label: 'actor -> Avery',
                    focusRef: worldRef('person', 'person-avery'),
                  },
                ],
                style: 'list',
              },
            ],
          }}
          projectionChips={[
            projection(),
            projection({ id: 'outline', label: 'Outline', detail: 'Readable summary' }),
          ]}
          selectedProjectionId={selectedProjectionId}
          onProjectionSelect={setSelectedProjectionId}
          roomCards={roomCards}
          selectedRoomId={selectedRoomId}
          onRoomSelect={setSelectedRoomId}
          locusCards={locusCards}
          selectedLocusId={selectedLocusId}
          onLocusSelect={setSelectedLocusId}
          locusPreview={locusPreview({
            title: activeLocus.title,
            summary: activeLocus.summary,
            kindLabel: activeLocus.kindLabel,
            actorLabels: activeLocus.actorLabels,
            artifactLabels: activeLocus.artifactLabels,
            actorItems: activeLocus.actorLabels?.map((label, index) => ({
              id: `locus-preview-actor-${index + 1}`,
              label,
              focusRef: worldRef(index === 0 ? 'person' : 'agent', index === 0 ? 'person-avery' : 'agent-retention'),
            })),
            artifactItems: activeLocus.artifactLabels?.map((label) => ({
              id: `locus-preview-artifact-${label.toLowerCase().replace(/\s+/g, '-')}`,
              label,
              focusRef: worldRef('artifact', 'artifact-forecast-board'),
            })),
          })}
          closetCards={[
            closet(),
            closet({
              id: 'closet-anchors',
              title: 'Anchor closet',
              sourceLabel: 'Memory bind',
              summary: 'Stable refs and loci that let the room collapse and unfold without losing shape.',
              drawers: [
                { id: 'anchor-entity-avery', label: 'entity/avery' },
                { id: 'anchor-locus-north-star', label: 'North Star', focusRef: worldRef('locus', 'locus-1') },
              ],
            }),
          ]}
          selectedClosetId={selectedClosetId}
          onClosetSelect={setSelectedClosetId}
          onFocusRefSelect={onFocusRefSelect}
        />
      )
    }

    render(<ControlledShell />)

    await user.click(screen.getByRole('button', { name: /Long-lived follow-up context/i }))
    await user.click(screen.getByRole('button', { name: /Outline/ }))
    await user.click(screen.getByRole('button', { name: /^Revenue wing$/i }))
    await user.click(screen.getByRole('button', { name: /^Earth return$/i }))
    await user.click(screen.getByRole('button', { name: /^Retention Vault$/i }))
    await user.click(screen.getByRole('button', { name: /Launch Garden Room focus/i }))
    await user.click(screen.getByRole('button', { name: /^context tunnelLaunch Garden -> Retention Vault$/i }))
    await user.click(screen.getByRole('button', { name: /^actor -> Avery$/i }))
    await user.click(screen.getByRole('button', { name: 'Palace' }))
    await user.click(screen.getByRole('button', { name: /^AveryActor 1 of 1$/i }))
    await user.click(screen.getByRole('button', { name: /^Retention VaultTunnel 1 of 1$/i }))
    await user.click(screen.getByRole('button', { name: /Room interior anchor for precise context/i }))
    await user.click(screen.getByRole('button', { name: /A relay locus for follow-up tasks/i }))
    await user.click(screen.getByRole('button', { name: 'Closets' }))
    await user.click(screen.getByRole('button', { name: /Stable refs and loci that let the room collapse/i }))
    await user.click(screen.getByRole('button', { name: /^North Star$/i }))

    expect(screen.getByRole('button', { name: /Long-lived follow-up context/i })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /Outline.*Readable summary/i })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /A relay locus for follow-up tasks/i })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /Signal Desk.*Room interior anchor for precise context/i })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /Stable refs and loci that let the room collapse/i })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /^North Star$/i })).toBeInTheDocument()
    expect(onFocusRefSelect).toHaveBeenCalledWith(worldRef('wing', 'wing-revenue'))
    expect(onFocusRefSelect).toHaveBeenCalledWith(worldRef('room', 'room-1'))
    expect(onFocusRefSelect).toHaveBeenCalledWith(worldRef('room', 'room-2'))
    expect(onFocusRefSelect).toHaveBeenCalledWith(worldRef('person', 'person-avery'))
    expect(onFocusRefSelect).toHaveBeenCalledWith(worldRef('locus', 'locus-1'))
    expect(screen.getAllByText('A relay locus for follow-up tasks and escalation signals.')).toHaveLength(2)
    const recentJumps = await screen.findByLabelText('Recent world jumps')
    expect(within(recentJumps).getByText('Signal Desk')).toBeInTheDocument()
  }, 10000)
})
