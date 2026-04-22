import type { MediaRuntimeLane } from '../lib/mediaRuntime'
import type { SpatialRoomScene, SpatialRoomZoneId } from './spatialRoom'
import './spatialRoom.css'

export type SpatialRoomStageProps = {
  scene: SpatialRoomScene
  size?: 'full' | 'compact'
  onZoneSelect?: (zoneId: SpatialRoomZoneId) => void
  onWalkItemSelect?: (walkItemId: string) => void
  className?: string
}

function toneClass(tone: MediaRuntimeLane['tone']): string {
  if (tone === 'ready') return 'is-ready'
  if (tone === 'attention') return 'is-attention'
  return 'is-calm'
}

export function SpatialRoomStage({
  scene,
  size = 'full',
  onZoneSelect,
  onWalkItemSelect,
  className,
}: SpatialRoomStageProps) {
  const fullClassName = `spatial-room-stage is-${size}${className ? ` ${className}` : ''}`

  return (
    <div className={fullClassName}>
      <div className="spatial-room-stage-head">
        <div>
          <p className="spatial-room-kicker">Spatial room</p>
          <h3>{scene.subtitle}</h3>
        </div>
        <div className="spatial-room-chip-row">
          <span className="spatial-room-chip">{scene.captureLabel}</span>
          <span className="spatial-room-chip">{scene.editLabel}</span>
        </div>
      </div>

      <div className="spatial-room-shell" aria-label="Spatial room scene">
        <div className="spatial-room-light" />
        <div className="spatial-room-wall spatial-room-wall-left" />
        <div className="spatial-room-wall spatial-room-wall-center" />
        <div className="spatial-room-wall spatial-room-wall-right" />
        <div className="spatial-room-floor" />
        <div className="spatial-room-rug" />

        {scene.nodes.map((node) => {
          const content = (
            <>
              <strong>{node.title}</strong>
              <span>{node.summary}</span>
              {node.itemCount !== undefined ? <small>{node.itemCount} items</small> : null}
            </>
          )
          const nodeClassName = `spatial-room-node spatial-room-node-${node.zoneId} ${toneClass(node.tone)}`

          if (onZoneSelect) {
            return (
              <button
                key={node.id}
                type="button"
                className={nodeClassName}
                onClick={() => onZoneSelect(node.zoneId)}
                aria-label={`${node.title} ${node.summary}`}
              >
                {content}
              </button>
            )
          }

          return (
            <div key={node.id} className={nodeClassName}>
              {content}
            </div>
          )
        })}

        <div className="spatial-room-walk">
          {scene.walk.map((item) => {
            const walkClassName = `spatial-room-walk-item ${toneClass(item.tone)}`
            if (onWalkItemSelect) {
              return (
                <button
                  key={item.id}
                  type="button"
                  className={walkClassName}
                  onClick={() => onWalkItemSelect(item.id)}
                >
                  {item.label}
                </button>
              )
            }
            return (
              <div key={item.id} className={walkClassName}>
                {item.label}
              </div>
            )
          })}
        </div>
      </div>

      <p className="spatial-room-summary">{scene.summary}</p>
      <p className="spatial-room-memory">{scene.memoryLabel}</p>

      <div className="spatial-room-runtime">
        <div className="spatial-room-runtime-head">
          <p className="spatial-room-kicker">Native media runtime</p>
          <strong>{scene.orchestrationLabel}</strong>
        </div>
        <div className="spatial-room-runtime-grid">
          {scene.runtimeLanes.map((lane) => (
            <article key={lane.id} className={`spatial-room-runtime-card ${toneClass(lane.tone)}`}>
              <span>{lane.platform}</span>
              <strong>{lane.label}</strong>
              <p>{lane.summary}</p>
            </article>
          ))}
        </div>
      </div>
    </div>
  )
}
