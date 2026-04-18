import { describe, expect, it } from 'vitest'
import type { WorkflowCard } from './types'
import {
  buildProblemSessionBlueprint,
  formatAnchorInput,
  parseAnchorInput,
} from './sessionBlueprint'

function problem(overrides: Partial<WorkflowCard> = {}): WorkflowCard {
  return {
    id: 'p1',
    title: 'Phone Butler MVP',
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

describe('sessionBlueprint helpers', () => {
  it('parses and formats memory anchors', () => {
    expect(parseAnchorInput('one, two\nthree, two')).toEqual(['one', 'two', 'three'])
    expect(formatAnchorInput(['one', 'two'])).toBe('one, two')
  })

  it('builds a phone-aware blueprint from problem context', () => {
    const blueprint = buildProblemSessionBlueprint(
      problem({
        preferredLaunchSurface: 'phone',
        memoryWing: 'butler',
        memoryRoom: 'phone-relay',
        memoryContextSummary: 'Handle quick mobile capture and screening.',
        memoryAnchors: ['drawer/phone', 'entity/butler'],
        memoryPalaceLoci: [
          {
            id: 'north',
            title: 'North Star',
            kind: 'north_star',
            detail: 'Keep the relay goal visible.',
          },
        ],
        phoneRelayBrief: 'Escalate only urgent approvals.',
      }),
      'phone',
    )

    expect(blueprint.target).toBe('paired_phone')
    expect(blueprint.launcher).toBe('mobile')
    expect(blueprint.handoffText).toContain('memory_wing: butler')
    expect(blueprint.handoffText).toContain('palace_locus_1: North star | North Star | Keep the relay goal visible.')
    expect(blueprint.handoffText).toContain('phone_brief: Escalate only urgent approvals.')
  })

  it('falls back to desktop heavy-work defaults', () => {
    const blueprint = buildProblemSessionBlueprint(problem(), 'desktop')
    expect(blueprint.target).toBe('local_desktop')
    expect(blueprint.memoryWing).toBe('phone-butler-mvp')
    expect(blueprint.memoryRoom).toBe('heavy-work')
    expect(blueprint.sourceRefs[1]).toContain('lifegirdle/wings/phone-butler-mvp/rooms/heavy-work')
  })
})
