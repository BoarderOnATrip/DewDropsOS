import { describe, expect, it } from 'vitest'
import type { BriefSpec } from './briefSpec'
import type { WorkflowCard } from './types'
import { serializeRtkBasisLines } from './rtk'
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

function briefSpec(): BriefSpec {
  return {
    id: 'brief-1',
    creative: {
      mission: 'Ship the phone relay loop.',
      beneficiary: 'Tyler needs quick relay continuity.',
      references: [],
    },
    execution: {
      task: 'Implement the RTK handoff for phone relay.',
      acceptanceCriteria: [
        { id: 'ac-1', description: 'Handoff packet is RTK-first.' },
      ],
      scope: { in: ['RTK packet'], out: ['Unrelated UI changes'] },
      projectStructure: ['src/', 'src/freeform/', 'src/freeform/rtk.ts'],
      antiPatterns: [],
      deliverables: ['Compact handoff packet'],
    },
    escalationPolicy: 'outcome-contradiction-only',
    autonomyPolicy: 'full-auto',
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
        memoryAnchors: ['compartment/phone', 'entity/butler'],
        briefCompartmentAssets: [
          {
            id: 'compartment-1',
            name: 'final-caption.md',
            mimeType: 'text/markdown',
            sizeBytes: 1024,
            addedAt: '2026-04-19T10:00:00.000Z',
            compartmentId: 'system:publish',
            compartmentLabel: 'Publish Gate',
            compartmentKind: 'publish',
            anchorRef: 'compartment/publish-gate',
            extension: 'md',
            organizeStatus: 'sorted',
          },
        ],
        briefSpec: briefSpec(),
        briefVersion: 3,
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
    expect(blueprint.handoffLines[0]).toBe('rtk:v1')
    expect(serializeRtkBasisLines(blueprint.rtkBasis)[0]).toBe(blueprint.handoffLines[0])
    expect(blueprint.handoffText).toContain('bv:3')
    expect(blueprint.handoffText).toContain('tk:Implement the RTK handoff for phone relay.')
    expect(blueprint.handoffText).toContain('ac:ac-1:Handoff packet is RTK-first.')
    expect(blueprint.handoffText).toContain('mw:butler')
    expect(blueprint.handoffText).toContain('ps:src/ | src/freeform/ | src/freeform/rtk.ts')
    expect(blueprint.handoffText).toContain('a:compartment/phone | entity/butler | compartment/publish-gate | artifact/final-caption-md')
    expect(blueprint.handoffText).toContain('src:Publish Gate -> final-caption.md')
    expect(blueprint.handoffText).toContain('l1:north_star | North Star | Keep the relay goal visible.')
    expect(blueprint.handoffText).toContain('pb:Escalate only urgent approvals.')
    expect(blueprint.sourceRefs).toContain('dewdrops/cards/p1/compartments/compartment-1')
  })

  it('falls back to desktop heavy-work defaults', () => {
    const blueprint = buildProblemSessionBlueprint(problem(), 'desktop')
    expect(blueprint.target).toBe('local_desktop')
    expect(blueprint.memoryWing).toBe('phone-butler-mvp')
    expect(blueprint.memoryRoom).toBe('heavy-work')
    expect(blueprint.sourceRefs[1]).toContain('lifegirdle/wings/phone-butler-mvp/rooms/heavy-work')
    expect(blueprint.handoffText).toContain('ws:desktop')
  })

  it('uses the problem id as the RTK room fallback when no Butler room id exists', () => {
    const blueprint = buildProblemSessionBlueprint(problem(), 'desktop')
    expect(blueprint.rtkBasis.room_id).toBe('p1')
    expect(blueprint.handoffText).not.toContain('pending-local-room')
  })

  it('tolerates partially shaped runtime brief specs', () => {
    const blueprint = buildProblemSessionBlueprint(
      problem({
        briefSpec: {
          id: 'brief-legacy',
          creative: { mission: 'Carry the room forward.' },
        } as unknown as WorkflowCard['briefSpec'],
      }),
      'desktop',
    )

    expect(blueprint.handoffText).toContain('m:Carry the room forward.')
    expect(blueprint.handoffLines.some((line) => line.startsWith('tk:'))).toBe(false)
    expect(blueprint.rtkBasis.room_id).toBe('p1')
  })
})
