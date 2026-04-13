import { describe, expect, it } from 'vitest'
import { clampNumber, formatRunStatus, swarmRunIsActive } from './runFormat'

describe('swarmRunIsActive', () => {
  it('treats queued, running, staged as active', () => {
    expect(swarmRunIsActive('running')).toBe(true)
    expect(swarmRunIsActive('done')).toBe(false)
    expect(swarmRunIsActive(undefined)).toBe(false)
  })
})

describe('clampNumber', () => {
  it('clamps to range', () => {
    expect(clampNumber(5, 0, 10)).toBe(5)
    expect(clampNumber(-1, 0, 10)).toBe(0)
    expect(clampNumber(99, 0, 10)).toBe(10)
  })
})

describe('formatRunStatus', () => {
  it('replaces underscores and handles missing', () => {
    expect(formatRunStatus('in_progress')).toBe('in progress')
    expect(formatRunStatus(undefined)).toBe('unknown')
  })
})
