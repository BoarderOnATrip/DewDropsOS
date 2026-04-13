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

export function worldRectsIntersect(a: WorldRect, b: WorldRect): boolean {
  return !(a.r < b.l || a.l > b.r || a.b < b.t || a.t > b.b)
}
