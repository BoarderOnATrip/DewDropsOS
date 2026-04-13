import { describe, expect, it } from 'vitest'
import { touchPairMetrics } from './boardTouch'

describe('touchPairMetrics', () => {
  it('returns center and distance in rect-local space', () => {
    const m = touchPairMetrics(
      { clientX: 110, clientY: 210 },
      { clientX: 130, clientY: 230 },
      { left: 100, top: 200 },
    )
    expect(m.cx).toBeCloseTo(20)
    expect(m.cy).toBeCloseTo(20)
    expect(m.dist).toBeCloseTo(Math.hypot(20, 20))
  })
})
