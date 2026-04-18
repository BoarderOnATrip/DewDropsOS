import type { SpatialPoint } from './model'

export type SpatialLayoutNode = SpatialPoint & {
  id: string
  index: number
  slot: number
  angle: number
  radius: number
  ring: number
}

export type SpatialOrbitLayoutOptions = {
  center?: SpatialPoint
  radius?: number
  startAngle?: number
  seed?: string
}

export type SpatialRingLayoutOptions = {
  center?: SpatialPoint
  innerRadius?: number
  outerRadius?: number
  maxPerRing?: number
  startAngle?: number
  seed?: string
}

export type SpatialRoomInteriorLayoutOptions = {
  center?: SpatialPoint
  width?: number
  height?: number
  padding?: number
  startAngle?: number
  seed?: string
}

const TAU = Math.PI * 2
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))

const defaultCenter = (): SpatialPoint => ({ x: 0, y: 0 })

const hash32 = (value: string): number => {
  let hash = 0x811c9dc5

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }

  return hash >>> 0
}

const unitFromHash = (value: string): number => hash32(value) / 0xffffffff

const signedFromHash = (value: string): number => unitFromHash(value) * 2 - 1

const polarToPoint = (center: SpatialPoint, radius: number, angle: number): SpatialPoint => ({
  x: center.x + Math.cos(angle) * radius,
  y: center.y + Math.sin(angle) * radius,
  ...(center.z === undefined ? {} : { z: center.z }),
})

const rankIds = (ids: readonly string[], seed: string): Array<{ id: string; index: number; rank: number }> =>
  ids
    .map((id, index) => ({
      id,
      index,
      rank: hash32(`${seed}|${id}`),
    }))
    .sort((left, right) => left.rank - right.rank || left.id.localeCompare(right.id) || left.index - right.index)

const buildLayoutIndex = (ids: readonly string[], seed: string): Map<string, { slot: number; rank: number }> => {
  const ranked = rankIds(ids, seed)
  return new Map(ranked.map((entry, slot) => [entry.id, { slot, rank: entry.rank }]))
}

const pointForOrbitSlot = (
  center: SpatialPoint,
  radius: number,
  startAngle: number,
  slot: number,
  total: number,
  seed: string,
  id: string,
): SpatialLayoutNode => {
  const angleStep = TAU / total
  const angle = startAngle + slot * angleStep + signedFromHash(`${seed}|${id}|orbit-angle`) * angleStep * 0.14
  const radial = radius * (1 + signedFromHash(`${seed}|${id}|orbit-radius`) * 0.04)
  const point = polarToPoint(center, radial, angle)

  return {
    id,
    index: slot,
    slot,
    ring: 0,
    angle,
    radius: radial,
    ...point,
  }
}

export const stableSpatialHash = (value: string): number => hash32(value)

export const spatialHashToUnit = (value: string): number => unitFromHash(value)

export const polarPoint = (center: SpatialPoint, radius: number, angle: number): SpatialPoint =>
  polarToPoint(center, radius, angle)

export const layoutOrbitNodes = (
  ids: readonly string[],
  options: SpatialOrbitLayoutOptions = {},
): SpatialLayoutNode[] => {
  if (ids.length === 0) return []

  const center = options.center ?? defaultCenter()
  const radius = options.radius ?? 120
  const startAngle = options.startAngle ?? -Math.PI / 2
  const seed = options.seed ?? 'orbit'
  const layoutIndex = buildLayoutIndex(ids, seed)

  return ids.map((id) => {
    const entry = layoutIndex.get(id)
    const slot = entry?.slot ?? 0
    return pointForOrbitSlot(center, radius, startAngle, slot, ids.length, seed, id)
  })
}

export const layoutRingNodes = (
  ids: readonly string[],
  options: SpatialRingLayoutOptions = {},
): SpatialLayoutNode[] => {
  if (ids.length === 0) return []

  const center = options.center ?? defaultCenter()
  const innerRadius = options.innerRadius ?? 72
  const outerRadius = options.outerRadius ?? 168
  const maxPerRing = Math.max(1, Math.floor(options.maxPerRing ?? 6))
  const startAngle = options.startAngle ?? -Math.PI / 2
  const seed = options.seed ?? 'ring'
  const layoutIndex = buildLayoutIndex(ids, seed)
  const total = ids.length
  const ringCount = Math.max(1, Math.ceil(total / maxPerRing))
  const ringStep = ringCount > 1 ? (outerRadius - innerRadius) / (ringCount - 1) : 0
  const perRing = Math.ceil(total / ringCount)

  return ids.map((id) => {
    const entry = layoutIndex.get(id)
    const slot = entry?.slot ?? 0
    const ring = Math.min(ringCount - 1, Math.floor(slot / perRing))
    const ringStart = ring * perRing
    const ringTotal = Math.max(1, Math.min(perRing, total - ringStart))
    const localIndex = slot - ringStart
    const ringRadius = ringCount === 1 ? (innerRadius + outerRadius) / 2 : innerRadius + ring * ringStep
    const angleStep = TAU / ringTotal
    const angle =
      startAngle +
      localIndex * angleStep +
      signedFromHash(`${seed}|${id}|ring-angle-${ring}`) * angleStep * 0.12
    const point = polarToPoint(center, ringRadius, angle)

    return {
      id,
      index: slot,
      slot,
      ring,
      angle,
      radius: ringRadius,
      ...point,
    }
  })
}

export const layoutRoomInteriorNodes = (
  ids: readonly string[],
  options: SpatialRoomInteriorLayoutOptions = {},
): SpatialLayoutNode[] => {
  if (ids.length === 0) return []

  const center = options.center ?? defaultCenter()
  const width = options.width ?? 320
  const height = options.height ?? 220
  const padding = options.padding ?? 20
  const startAngle = options.startAngle ?? -Math.PI / 4
  const seed = options.seed ?? 'room'
  const layoutIndex = buildLayoutIndex(ids, seed)
  const rx = Math.max(0, width / 2 - padding)
  const ry = Math.max(0, height / 2 - padding)

  return ids.map((id) => {
    const entry = layoutIndex.get(id)
    const slot = entry?.slot ?? 0
    const total = ids.length
    const progress = Math.sqrt((slot + 1) / (total + 1))
    const angle = startAngle + slot * GOLDEN_ANGLE + signedFromHash(`${seed}|${id}|room-angle`) * 0.18
    const x = center.x + Math.cos(angle) * rx * progress
    const y = center.y + Math.sin(angle) * ry * progress

    return {
      id,
      index: slot,
      slot,
      ring: Math.min(3, Math.floor(progress * 4)),
      angle,
      radius: Math.hypot(x - center.x, y - center.y),
      x,
      y,
      ...(center.z === undefined ? {} : { z: center.z }),
    }
  })
}
