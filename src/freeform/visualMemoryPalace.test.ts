import { describe, expect, it } from 'vitest'
import type { WorkflowCard } from './types'
import {
  buildVisualMemoryPalace,
  formatVisualMemoryPalaceDraft,
  parseVisualMemoryPalaceDraft,
} from './visualMemoryPalace'

function problem(overrides: Partial<WorkflowCard> = {}): WorkflowCard {
  return {
    id: 'p1',
    title: 'Memory Room',
    expanded: true,
    color: '#fff',
    kind: 'problem',
    x: 0,
    y: 0,
    width: 280,
    height: 180,
    ...overrides,
  }
}

describe('visualMemoryPalace helpers', () => {
  it('parses and formats loci draft text', () => {
    const loci = parseVisualMemoryPalaceDraft(
      'North Star | north_star | Keep the mission visible.\nRoadmap Drawer | artifact | drawer/roadmap',
    )
    expect(loci).toHaveLength(2)
    expect(loci[0]?.kind).toBe('north_star')
    expect(formatVisualMemoryPalaceDraft(loci)).toContain('Roadmap Drawer | artifact | drawer/roadmap')
  })

  it('derives fallback loci from a problem without explicit visual scaffolding', () => {
    const loci = buildVisualMemoryPalace(
      problem({
        memoryWing: 'relay',
        memoryRoom: 'screening-bay',
        memoryContextSummary: 'Capture the current operating context.',
        memoryAnchors: ['drawer/roadmap', 'room/phone-relay'],
        phoneRelayBrief: 'Escalate only urgent approvals.',
      }),
    )

    expect(loci[0]?.title).toBe('North Star')
    expect(loci.some((locus) => locus.detail === 'drawer/roadmap')).toBe(true)
    expect(loci.some((locus) => locus.title === 'Phone relay checkpoint')).toBe(true)
  })
})
