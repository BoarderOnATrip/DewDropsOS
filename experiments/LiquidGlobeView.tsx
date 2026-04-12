import { useEffect, useMemo, useRef, useState, type MouseEvent, type PointerEvent } from 'react'
import './App.css'

type Droplet = {
  id: number
  x: number
  y: number
  vx: number
  vy: number
  mass: number
  isolated: boolean
  /** Smoothed 0..1+ from interaction impulses — drives squash/jiggle visuals */
  jiggle: number
}

type LightSource = {
  id: number
  x: number
  y: number
  intensity: number
  color: string
}

type Camera = {
  zoom: number
  x: number
  y: number
}

type PhysicsTuning = {
  viscosity: number
  cohesion: number
  repulsion: number
  repulsionRadius: number
  wobble: number
  isolationField: number
  throwBoost: number
  forceMergeSpeed: number
  inertialFriction: number
  velocitySmoothing: number
  /** Min overlap (world units) before a forced slam can blend two droplets */
  blendOverlapMin: number
  /** Spring strength toward magnetic rest length between nearby droplets */
  magneticSpring: number
  /** Preferred gap (world units) at rest for magnetic links */
  magneticRestGap: number
  /** Max distance (world) for magnetic spring (invisible pull toward mosaic) */
  magneticReach: number
  /** Beyond touching radius: max gap (world) where soap-film mosaic links still appear */
  soapFilmMaxGap: number
  /** Extra repulsion while overlapping but below blend depth — keeps foam tiles separate */
  foamSeparation: number
  /** Extra padding beyond touching radius for BFS cluster while dragging */
  clusterLinkPadding: number
  /** Screen px/ms above this tears the drag cluster (only grabbed droplet moves) */
  ripScreenSpeed: number
}

const MIN_MASS = 30
const MAX_MASS = 220
const WORLD_SIZE = 1600

function radiusFromMass(mass: number): number {
  return Math.sqrt(mass) * 1.9
}

function clampMass(mass: number): number {
  return Math.max(MIN_MASS, Math.min(MAX_MASS, mass))
}

/** Quadratic soap film between two circles in screen space (surface to surface). */
function soapFilmPathScreen(
  ax: number,
  ay: number,
  ar: number,
  bx: number,
  by: number,
  br: number,
): string {
  const dx = bx - ax
  const dy = by - ay
  const len = Math.hypot(dx, dy)
  if (len < 0.001) return ''
  const ux = dx / len
  const uy = dy / len
  const x1 = ax + ux * ar
  const y1 = ay + uy * ar
  const x2 = bx - ux * br
  const y2 = by - uy * br
  const mx = (x1 + x2) * 0.5
  const my = (y1 + y2) * 0.5
  const sag = Math.min(len * 0.24, 42)
  const cx = mx - uy * sag
  const cy = my + ux * sag
  return `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`
}

/** Droplets that touch or are within padding form one draggable cluster (isolated excluded). */
function buildClusterLinkSet(droplets: Droplet[], rootId: number, linkPadding: number): Set<number> {
  const byId = new Map(droplets.map((d) => [d.id, d]))
  const root = byId.get(rootId)
  if (!root) return new Set([rootId])
  if (root.isolated) return new Set([rootId])
  const visited = new Set<number>([rootId])
  const queue = [rootId]
  while (queue.length > 0) {
    const id = queue.pop()!
    const d = byId.get(id)!
    for (const other of droplets) {
      if (other.id === id || other.isolated || visited.has(other.id)) continue
      const linkDist = radiusFromMass(d.mass) + radiusFromMass(other.mass) + linkPadding
      if (Math.hypot(other.x - d.x, other.y - d.y) <= linkDist) {
        visited.add(other.id)
        queue.push(other.id)
      }
    }
  }
  return visited
}

export function LiquidGlobeView() {
  const worldRef = useRef<HTMLDivElement | null>(null)
  const [size, setSize] = useState({ width: 960, height: 640 })
  const [droplets, setDroplets] = useState<Droplet[]>([])
  const [lights, setLights] = useState<LightSource[]>([])
  const [camera, setCamera] = useState<Camera>({ zoom: 1, x: 0, y: 0 })
  /** Spin the planetoid view (radians). Physics stay in world space; this rotates display + picking. */
  const [globeRotation, setGlobeRotation] = useState(0)
  const [coreView, setCoreView] = useState(false)
  const [tuning, setTuning] = useState<PhysicsTuning>({
    viscosity: 0.972,
    cohesion: 0.0028,
    repulsion: 0.022,
    repulsionRadius: 165,
    wobble: 0.09,
    isolationField: 2.2,
    throwBoost: 0.55,
    forceMergeSpeed: 0.88,
    inertialFriction: 0.985,
    velocitySmoothing: 0.72,
    blendOverlapMin: 15,
    magneticSpring: 0.014,
    magneticRestGap: 3,
    magneticReach: 340,
    soapFilmMaxGap: 36,
    foamSeparation: 0.026,
    clusterLinkPadding: 88,
    ripScreenSpeed: 1.65,
  })
  const nextId = useRef(1)
  const nextLightId = useRef(1)
  const dragId = useRef<number | null>(null)
  const dragMotion = useRef<{ id: number; x: number; y: number; ts: number; vx: number; vy: number } | null>(null)
  const panPointer = useRef<number | null>(null)
  const lastPanPoint = useRef<{ x: number; y: number } | null>(null)
  const globeSpinRef = useRef<{ pointerId: number; lastAngle: number } | null>(null)
  const dropletsRef = useRef<Droplet[]>([])
  const dragActiveClusterRef = useRef<Set<number>>(new Set())
  const dragClusterTornRef = useRef(false)
  const dragPrevWorldRef = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    dropletsRef.current = droplets
  }, [droplets])

  const worldRadius = useMemo(
    () => Math.max(140, Math.min(size.width, size.height) * 0.43),
    [size.height, size.width],
  )
  const center = useMemo(
    () => ({ x: size.width / 2, y: size.height / 2 }),
    [size.height, size.width],
  )

  useEffect(() => {
    if (!worldRef.current) return
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0].contentRect
      setSize({ width: rect.width, height: rect.height })
    })
    observer.observe(worldRef.current)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (droplets.length > 0) return
    const seed: Droplet[] = Array.from({ length: 18 }, (_, i) => {
      const mass = 45 + (i % 5) * 22
      const angle = (i / 18) * Math.PI * 2
      const radial = 180 + (i % 4) * 120
      return {
        id: nextId.current++,
        x: Math.cos(angle) * radial,
        y: Math.sin(angle) * radial,
        vx: (Math.random() - 0.5) * 0.8,
        vy: (Math.random() - 0.5) * 0.8,
        mass,
        isolated: false,
        jiggle: 0,
      }
    })
    seed.push({
      id: nextId.current++,
      x: 260,
      y: -90,
      vx: 0,
      vy: 0,
      mass: 180,
      isolated: false,
      jiggle: 0,
    })
    setDroplets(seed)
  }, [droplets.length])

  useEffect(() => {
    if (lights.length > 0) return
    setLights([
      { id: nextLightId.current++, x: -280, y: -180, intensity: 1, color: '#a7e6ff' },
      { id: nextLightId.current++, x: 260, y: 120, intensity: 0.8, color: '#80aaff' },
      { id: nextLightId.current++, x: 30, y: -320, intensity: 0.6, color: '#d4f3ff' },
    ])
  }, [lights.length])

  useEffect(() => {
    if (droplets.length === 0) return

    let frame = 0
    let raf = 0
    const step = () => {
      frame += 1
      setDroplets((current) => {
        if (current.length === 0) return current
        const next = current.map((d) => ({ ...d }))
        const velocitySnapshot = new Map(next.map((d) => [d.id, { vx: d.vx, vy: d.vy }]))
        const maxMass = Math.max(...next.map((d) => d.mass))
        const gravity = 0.0018

        const dragFrozen =
          dragId.current !== null ? dragActiveClusterRef.current : new Set<number>()

        for (let i = 0; i < next.length; i += 1) {
          for (let j = i + 1; j < next.length; j += 1) {
            const a = next[i]
            const b = next[j]
            if (dragFrozen.has(a.id) || dragFrozen.has(b.id)) continue
            const dx = b.x - a.x
            const dy = b.y - a.y
            const dist2 = dx * dx + dy * dy + 0.001
            const dist = Math.sqrt(dist2)
            const nx = dx / dist
            const ny = dy / dist
            const pairR = radiusFromMass(a.mass) + radiusFromMass(b.mass)
            const overlap = pairR - dist
            // Long-range attraction for coherent clustering.
            const force = (gravity * tuning.cohesion * a.mass * b.mass) / dist2

            // Heavier droplets attract neighbors more aggressively, but
            // short-range pressure prevents unstable collapse.
            const weightBoostA = 1 + a.mass / maxMass
            const weightBoostB = 1 + b.mass / maxMass

            const isolationPair = a.isolated || b.isolated
            const isolationBoost = isolationPair ? tuning.isolationField : 1
            const shortRange = Math.max(0, tuning.repulsionRadius - dist) / tuning.repulsionRadius
            const foamHold =
              !isolationPair && overlap > 0 && overlap < tuning.blendOverlapMin
                ? tuning.foamSeparation * (overlap / tuning.blendOverlapMin)
                : 0
            const repulsionForce =
              tuning.repulsion * shortRange * shortRange * (1 + overlap * 0.04) + foamHold
            const direction = isolationPair ? -1 : 1

            const finalAx = (direction * force * isolationBoost - repulsionForce) * nx
            const finalAy = (direction * force * isolationBoost - repulsionForce) * ny
            a.vx += (finalAx * weightBoostB) / a.mass
            a.vy += (finalAy * weightBoostB) / a.mass
            b.vx -= (finalAx * weightBoostA) / b.mass
            b.vy -= (finalAy * weightBoostA) / b.mass

            // Magnetic spring: pull toward a pleasant rest separation (useful connections).
            if (!isolationPair && dist < tuning.magneticReach && dist > 0.001) {
              const restLen = pairR + tuning.magneticRestGap
              const stretch = dist - restLen
              const falloff = 1 - dist / tuning.magneticReach
              const fMag = tuning.magneticSpring * stretch * falloff
              a.vx += (nx * fMag) / a.mass
              a.vy += (ny * fMag) / a.mass
              b.vx -= (nx * fMag) / b.mass
              b.vy -= (ny * fMag) / b.mass
            }

          }
        }

        for (let i = 0; i < next.length; i += 1) {
          const d = next[i]
          if (dragFrozen.has(d.id)) continue
          const snap = velocitySnapshot.get(d.id) ?? { vx: d.vx, vy: d.vy }
          const impulse = Math.hypot(d.vx - snap.vx, d.vy - snap.vy)
          d.jiggle = Math.min(1.35, d.jiggle * 0.76 + impulse * 0.32)
        }

        for (let i = 0; i < next.length; i += 1) {
          const d = next[i]
          if (dragId.current !== null && dragActiveClusterRef.current.has(d.id)) continue
          const dragFriction = dragId.current === null ? tuning.inertialFriction : tuning.viscosity
          d.vx *= dragFriction
          d.vy *= dragFriction
          d.x += d.vx
          d.y += d.vy

          const worldR = WORLD_SIZE / 2 - radiusFromMass(d.mass)
          const distFromCenter = Math.sqrt(d.x * d.x + d.y * d.y)
          if (distFromCenter > worldR) {
            const nx = d.x / distFromCenter
            const ny = d.y / distFromCenter
            d.x = nx * worldR
            d.y = ny * worldR
            const dot = d.vx * nx + d.vy * ny
            d.vx -= 1.8 * dot * nx
            d.vy -= 1.8 * dot * ny
            d.jiggle = Math.min(1.35, d.jiggle + 0.14)
          }
          d.jiggle *= 0.978
        }

        const merged: Droplet[] = []
        const consumed = new Set<number>()
        for (let i = 0; i < next.length; i += 1) {
          if (consumed.has(next[i].id)) continue
          let primary = { ...next[i] }
          for (let j = i + 1; j < next.length; j += 1) {
            if (consumed.has(next[j].id)) continue
            const candidate = next[j]
            if (dragId.current !== null && (dragFrozen.has(primary.id) || dragFrozen.has(candidate.id))) {
              continue
            }
            const dx = candidate.x - primary.x
            const dy = candidate.y - primary.y
            const dist = Math.sqrt(dx * dx + dy * dy)
            const overlap = radiusFromMass(primary.mass) + radiusFromMass(candidate.mass) - dist
            const relativeSpeed = Math.abs(primary.vx - candidate.vx) + Math.abs(primary.vy - candidate.vy)
            // Soap foam: meet and share films (mosaic). Only blend when forced — deep overlap + impact.
            const forcedBlend =
              overlap >= tuning.blendOverlapMin && relativeSpeed >= tuning.forceMergeSpeed
            if (!primary.isolated && !candidate.isolated && forcedBlend) {
              const totalMass = clampMass(primary.mass + candidate.mass)
              primary = {
                ...primary,
                x: (primary.x * primary.mass + candidate.x * candidate.mass) / (primary.mass + candidate.mass),
                y: (primary.y * primary.mass + candidate.y * candidate.mass) / (primary.mass + candidate.mass),
                vx: (primary.vx * primary.mass + candidate.vx * candidate.mass) / (primary.mass + candidate.mass),
                vy: (primary.vy * primary.mass + candidate.vy * candidate.mass) / (primary.mass + candidate.mass),
                mass: totalMass,
                jiggle: Math.min(1.35, primary.jiggle * 0.55 + candidate.jiggle * 0.55 + 0.28),
              }
              consumed.add(candidate.id)
            }
          }
          merged.push(primary)
        }

        return frame % 2 === 0 ? merged : merged.map((d) => ({ ...d }))
      })
      raf = requestAnimationFrame(step)
    }

    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [droplets.length, tuning])

  const totalMass = useMemo(
    () => droplets.reduce((acc, droplet) => acc + droplet.mass, 0).toFixed(0),
    [droplets],
  )

  /** Soap-film edges of the mosaic: only where bubbles meet or nearly meet. */
  const mosaicFilms = useMemo(() => {
    const list: Array<{ aId: number; bId: number; strength: number }> = []
    for (let i = 0; i < droplets.length; i += 1) {
      for (let j = i + 1; j < droplets.length; j += 1) {
        const a = droplets[i]
        const b = droplets[j]
        if (a.isolated || b.isolated) continue
        const pairR = radiusFromMass(a.mass) + radiusFromMass(b.mass)
        const dist = Math.hypot(b.x - a.x, b.y - a.y)
        const maxD = pairR + tuning.soapFilmMaxGap
        if (dist > maxD || dist < 0.001) continue
        const span = Math.max(1e-6, tuning.soapFilmMaxGap)
        const strength =
          dist <= pairR ? 1 : Math.max(0, Math.min(1, 1 - (dist - pairR) / span))
        list.push({ aId: a.id, bId: b.id, strength })
      }
    }
    return list
  }, [droplets, tuning.soapFilmMaxGap])

  function screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    const vx = (screenX - center.x) / camera.zoom
    const vy = (screenY - center.y) / camera.zoom
    const c = Math.cos(-globeRotation)
    const s = Math.sin(-globeRotation)
    return {
      x: vx * c - vy * s + camera.x,
      y: vx * s + vy * c + camera.y,
    }
  }

  function worldToScreen(worldX: number, worldY: number): { x: number; y: number } {
    const dx = worldX - camera.x
    const dy = worldY - camera.y
    const c = Math.cos(globeRotation)
    const s = Math.sin(globeRotation)
    const rx = dx * c - dy * s
    const ry = dx * s + dy * c
    return {
      x: center.x + rx * camera.zoom,
      y: center.y + ry * camera.zoom,
    }
  }

  function addDroplet(worldX: number, worldY: number): void {
    setDroplets((current) => [
      ...current,
      {
        id: nextId.current++,
        x: worldX,
        y: worldY,
        vx: (Math.random() - 0.5) * 1.8,
        vy: (Math.random() - 0.5) * 1.8,
        mass: 42,
        isolated: false,
        jiggle: 0,
      },
    ])
  }

  function splitDroplet(id: number): void {
    setDroplets((current) => {
      const source = current.find((d) => d.id === id)
      if (!source || source.mass < MIN_MASS * 2) return current
      const childMass = Math.max(MIN_MASS, source.mass * 0.38)
      const parentMass = clampMass(source.mass - childMass)
      return current.flatMap((d) => {
        if (d.id !== id) return [d]
        const r = radiusFromMass(d.mass)
        const angle = Math.random() * Math.PI * 2
        return [
          {
            ...d,
            mass: parentMass,
            vx: d.vx - Math.cos(angle) * 0.8,
            vy: d.vy - Math.sin(angle) * 0.8,
            jiggle: Math.min(1.35, d.jiggle * 0.85 + 0.12),
          },
          {
            id: nextId.current++,
            x: d.x + Math.cos(angle) * (r * 0.7),
            y: d.y + Math.sin(angle) * (r * 0.7),
            vx: d.vx + Math.cos(angle) * 1.2,
            vy: d.vy + Math.sin(angle) * 1.2,
            mass: childMass,
            isolated: d.isolated,
            jiggle: Math.min(1.35, d.jiggle * 0.75 + 0.18),
          },
        ]
      })
    })
  }

  function toggleIsolation(id: number): void {
    setDroplets((current) =>
      current.map((d) => (d.id === id ? { ...d, isolated: !d.isolated } : d)),
    )
  }

  function addLight(worldX: number, worldY: number): void {
    setLights((current) => [
      ...current,
      {
        id: nextLightId.current++,
        x: worldX,
        y: worldY,
        intensity: 0.75,
        color: '#bce9ff',
      },
    ])
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <h1>DewDrops</h1>
          <p>Your World: liquid planetoid workspace for agentic engineering</p>
        </div>
        <div className="stats">
          <span>{droplets.length} droplets</span>
          <span>{totalMass} total mass</span>
          <span>{lights.length} lights</span>
          <button className="ghost-btn" onClick={() => setCoreView((v) => !v)}>
            {coreView ? 'Surface View' : 'Core View'}
          </button>
          <button
            className="ghost-btn"
            onClick={() => {
              setCamera((c) => ({ ...c, x: 0, y: 0, zoom: 1 }))
              setGlobeRotation(0)
            }}
          >
            Recenter
          </button>
        </div>
      </header>

      <section
        className="world"
        ref={worldRef}
        onWheel={(event) => {
          event.preventDefault()
          const delta = event.deltaY < 0 ? 1.1 : 0.9
          const nextZoom = Math.max(0.25, Math.min(8, camera.zoom * delta))
          setCamera((current) => ({ ...current, zoom: nextZoom }))
        }}
        onPointerDown={(event) => {
          if (event.button === 0 && event.altKey) {
            event.preventDefault()
            const rect = event.currentTarget.getBoundingClientRect()
            const sx = event.clientX - rect.left
            const sy = event.clientY - rect.top
            globeSpinRef.current = {
              pointerId: event.pointerId,
              lastAngle: Math.atan2(sy - center.y, sx - center.x),
            }
            event.currentTarget.setPointerCapture(event.pointerId)
            return
          }
          if (event.button !== 1) return
          panPointer.current = event.pointerId
          lastPanPoint.current = { x: event.clientX, y: event.clientY }
          event.currentTarget.setPointerCapture(event.pointerId)
        }}
        onPointerMove={(event) => {
          if (globeSpinRef.current && globeSpinRef.current.pointerId === event.pointerId) {
            const rect = event.currentTarget.getBoundingClientRect()
            const sx = event.clientX - rect.left
            const sy = event.clientY - rect.top
            const ang = Math.atan2(sy - center.y, sx - center.x)
            let d = ang - globeSpinRef.current.lastAngle
            if (d > Math.PI) d -= 2 * Math.PI
            if (d < -Math.PI) d += 2 * Math.PI
            globeSpinRef.current.lastAngle = ang
            setGlobeRotation((r) => r + d)
            return
          }
          if (panPointer.current !== event.pointerId || !lastPanPoint.current) return
          const dx = event.clientX - lastPanPoint.current.x
          const dy = event.clientY - lastPanPoint.current.y
          lastPanPoint.current = { x: event.clientX, y: event.clientY }
          setCamera((current) => ({
            ...current,
            x: current.x - dx / current.zoom,
            y: current.y - dy / current.zoom,
          }))
        }}
        onPointerUp={(event) => {
          if (globeSpinRef.current?.pointerId === event.pointerId) {
            globeSpinRef.current = null
            return
          }
          if (panPointer.current !== event.pointerId) return
          panPointer.current = null
          lastPanPoint.current = null
        }}
        onDoubleClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect()
          const worldPos = screenToWorld(event.clientX - rect.left, event.clientY - rect.top)
          if (event.shiftKey) {
            addLight(worldPos.x, worldPos.y)
          } else {
            addDroplet(worldPos.x, worldPos.y)
          }
        }}
      >
        <svg width={size.width} height={size.height} role="img" aria-label="DewDrops simulation surface">
          <defs>
            <radialGradient id="liquidBody" cx="34%" cy="30%" r="72%" gradientUnits="objectBoundingBox">
              <stop offset="0%" stopColor="rgba(230, 252, 255, 0.42)" />
              <stop offset="28%" stopColor="rgba(140, 220, 255, 0.38)" />
              <stop offset="55%" stopColor="rgba(60, 160, 220, 0.45)" />
              <stop offset="82%" stopColor="rgba(25, 95, 165, 0.52)" />
              <stop offset="100%" stopColor="rgba(12, 55, 110, 0.58)" />
            </radialGradient>
            <radialGradient id="liquidDepth" cx="58%" cy="62%" r="48%" gradientUnits="objectBoundingBox">
              <stop offset="0%" stopColor="rgba(10, 40, 90, 0)" />
              <stop offset="70%" stopColor="rgba(8, 35, 75, 0.35)" />
              <stop offset="100%" stopColor="rgba(4, 20, 50, 0.55)" />
            </radialGradient>
            <radialGradient id="liquidMeniscus" cx="28%" cy="22%" r="35%" gradientUnits="objectBoundingBox">
              <stop offset="0%" stopColor="rgba(255, 255, 255, 0.55)" />
              <stop offset="45%" stopColor="rgba(200, 240, 255, 0.2)" />
              <stop offset="100%" stopColor="rgba(255, 255, 255, 0)" />
            </radialGradient>
            <filter id="dropletGlow" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="1.8" result="blur" />
              <feColorMatrix
                in="blur"
                type="matrix"
                values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.55 0"
                result="soft"
              />
              <feMerge>
                <feMergeNode in="soft" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <radialGradient id="planetGradient" cx="50%" cy="36%">
              <stop offset="0%" stopColor="rgba(34, 97, 164, 0.95)" />
              <stop offset="65%" stopColor="rgba(9, 33, 66, 0.92)" />
              <stop offset="100%" stopColor="rgba(5, 18, 35, 0.98)" />
            </radialGradient>
            <clipPath id="worldClip">
              <circle cx={center.x} cy={center.y} r={worldRadius} />
            </clipPath>
            {droplets.map((d) => {
              // Wall-clock phase for gradient drift (visual only; not pure render).
              // eslint-disable-next-line react-hooks/purity -- time-based SVG gradient
              const drift = (d.id * 37 + performance.now() * 0.018) % 360
              return (
                <linearGradient
                  key={`iris-${d.id}`}
                  id={`iris-${d.id}`}
                  x1="0%"
                  y1="0%"
                  x2="100%"
                  y2="100%"
                  gradientTransform={`rotate(${drift} 0.5 0.5)`}
                >
                  <stop offset="0%" stopColor="#7dd3fc" stopOpacity={0.92} />
                  <stop offset="22%" stopColor="#c4b5fd" stopOpacity={0.88} />
                  <stop offset="45%" stopColor="#fbcfe8" stopOpacity={0.85} />
                  <stop offset="68%" stopColor="#5eead4" stopOpacity={0.88} />
                  <stop offset="100%" stopColor="#93c5fd" stopOpacity={0.92} />
                </linearGradient>
              )
            })}
          </defs>
          <circle cx={center.x} cy={center.y} r={worldRadius} className="planetoid-shell" fill="url(#planetGradient)" />
          <g clipPath="url(#worldClip)">
            <rect x={0} y={0} width={size.width} height={size.height} className={coreView ? 'core-bg' : 'surface-bg'} />
            {lights.map((light) => {
              const p = worldToScreen(light.x, light.y)
              return (
                <circle
                  key={light.id}
                  cx={p.x}
                  cy={p.y}
                  r={90 * light.intensity * camera.zoom}
                  style={{ fill: light.color }}
                  className="light-source"
                />
              )
            })}
            {mosaicFilms.map((link) => {
              const da = droplets.find((x) => x.id === link.aId)
              const db = droplets.find((x) => x.id === link.bId)
              if (!da || !db) return null
              const wdA = Math.sqrt(da.x * da.x + da.y * da.y) / (WORLD_SIZE / 2)
              const wdB = Math.sqrt(db.x * db.x + db.y * db.y) / (WORLD_SIZE / 2)
              const dfA = coreView ? 0.8 + wdA * 0.35 : 1.28 - wdA * 0.35
              const dfB = coreView ? 0.8 + wdB * 0.35 : 1.28 - wdB * 0.35
              const ra = radiusFromMass(da.mass) * dfA * camera.zoom
              const rb = radiusFromMass(db.mass) * dfB * camera.zoom
              const pa = worldToScreen(da.x, da.y)
              const pb = worldToScreen(db.x, db.y)
              const dPath = soapFilmPathScreen(pa.x, pa.y, ra, pb.x, pb.y, rb)
              if (!dPath) return null
              return (
                <path
                  key={`${link.aId}-${link.bId}`}
                  d={dPath}
                  className="soap-film"
                  fill="none"
                  strokeOpacity={0.12 + link.strength * 0.55}
                />
              )
            })}
            {droplets.map((d) => {
              const worldDepth = Math.sqrt(d.x * d.x + d.y * d.y) / (WORLD_SIZE / 2)
              const depthFactor = coreView ? 0.8 + worldDepth * 0.35 : 1.28 - worldDepth * 0.35
              const p = worldToScreen(d.x, d.y)
              const speed = Math.hypot(d.vx, d.vy)
              const jig = Math.min(1.2, d.jiggle)
              // eslint-disable-next-line react-hooks/purity -- time-based wobble
              const t = performance.now() * 0.0035 + d.id * 0.71
              const wobblePhase =
                Math.sin(t) * (0.018 + jig * 0.065 + speed * 0.014) +
                Math.sin(t * 2.1 + d.mass * 0.02) * (jig * 0.022)
              const sx = 1 + wobblePhase
              const sy = 1 - wobblePhase * 0.88
              const rotDeg = Math.sin(t * 1.63 + d.mass * 0.04) * (1.2 + jig * 4.2 + speed * 1.8)
              const radius = radiusFromMass(d.mass) * depthFactor * camera.zoom
              const shimmerR = radius * (1 + Math.sin((d.x + d.y + d.mass) * 0.028) * tuning.wobble * 0.06)
              const visible = Math.sqrt((p.x - center.x) ** 2 + (p.y - center.y) ** 2) < worldRadius + shimmerR * 1.15
              if (!visible) return null
              const meniscusOpacity = Math.max(0.35, 0.92 - worldDepth * 0.35)
              const transform = `translate(${p.x.toFixed(2)},${p.y.toFixed(2)}) rotate(${rotDeg.toFixed(3)}) scale(${sx.toFixed(4)},${sy.toFixed(4)})`
              const irisStroke = Math.max(1.2, shimmerR * 0.055)
              const pointerHandlers = {
                onPointerDown: (event: PointerEvent<SVGCircleElement>) => {
                  dragId.current = d.id
                  dragClusterTornRef.current = false
                  dragActiveClusterRef.current = buildClusterLinkSet(
                    dropletsRef.current,
                    d.id,
                    tuning.clusterLinkPadding,
                  )
                  dragPrevWorldRef.current = { x: d.x, y: d.y }
                  if (!worldRef.current) return
                  const rect = worldRef.current.getBoundingClientRect()
                  dragMotion.current = {
                    id: d.id,
                    x: event.clientX - rect.left,
                    y: event.clientY - rect.top,
                    ts: performance.now(),
                    vx: 0,
                    vy: 0,
                  }
                  event.currentTarget.setPointerCapture(event.pointerId)
                },
                onPointerMove: (event: PointerEvent<SVGCircleElement>) => {
                  if (dragId.current !== d.id || !worldRef.current) return
                  const rect = worldRef.current.getBoundingClientRect()
                  const screenX = event.clientX - rect.left
                  const screenY = event.clientY - rect.top
                  const worldPos = screenToWorld(screenX, screenY)
                  const now = performance.now()
                  const last = dragMotion.current
                  if (last && last.id === d.id) {
                    const dt = Math.max(8, now - last.ts)
                    const screenSpd = Math.hypot(screenX - last.x, screenY - last.y) / dt
                    if (screenSpd > tuning.ripScreenSpeed) {
                      dragClusterTornRef.current = true
                      dragActiveClusterRef.current = new Set([d.id])
                    }
                  }
                  const cluster = dragActiveClusterRef.current
                  const prevW = dragPrevWorldRef.current
                  let newVx = 0
                  let newVy = 0
                  if (last && last.id === d.id) {
                    const dt = Math.max(8, now - last.ts)
                    const instantVx = ((screenX - last.x) / dt) * 4.8 * tuning.throwBoost
                    const instantVy = ((screenY - last.y) / dt) * 4.8 * tuning.throwBoost
                    const smooth = tuning.velocitySmoothing
                    const rawVx = last.vx * smooth + instantVx * (1 - smooth)
                    const rawVy = last.vy * smooth + instantVy * (1 - smooth)
                    const maxRelease = 1.8
                    const sp = Math.hypot(rawVx, rawVy)
                    const cap = sp > maxRelease ? maxRelease / sp : 1
                    newVx = rawVx * cap
                    newVy = rawVy * cap
                  }
                  if (prevW) {
                    const dwx = worldPos.x - prevW.x
                    const dwy = worldPos.y - prevW.y
                    setDroplets((current) =>
                      current.map((item) => {
                        if (!cluster.has(item.id)) return item
                        if (item.id === d.id) {
                          return { ...item, x: worldPos.x, y: worldPos.y, vx: newVx, vy: newVy }
                        }
                        return { ...item, x: item.x + dwx, y: item.y + dwy, vx: 0, vy: 0 }
                      }),
                    )
                  }
                  dragPrevWorldRef.current = { x: worldPos.x, y: worldPos.y }
                  dragMotion.current = { id: d.id, x: screenX, y: screenY, ts: now, vx: 0, vy: 0 }
                  if (last && last.id === d.id) {
                    dragMotion.current = {
                      id: d.id,
                      x: screenX,
                      y: screenY,
                      ts: now,
                      vx:
                        last.vx * tuning.velocitySmoothing +
                        ((screenX - last.x) / Math.max(8, now - last.ts)) *
                          4.8 *
                          tuning.throwBoost *
                          (1 - tuning.velocitySmoothing),
                      vy:
                        last.vy * tuning.velocitySmoothing +
                        ((screenY - last.y) / Math.max(8, now - last.ts)) *
                          4.8 *
                          tuning.throwBoost *
                          (1 - tuning.velocitySmoothing),
                    }
                  }
                },
                onPointerUp: () => {
                  const last = dragMotion.current
                  if (last && last.id === d.id) {
                    const maxRelease = 1.8
                    const sp = Math.hypot(last.vx, last.vy)
                    const cap = sp > maxRelease ? maxRelease / sp : 1
                    setDroplets((current) =>
                      current.map((item) =>
                        item.id === d.id ? { ...item, vx: last.vx * cap, vy: last.vy * cap } : item,
                      ),
                    )
                  }
                  dragId.current = null
                  dragMotion.current = null
                  dragActiveClusterRef.current = new Set()
                  dragClusterTornRef.current = false
                  dragPrevWorldRef.current = null
                },
                onDoubleClick: (event: MouseEvent<SVGCircleElement>) => {
                  event.stopPropagation()
                  splitDroplet(d.id)
                },
                onContextMenu: (event: MouseEvent<SVGCircleElement>) => {
                  event.preventDefault()
                  toggleIsolation(d.id)
                },
              }
              return (
                <g key={d.id} transform={transform} className="droplet-group">
                  <circle
                    cx={0}
                    cy={0}
                    r={shimmerR * 1.12}
                    className="droplet-aura"
                    pointerEvents="none"
                  />
                  <circle
                    cx={0}
                    cy={0}
                    r={shimmerR}
                    fill="url(#liquidBody)"
                    opacity={0.88}
                    filter="url(#dropletGlow)"
                    className="droplet-liquid"
                    pointerEvents="none"
                  />
                  <circle cx={0} cy={0} r={shimmerR * 0.94} fill="url(#liquidDepth)" pointerEvents="none" />
                  <circle
                    cx={0}
                    cy={0}
                    r={shimmerR}
                    fill="url(#liquidMeniscus)"
                    opacity={meniscusOpacity}
                    style={{ mixBlendMode: 'screen' }}
                    pointerEvents="none"
                  />
                  <circle
                    cx={0}
                    cy={0}
                    r={shimmerR}
                    fill="none"
                    stroke={`url(#iris-${d.id})`}
                    strokeWidth={irisStroke}
                    opacity={0.78}
                    className="droplet-iris"
                    pointerEvents="none"
                  />
                  <circle
                    cx={0}
                    cy={0}
                    r={shimmerR * 1.08}
                    fill="rgba(255, 255, 255, 0.035)"
                    stroke={`url(#iris-${d.id})`}
                    strokeWidth={Math.max(0.5, irisStroke * 0.3)}
                    opacity={0.62}
                    className="soap-shell"
                    pointerEvents="none"
                  />
                  <ellipse
                    cx={-shimmerR * 0.26}
                    cy={-shimmerR * 0.3}
                    rx={shimmerR * 0.38}
                    ry={shimmerR * 0.2}
                    fill="rgba(255,255,255,0.38)"
                    style={{ mixBlendMode: 'screen' }}
                    pointerEvents="none"
                    className="droplet-caustic"
                  />
                  <circle
                    cx={-shimmerR * 0.15}
                    cy={-shimmerR * 0.18}
                    r={shimmerR * 0.12}
                    fill="rgba(255,255,255,0.5)"
                    style={{ mixBlendMode: 'overlay' }}
                    pointerEvents="none"
                  />
                  {d.isolated ? (
                    <circle
                      cx={0}
                      cy={0}
                      r={shimmerR + irisStroke * 0.6}
                      fill="none"
                      stroke="rgba(255,255,255,0.55)"
                      strokeWidth={2}
                      strokeDasharray="5 7"
                      pointerEvents="none"
                      className="droplet-soap-ring"
                    />
                  ) : null}
                  <circle
                    cx={0}
                    cy={0}
                    r={shimmerR}
                    fill="rgba(0,30,60,0.01)"
                    stroke="rgba(200, 235, 255, 0.35)"
                    strokeWidth={0.9}
                    className="droplet"
                    data-isolated={d.isolated ? 'true' : 'false'}
                    style={{ cursor: 'grab' }}
                    {...pointerHandlers}
                  />
                </g>
              )
            })}
          </g>
          <circle cx={center.x} cy={center.y} r={worldRadius} className="planetoid-rim" />
        </svg>
      </section>

      <footer className="hints">
        <span>Double-click empty space to create a droplet.</span>
        <span>Shift + double-click to place a new light source.</span>
        <span>Scroll to zoom through many focus levels.</span>
        <span>Alt (⌥) + drag on the globe to spin it.</span>
        <span>Middle-click and drag to pan Your World.</span>
        <span>Toggle Core View to look outward from within.</span>
        <span>Double-click a droplet to split it.</span>
        <span>Right-click a droplet to toggle soap ring isolation.</span>
        <span>Soap films connect neighbors into a mosaic; only a hard slam blends two bubbles.</span>
        <span>Drag slowly to move a cluster; flick fast to tear one bubble free.</span>
      </footer>
      <aside className="feel-lab">
        <h2>Feel Lab</h2>
        <label>
          Viscosity
          <input
            type="range"
            min={0.9}
            max={0.99}
            step={0.001}
            value={tuning.viscosity}
            onChange={(event) =>
              setTuning((prev) => ({ ...prev, viscosity: Number(event.target.value) }))
            }
          />
        </label>
        <label>
          Cohesion
          <input
            type="range"
            min={0.001}
            max={0.008}
            step={0.0001}
            value={tuning.cohesion}
            onChange={(event) =>
              setTuning((prev) => ({ ...prev, cohesion: Number(event.target.value) }))
            }
          />
        </label>
        <label>
          Repulsion
          <input
            type="range"
            min={0.005}
            max={0.05}
            step={0.001}
            value={tuning.repulsion}
            onChange={(event) =>
              setTuning((prev) => ({ ...prev, repulsion: Number(event.target.value) }))
            }
          />
        </label>
        <label>
          Repulsion Radius
          <input
            type="range"
            min={80}
            max={280}
            step={2}
            value={tuning.repulsionRadius}
            onChange={(event) =>
              setTuning((prev) => ({ ...prev, repulsionRadius: Number(event.target.value) }))
            }
          />
        </label>
        <label>
          Blend overlap (forced only)
          <input
            type="range"
            min={6}
            max={28}
            step={1}
            value={tuning.blendOverlapMin}
            onChange={(event) =>
              setTuning((prev) => ({ ...prev, blendOverlapMin: Number(event.target.value) }))
            }
          />
        </label>
        <label>
          Wobble
          <input
            type="range"
            min={0}
            max={0.22}
            step={0.01}
            value={tuning.wobble}
            onChange={(event) =>
              setTuning((prev) => ({ ...prev, wobble: Number(event.target.value) }))
            }
          />
        </label>
        <label>
          Isolation Field
          <input
            type="range"
            min={1}
            max={4}
            step={0.1}
            value={tuning.isolationField}
            onChange={(event) =>
              setTuning((prev) => ({ ...prev, isolationField: Number(event.target.value) }))
            }
          />
        </label>
        <label>
          Throw Boost
          <input
            type="range"
            min={0.2}
            max={1.6}
            step={0.05}
            value={tuning.throwBoost}
            onChange={(event) =>
              setTuning((prev) => ({ ...prev, throwBoost: Number(event.target.value) }))
            }
          />
        </label>
        <label>
          Inertial Friction
          <input
            type="range"
            min={0.95}
            max={0.995}
            step={0.001}
            value={tuning.inertialFriction}
            onChange={(event) =>
              setTuning((prev) => ({ ...prev, inertialFriction: Number(event.target.value) }))
            }
          />
        </label>
        <label>
          Velocity Smoothing
          <input
            type="range"
            min={0.45}
            max={0.92}
            step={0.01}
            value={tuning.velocitySmoothing}
            onChange={(event) =>
              setTuning((prev) => ({ ...prev, velocitySmoothing: Number(event.target.value) }))
            }
          />
        </label>
        <label>
          Force blend speed
          <input
            type="range"
            min={0.4}
            max={3.5}
            step={0.05}
            value={tuning.forceMergeSpeed}
            onChange={(event) =>
              setTuning((prev) => ({ ...prev, forceMergeSpeed: Number(event.target.value) }))
            }
          />
        </label>
        <label>
          Magnetic Spring
          <input
            type="range"
            min={0.004}
            max={0.035}
            step={0.001}
            value={tuning.magneticSpring}
            onChange={(event) =>
              setTuning((prev) => ({ ...prev, magneticSpring: Number(event.target.value) }))
            }
          />
        </label>
        <label>
          Magnetic reach (invisible pull)
          <input
            type="range"
            min={180}
            max={520}
            step={10}
            value={tuning.magneticReach}
            onChange={(event) =>
              setTuning((prev) => ({ ...prev, magneticReach: Number(event.target.value) }))
            }
          />
        </label>
        <label>
          Soap film reach
          <input
            type="range"
            min={12}
            max={80}
            step={2}
            value={tuning.soapFilmMaxGap}
            onChange={(event) =>
              setTuning((prev) => ({ ...prev, soapFilmMaxGap: Number(event.target.value) }))
            }
          />
        </label>
        <label>
          Foam separation
          <input
            type="range"
            min={0.008}
            max={0.055}
            step={0.002}
            value={tuning.foamSeparation}
            onChange={(event) =>
              setTuning((prev) => ({ ...prev, foamSeparation: Number(event.target.value) }))
            }
          />
        </label>
        <label>
          Cluster Link Padding
          <input
            type="range"
            min={20}
            max={200}
            step={4}
            value={tuning.clusterLinkPadding}
            onChange={(event) =>
              setTuning((prev) => ({ ...prev, clusterLinkPadding: Number(event.target.value) }))
            }
          />
        </label>
        <label>
          Rip Screen Speed
          <input
            type="range"
            min={0.5}
            max={4}
            step={0.05}
            value={tuning.ripScreenSpeed}
            onChange={(event) =>
              setTuning((prev) => ({ ...prev, ripScreenSpeed: Number(event.target.value) }))
            }
          />
        </label>
      </aside>
    </main>
  )
}

export default LiquidGlobeView
