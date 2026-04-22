import { describe, expect, it } from 'vitest'
import type { BoardCamera, WorkflowCard } from './types'
import {
  cardWorldBounds,
  fitCameraToCards,
  marqueeViewportToWorldAabb,
  screenToWorldFlat,
  worldRectsIntersect,
  zoomAtPoint,
} from './viewportGeometry'

function cam(overrides: Partial<BoardCamera> = {}): BoardCamera {
  return { zoom: 1, x: 0, y: 0, ...overrides }
}

describe('screenToWorldFlat', () => {
  it('maps viewport center to camera origin at zoom 1', () => {
    const c = cam()
    const p = screenToWorldFlat(400, 300, 800, 600, c)
    expect(p.x).toBeCloseTo(0)
    expect(p.y).toBeCloseTo(0)
  })

  it('scales by zoom', () => {
    const c = cam({ zoom: 2 })
    const p = screenToWorldFlat(400, 300, 800, 600, c)
    expect(p.x).toBeCloseTo(0)
    const q = screenToWorldFlat(500, 300, 800, 600, c)
    expect(q.x - p.x).toBeCloseTo(50)
  })
})

describe('zoomAtPoint', () => {
  it('keeps the world point under the screen pixel when zooming', () => {
    const vw = 800
    const vh = 600
    const sx = 500
    const sy = 200
    const before = cam({ zoom: 1, x: 10, y: -20 })
    const wx = (sx - vw / 2) / before.zoom + before.x
    const wy = (sy - vh / 2) / before.zoom + before.y
    const after = zoomAtPoint(before, vw, vh, sx, sy, 1.5)
    const wx2 = (sx - vw / 2) / after.zoom + after.x
    const wy2 = (sy - vh / 2) / after.zoom + after.y
    expect(wx2).toBeCloseTo(wx)
    expect(wy2).toBeCloseTo(wy)
  })

  it('clamps zoom factor into range', () => {
    const vw = 800
    const vh = 600
    const hi = zoomAtPoint(cam({ zoom: 2 }), vw, vh, 400, 300, 10)
    expect(hi.zoom).toBeLessThanOrEqual(2.8)
    const lo = zoomAtPoint(cam({ zoom: 0.2 }), vw, vh, 400, 300, 0.01)
    expect(lo.zoom).toBeGreaterThanOrEqual(0.12)
  })
})

describe('marqueeViewportToWorldAabb', () => {
  it('returns axis-aligned bounds for a viewport rect at zoom 1 origin', () => {
    const r = marqueeViewportToWorldAabb(0, 0, 100, 50, 800, 600, cam())
    expect(r.l).toBeCloseTo(-400)
    expect(r.t).toBeCloseTo(-300)
    expect(r.r).toBeCloseTo(-300)
    expect(r.b).toBeCloseTo(-250)
  })
})

describe('worldRectsIntersect', () => {
  it('returns false when separated', () => {
    expect(
      worldRectsIntersect({ l: 0, t: 0, r: 1, b: 1 }, { l: 2, t: 0, r: 3, b: 1 }),
    ).toBe(false)
  })

  it('returns true when overlapping', () => {
    expect(
      worldRectsIntersect({ l: 0, t: 0, r: 10, b: 10 }, { l: 5, t: 5, r: 15, b: 15 }),
    ).toBe(true)
  })
})

describe('cardWorldBounds', () => {
  it('uses collapsed height when not expanded', () => {
    const c: WorkflowCard = {
      id: 'a',
      title: 'a',
      expanded: false,
      color: '#fff',
      kind: 'agent',
      x: 10,
      y: 20,
      width: 100,
      height: 200,
    }
    const b = cardWorldBounds(c)
    expect(b).toEqual({ l: 10, t: 20, r: 110, b: 64 })
  })
})

describe('fitCameraToCards', () => {
  it('centers the camera on the card union and chooses a visible zoom', () => {
    const cards: WorkflowCard[] = [
      {
        id: 'p1',
        title: 'Problem',
        expanded: true,
        color: '#fff',
        kind: 'problem',
        x: 100,
        y: 80,
        width: 220,
        height: 160,
      },
      {
        id: 'a1',
        title: 'Agent',
        expanded: false,
        color: '#0af',
        kind: 'agent',
        x: 460,
        y: 260,
        width: 140,
        height: 44,
        assignedToProblemId: null,
      },
    ]

    const camera = fitCameraToCards(cards, 1200, 800)
    expect(camera.x).toBe(350)
    expect(camera.y).toBe(192)
    expect(camera.zoom).toBeGreaterThan(1)
  })

  it('returns a neutral camera when there are no cards', () => {
    expect(fitCameraToCards([], 1200, 800)).toEqual({ x: 0, y: 0, zoom: 1 })
  })
})
