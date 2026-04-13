import type { BoardWire, WorkflowCard } from '../types'
import { problemEnvelopePad, swarmMassForProblem, swarmUnionBounds } from '../swarmAgents'

/** Half-size of wire canvas in world px; must cover card positions (paths use same coords as cards). */
export const WIRE_CANVAS_EXTENT = 12000

type SwarmEnvelopeLayerProps = {
  cards: WorkflowCard[]
  wires: BoardWire[]
}

export function SwarmEnvelopeLayer({ cards, wires }: SwarmEnvelopeLayerProps) {
  void wires
  const problems = cards.filter((c) => c.kind === 'problem')
  const ex = WIRE_CANVAS_EXTENT
  const wh = ex * 2
  return (
    <svg
      className="freeform-envelope-svg"
      aria-hidden
      viewBox={`${-ex} ${-ex} ${wh} ${wh}`}
      preserveAspectRatio="xMinYMin meet"
      width={wh}
      height={wh}
      style={{
        position: 'absolute',
        left: -ex,
        top: -ex,
      }}
    >
      <defs>
        <linearGradient id="freeform-envelope-water" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="rgba(120, 200, 255, 0.14)" />
          <stop offset="45%" stopColor="rgba(255, 120, 110, 0.1)" />
          <stop offset="100%" stopColor="rgba(180, 230, 255, 0.12)" />
        </linearGradient>
      </defs>
      {problems.map((p) => {
        if (swarmMassForProblem(p.id, cards, wires) === 0) return null
        const u = swarmUnionBounds(p.id, cards, wires)
        if (!u) return null
        const pad = problemEnvelopePad(p)
        const x = u.minX - pad
        const y = u.minY - pad
        const w = u.maxX - u.minX + pad * 2
        const h = u.maxY - u.minY + pad * 2
        const rx = Math.min(44, w * 0.14, h * 0.14)
        return (
          <rect
            key={p.id}
            className="freeform-swarm-envelope-rect"
            x={x}
            y={y}
            width={w}
            height={h}
            rx={rx}
            ry={rx}
            fill="url(#freeform-envelope-water)"
          />
        )
      })}
    </svg>
  )
}
