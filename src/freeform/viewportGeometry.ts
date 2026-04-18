import type { BoardCamera, WorkflowCard } from './types'
import { cardDisplayHeight } from './kanbanGeometry'

export type WorldRect = { l: number; t: number; r: number; b: number }

export function zoomAtPoint(
  cam: BoardCamera,
  vw: number,
  vh: number,
  sx: number,
  sy: number,
  factor: number,
): BoardCamera {
  const z = Math.max(0.12, Math.min(2.8, cam.zoom * factor))
  const worldX = (sx - vw / 2) / cam.zoom + cam.x
  const worldY = (sy - vh / 2) / cam.zoom + cam.y
  return {
    zoom: z,
    x: worldX - (sx - vw / 2) / z,
    y: worldY - (sy - vh / 2) / z,
  }
}

export function screenToWorldFlat(
  sx: number,
  sy: number,
  vw: number,
  vh: number,
  cam: BoardCamera,
): { x: number; y: number } {
  return {
    x: (sx - vw / 2) / cam.zoom + cam.x,
    y: (sy - vh / 2) / cam.zoom + cam.y,
  }
}

/** Viewport-axis-aligned marquee → world AABB (handles rotation-free camera). */
export function marqueeViewportToWorldAabb(
  vx: number,
  vy: number,
  wv: number,
  hv: number,
  vw: number,
  vh: number,
  cam: BoardCamera,
): WorldRect {
  const pts = [
    screenToWorldFlat(vx, vy, vw, vh, cam),
    screenToWorldFlat(vx + wv, vy, vw, vh, cam),
    screenToWorldFlat(vx + wv, vy + hv, vw, vh, cam),
    screenToWorldFlat(vx, vy + hv, vw, vh, cam),
  ]
  return {
    l: Math.min(...pts.map((p) => p.x)),
    r: Math.max(...pts.map((p) => p.x)),
    t: Math.min(...pts.map((p) => p.y)),
    b: Math.max(...pts.map((p) => p.y)),
  }
}

export function cardWorldBounds(c: WorkflowCard): WorldRect {
  const h = cardDisplayHeight(c)
  return { l: c.x, t: c.y, r: c.x + c.width, b: c.y + h }
}

export function fitCameraToCards(
  cards: WorkflowCard[],
  vw: number,
  vh: number,
  padding = 120,
): BoardCamera {
  if (cards.length === 0 || vw <= 0 || vh <= 0) {
    return { x: 0, y: 0, zoom: 1 }
  }

  const seed = cardWorldBounds(cards[0]!)
  const bounds = cards
    .map((card) => cardWorldBounds(card))
    .reduce<WorldRect>(
      (acc, rect) => ({
        l: Math.min(acc.l, rect.l),
        t: Math.min(acc.t, rect.t),
        r: Math.max(acc.r, rect.r),
        b: Math.max(acc.b, rect.b),
      }),
      seed,
    )

  const width = Math.max(240, bounds.r - bounds.l + padding * 2)
  const height = Math.max(180, bounds.b - bounds.t + padding * 2)
  const zoom = clamp(Math.min(vw / width, vh / height), 0.24, 1.12)

  return {
    x: (bounds.l + bounds.r) / 2,
    y: (bounds.t + bounds.b) / 2,
    zoom,
  }
}

export function worldRectsIntersect(a: WorldRect, b: WorldRect): boolean {
  return !(a.r < b.l || a.l > b.r || a.b < b.t || a.t > b.b)
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
