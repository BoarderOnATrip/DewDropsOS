/** Pinch / two-finger zoom anchor in viewport-local coordinates. */
export function touchPairMetrics(
  t0: { clientX: number; clientY: number },
  t1: { clientX: number; clientY: number },
  rect: { left: number; top: number },
): { cx: number; cy: number; dist: number } {
  const x1 = t0.clientX - rect.left
  const y1 = t0.clientY - rect.top
  const x2 = t1.clientX - rect.left
  const y2 = t1.clientY - rect.top
  return {
    cx: (x1 + x2) / 2,
    cy: (y1 + y2) / 2,
    dist: Math.hypot(x2 - x1, y2 - y1),
  }
}
