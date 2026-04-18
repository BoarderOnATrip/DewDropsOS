import type { CSSProperties } from 'react'
import './roomAssetStudio.css'

export type RoomAssetTone = 'ready' | 'attention' | 'calm' | 'missing'

export type RoomAssetStudioZone = {
  id: string
  label: string
  summary: string
  tone?: RoomAssetTone
}

export type RoomAssetStudioPortal = {
  id: string
  label: string
  summary: string
  target: string
  tone?: RoomAssetTone
}

export type RoomAssetStudioLocus = {
  id: string
  label: string
  summary: string
  tone?: RoomAssetTone
}

export type RoomAssetStudioProp = {
  id: string
  label: string
  summary: string
  tone?: RoomAssetTone
}

export type RoomAssetStudioMediaSurface = {
  id: string
  label: string
  summary: string
  format: string
  tone?: RoomAssetTone
}

export type RoomAssetStudioAsset = {
  id: string
  title: string
  summary: string
  roomLabel?: string
  memoryLabel?: string
  captureLabel?: string
  editLabel?: string
  zones: RoomAssetStudioZone[]
  portals: RoomAssetStudioPortal[]
  loci: RoomAssetStudioLocus[]
  props: RoomAssetStudioProp[]
  mediaSurfaces: RoomAssetStudioMediaSurface[]
  notes?: string[]
}

export type RoomAssetStudioProps = {
  asset: RoomAssetStudioAsset
  selectedZoneId?: string | null
  selectedPortalId?: string | null
  onZoneSelect?: (zoneId: string) => void
  onPortalSelect?: (portalId: string) => void
  className?: string
}

// This component stays presentation-first and consumes a studio-facing adapter shape.
// The canonical asset model lives in src/spatial/roomAsset.ts.

function toneClass(tone?: RoomAssetTone): string {
  if (tone === 'ready') return 'is-ready'
  if (tone === 'attention') return 'is-attention'
  if (tone === 'missing') return 'is-missing'
  return 'is-calm'
}

function positionOnRing(index: number, total: number, radius: number): CSSProperties {
  if (total <= 0) {
    return {
      left: '50%',
      top: '50%',
      transform: 'translate(-50%, -50%)',
    }
  }

  const angle = -90 + (360 / total) * index
  const radians = (angle * Math.PI) / 180
  const x = 50 + Math.cos(radians) * radius
  const y = 50 + Math.sin(radians) * radius

  return {
    left: `${x}%`,
    top: `${y}%`,
    transform: 'translate(-50%, -50%)',
  }
}

function zonePositionStyle(zoneId: string, index: number, total: number): CSSProperties {
  const explicit: Record<string, CSSProperties> = {
    north_star: { left: '50%', top: '12%' },
    door: { left: '50%', top: '69%' },
    people_wall: { left: '12%', top: '32%' },
    work_table: { left: '49%', top: '52%' },
    evidence_desk: { left: '80%', top: '48%' },
    future_window: { left: '82%', top: '20%' },
    control_surface: { left: '64%', top: '29%' },
    archive_shelf: { left: '18%', top: '19%' },
    closet: { left: '18%', top: '63%' },
    drawer: { left: '33%', top: '65%' },
    phone_checkpoint: { left: '78%', top: '68%' },
  }

  return explicit[zoneId] ?? positionOnRing(index, total, 30)
}

function portalPositionStyle(index: number): CSSProperties {
  const positions: CSSProperties[] = [
    { left: '50%', top: '85%' },
    { left: '87%', top: '42%' },
    { left: '13%', top: '44%' },
    { left: '50%', top: '16%' },
  ]
  return positions[index % positions.length] ?? positions[0]
}

function renderEmptyState(label: string, detail: string) {
  return (
    <div className="room-asset-studio-empty">
      <strong>{label}</strong>
      <span>{detail}</span>
    </div>
  )
}

export function RoomAssetStudio({
  asset,
  selectedZoneId,
  selectedPortalId,
  onZoneSelect,
  onPortalSelect,
  className,
}: RoomAssetStudioProps) {
  const activeZone = asset.zones.find((zone) => zone.id === selectedZoneId) ?? asset.zones[0] ?? null
  const activePortal =
    asset.portals.find((portal) => portal.id === selectedPortalId) ?? asset.portals[0] ?? null

  const rootClassName = `room-asset-studio${className ? ` ${className}` : ''}`

  return (
    <section className={rootClassName} aria-label="Room asset studio">
      <header className="room-asset-studio-header">
        <div>
          <p className="room-asset-studio-kicker">Room asset studio</p>
          <h2>{asset.title}</h2>
          <p className="room-asset-studio-summary">{asset.summary}</p>
        </div>
        <div className="room-asset-studio-chip-row" aria-label="Room metadata">
          {asset.roomLabel ? <span className="room-asset-studio-chip">{asset.roomLabel}</span> : null}
          {asset.memoryLabel ? <span className="room-asset-studio-chip">{asset.memoryLabel}</span> : null}
          {asset.captureLabel ? <span className="room-asset-studio-chip">{asset.captureLabel}</span> : null}
          {asset.editLabel ? <span className="room-asset-studio-chip">{asset.editLabel}</span> : null}
        </div>
      </header>

      <div className="room-asset-studio-grid">
        <section className="room-asset-studio-stage" aria-label="Room studio stage">
          <div className="room-asset-studio-shell">
            <div className="room-asset-studio-room-light" />
            <div className="room-asset-studio-back-wall" />
            <div className="room-asset-studio-side-wall is-left" />
            <div className="room-asset-studio-side-wall is-right" />
            <div className="room-asset-studio-door-cut" />
            <div className="room-asset-studio-window-cut" />
            <div className="room-asset-studio-floor" />
            <div className="room-asset-studio-rug" />
            <div className="room-asset-studio-desk-shadow" />

            <div className="room-asset-studio-zone-layer" aria-label="Room zones">
              {asset.zones.length > 0
                ? asset.zones.map((zone, index) => {
                    const selected = zone.id === activeZone?.id
                    return (
                      <button
                        key={zone.id}
                        type="button"
                        className={`room-asset-studio-node room-asset-studio-zone room-asset-studio-zone-${zone.id} ${toneClass(zone.tone)}${selected ? ' is-selected' : ''}`}
                        style={zonePositionStyle(zone.id, index, asset.zones.length)}
                        onClick={() => onZoneSelect?.(zone.id)}
                        aria-pressed={selected}
                        disabled={!onZoneSelect}
                        aria-label={`${zone.label} ${zone.summary}`}
                      >
                        <span>Zone</span>
                        <strong>{zone.label}</strong>
                        <p>{zone.summary}</p>
                      </button>
                    )
                  })
                : renderEmptyState('No zones yet', 'Add door, wall, shelf, drawer, window, console, or floor zones.')}
            </div>

            <div className="room-asset-studio-portal-layer" aria-label="Room portals">
              {asset.portals.length > 0
                ? asset.portals.map((portal, index) => {
                    const selected = portal.id === activePortal?.id
                    return (
                      <button
                        key={portal.id}
                        type="button"
                        className={`room-asset-studio-node room-asset-studio-portal ${toneClass(portal.tone)}${selected ? ' is-selected' : ''}`}
                        style={portalPositionStyle(index)}
                        onClick={() => onPortalSelect?.(portal.id)}
                        aria-pressed={selected}
                        disabled={!onPortalSelect}
                        aria-label={`${portal.label} ${portal.summary}`}
                      >
                        <span>Portal</span>
                        <strong>{portal.label}</strong>
                        <p>{portal.summary}</p>
                      </button>
                    )
                  })
                : null}
            </div>

            <div className="room-asset-studio-core">
              <p className="room-asset-studio-kicker">Zone spotlight</p>
              <strong>{activeZone?.label ?? 'Awaiting zone'}</strong>
              <span>{activeZone?.summary ?? 'Choose a zone to inspect the room interior.'}</span>
              {activePortal ? (
                <div className="room-asset-studio-core-portal">
                  <p className="room-asset-studio-kicker">Portal line</p>
                  <strong>{activePortal.label}</strong>
                  <span>{activePortal.target}</span>
                </div>
              ) : null}
            </div>
          </div>

          <article className="room-asset-studio-walk-strip" aria-label="Room loci">
            <div className="room-asset-studio-panel-head">
              <div>
                <p className="room-asset-studio-kicker">Memory walk</p>
                <h3>Loci in order</h3>
              </div>
              <span className="room-asset-studio-chip">{asset.loci.length} loci</span>
            </div>
            <div className="room-asset-studio-walk-grid">
              {asset.loci.length > 0
                ? asset.loci.map((locus) => (
                    <div key={locus.id} className={`room-asset-studio-locus ${toneClass(locus.tone)}`}>
                      <span>Locus</span>
                      <strong>{locus.label}</strong>
                      <p>{locus.summary}</p>
                    </div>
                  ))
                : renderEmptyState('No loci anchored yet', 'Place a North Star, console, drawer, or shelf locus.')}
            </div>
          </article>

          <div className="room-asset-studio-surface-strip">
            <article className="room-asset-studio-surface-card">
              <strong>Props</strong>
              <div className="room-asset-studio-surface-grid">
                {asset.props.length > 0
                  ? asset.props.map((prop) => (
                      <div key={prop.id} className={`room-asset-studio-surface-tile ${toneClass(prop.tone)}`}>
                        <span>{prop.label}</span>
                        <p>{prop.summary}</p>
                      </div>
                    ))
                  : renderEmptyState('No props yet', 'Add cards, models, devices, or other anchored objects.')}
              </div>
            </article>

            <article className="room-asset-studio-surface-card">
              <strong>Media surfaces</strong>
              <div className="room-asset-studio-surface-grid">
                {asset.mediaSurfaces.length > 0
                  ? asset.mediaSurfaces.map((surface) => (
                      <div key={surface.id} className={`room-asset-studio-surface-tile ${toneClass(surface.tone)}`}>
                        <span>{surface.format}</span>
                        <p>{surface.label}</p>
                        <small>{surface.summary}</small>
                      </div>
                    ))
                  : renderEmptyState('No media surfaces yet', 'Add capture, scan, image, or video surfaces.')}
              </div>
            </article>
          </div>
        </section>

        <aside className="room-asset-studio-inspector">
          <article className="room-asset-studio-panel">
            <div className="room-asset-studio-panel-head">
              <div>
                <p className="room-asset-studio-kicker">Zones</p>
                <h3>Canonical room interior</h3>
              </div>
              <span className="room-asset-studio-chip">{asset.zones.length} zones</span>
            </div>
            <div className="room-asset-studio-panel-list">
              {asset.zones.length > 0
                ? asset.zones.map((zone) => {
                    const selected = zone.id === activeZone?.id
                    return (
                      <button
                        key={zone.id}
                        type="button"
                        className={`room-asset-studio-panel-item ${toneClass(zone.tone)}${selected ? ' is-selected' : ''}`}
                        onClick={() => onZoneSelect?.(zone.id)}
                        aria-pressed={selected}
                        disabled={!onZoneSelect}
                      >
                        <strong>{zone.label}</strong>
                        <span>{zone.summary}</span>
                      </button>
                    )
                  })
                : renderEmptyState('No zones configured', 'Wire in the canonical room template here.')}
            </div>
          </article>

          <article className="room-asset-studio-panel">
            <div className="room-asset-studio-panel-head">
              <div>
                <p className="room-asset-studio-kicker">Portals</p>
                <h3>Room exits</h3>
              </div>
              <span className="room-asset-studio-chip">{asset.portals.length} portals</span>
            </div>
            <div className="room-asset-studio-panel-list">
              {asset.portals.length > 0
                ? asset.portals.map((portal) => {
                    const selected = portal.id === activePortal?.id
                    return (
                      <button
                        key={portal.id}
                        type="button"
                        className={`room-asset-studio-panel-item ${toneClass(portal.tone)}${selected ? ' is-selected' : ''}`}
                        onClick={() => onPortalSelect?.(portal.id)}
                        aria-pressed={selected}
                        disabled={!onPortalSelect}
                      >
                        <strong>{portal.label}</strong>
                        <span>{portal.target}</span>
                        <small>{portal.summary}</small>
                      </button>
                    )
                  })
                : renderEmptyState('No portals configured', 'Add exits that point into adjacent rooms or corridors.')}
            </div>
          </article>

          <article className="room-asset-studio-panel">
            <div className="room-asset-studio-panel-head">
              <div>
                <p className="room-asset-studio-kicker">Notes</p>
                <h3>Room metadata</h3>
              </div>
            </div>
            {asset.notes?.length ? (
              <ul className="room-asset-studio-note-list">
                {asset.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            ) : (
              renderEmptyState('No notes yet', 'Use this panel for room memory, constraints, or editorial guidance.')
            )}
          </article>
        </aside>
      </div>
    </section>
  )
}
