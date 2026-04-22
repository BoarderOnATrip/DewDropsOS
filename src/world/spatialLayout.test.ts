import { describe, expect, it } from 'vitest'

import {
  layoutOrbitNodes,
  layoutRingNodes,
  layoutRoomInteriorNodes,
  polarPoint,
  spatialHashToUnit,
  stableSpatialHash,
} from './spatialLayout'

const pointKey = (x: number, y: number) => `${x.toFixed(6)}:${y.toFixed(6)}`

describe('spatial layout helpers', () => {
  it('produces stable orbit positions for the same ids regardless of input order', () => {
    const ids = ['alpha', 'bravo', 'charlie', 'delta']
    const reordered = ['delta', 'alpha', 'charlie', 'bravo']

    const first = layoutOrbitNodes(ids, {
      center: { x: 10, y: -5 },
      radius: 100,
      startAngle: 0,
      seed: 'hero-vectors',
    })
    const second = layoutOrbitNodes(reordered, {
      center: { x: 10, y: -5 },
      radius: 100,
      startAngle: 0,
      seed: 'hero-vectors',
    })

    const firstById = new Map(first.map((node) => [node.id, node]))
    const secondById = new Map(second.map((node) => [node.id, node]))

    for (const id of ids) {
      const a = firstById.get(id)
      const b = secondById.get(id)

      expect(a).toBeDefined()
      expect(b).toBeDefined()
      expect(a?.x).toBeCloseTo(b?.x ?? 0, 8)
      expect(a?.y).toBeCloseTo(b?.y ?? 0, 8)
      expect(a?.angle).toBeCloseTo(b?.angle ?? 0, 8)
      expect(a?.radius).toBeCloseTo(b?.radius ?? 0, 8)
    }

    for (const node of first) {
      const distance = Math.hypot(node.x - 10, node.y + 5)
      expect(distance).toBeCloseTo(node.radius, 8)
    }
  })

  it('spreads ring nodes across concentric rings and keeps them deterministic', () => {
    const ids = Array.from({ length: 9 }, (_, index) => `node-${index + 1}`)

    const first = layoutRingNodes(ids, {
      center: { x: 0, y: 0 },
      innerRadius: 40,
      outerRadius: 160,
      maxPerRing: 4,
      startAngle: Math.PI / 3,
      seed: 'return-field',
    })
    const second = layoutRingNodes(ids, {
      center: { x: 0, y: 0 },
      innerRadius: 40,
      outerRadius: 160,
      maxPerRing: 4,
      startAngle: Math.PI / 3,
      seed: 'return-field',
    })

    expect(new Set(first.map((node) => node.ring)).size).toBeGreaterThan(1)
    expect(first.map((node) => node.id)).toEqual(ids)

    first.forEach((node) => {
      expect(Math.hypot(node.x, node.y)).toBeCloseTo(node.radius, 8)
    })

    const firstKeys = first.map((node) => pointKey(node.x, node.y))
    const secondKeys = second.map((node) => pointKey(node.x, node.y))
    expect(firstKeys).toEqual(secondKeys)
  })

  it('keeps room interior nodes inside the requested bounds and stable across calls', () => {
    const ids = ['person', 'agent', 'artifact', 'locus', 'note', 'tunnel']

    const first = layoutRoomInteriorNodes(ids, {
      center: { x: 25, y: -30 },
      width: 280,
      height: 180,
      padding: 18,
      startAngle: -Math.PI / 6,
      seed: 'retention-room',
    })
    const second = layoutRoomInteriorNodes(ids, {
      center: { x: 25, y: -30 },
      width: 280,
      height: 180,
      padding: 18,
      startAngle: -Math.PI / 6,
      seed: 'retention-room',
    })

    const halfWidth = 280 / 2 - 18
    const halfHeight = 180 / 2 - 18

    first.forEach((node) => {
      expect(node.x).toBeGreaterThanOrEqual(25 - halfWidth)
      expect(node.x).toBeLessThanOrEqual(25 + halfWidth)
      expect(node.y).toBeGreaterThanOrEqual(-30 - halfHeight)
      expect(node.y).toBeLessThanOrEqual(-30 + halfHeight)
    })

    expect(second.map((node) => pointKey(node.x, node.y))).toEqual(first.map((node) => pointKey(node.x, node.y)))
    expect(new Set(first.map((node) => node.slot)).size).toBe(ids.length)
  })

  it('exposes deterministic hash helpers and polar conversion', () => {
    expect(stableSpatialHash('alpha')).toBe(stableSpatialHash('alpha'))
    expect(stableSpatialHash('alpha')).not.toBe(stableSpatialHash('beta'))

    const unit = spatialHashToUnit('alpha')
    expect(unit).toBeGreaterThanOrEqual(0)
    expect(unit).toBeLessThan(1)

    expect(polarPoint({ x: 10, y: 20 }, 5, Math.PI / 2)).toEqual({
      x: 10,
      y: 25,
    })
  })
})
