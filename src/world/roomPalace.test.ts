import { describe, expect, it } from 'vitest'
import { buildRoomPalaceMapping, roomPalaceZoneLabel } from './roomPalace'

describe('roomPalaceZoneLabel', () => {
  it('returns canonical zone labels', () => {
    expect(roomPalaceZoneLabel('door')).toBe('Door')
    expect(roomPalaceZoneLabel('console')).toBe('Console')
  })
})

describe('buildRoomPalaceMapping', () => {
  it('maps preview-style room data into canonical palace zones', () => {
    const mapping = buildRoomPalaceMapping({
      title: 'Phone Relay',
      summary: 'Keep the handoff tight.',
      actors: ['Tyler', 'Codex'],
      loci: ['Doorway', 'Table'],
      artifacts: ['Call notes', 'Contract'],
      tunnels: ['Launch deck'],
      anchors: ['CFO', 'Renewal'],
      briefs: ['Phone brief', 'Desktop brief'],
      openQuestions: ['Need signature?', 'Need redlines?'],
      latestRun: 'Swarm run-8',
    })

    expect(mapping.title).toBe('Phone Relay')
    expect(mapping.summary).toBe('Keep the handoff tight.')
    expect(mapping.counts).toEqual({
      actors: 2,
      loci: 2,
      artifacts: 2,
      tunnels: 1,
      anchors: 2,
      briefs: 2,
      openQuestions: 2,
      hasLatestRun: true,
    })
    expect(mapping.zones.map((zone) => zone.id)).toEqual([
      'door',
      'table',
      'wall',
      'shelf',
      'drawer',
      'window',
      'floor',
      'console',
    ])
    expect(mapping.zones[0]).toEqual(
      expect.objectContaining({
        label: 'Door',
        summary: 'Keep the handoff tight.',
        tone: 'calm',
        items: [
          expect.objectContaining({
            label: 'Phone Relay',
            kind: 'room',
            detail: 'Room identity',
          }),
        ],
      }),
    )
    expect(mapping.zones[1]).toEqual(
      expect.objectContaining({
        label: 'Table',
        tone: 'ready',
        items: [
          expect.objectContaining({ label: 'Tyler', kind: 'actor' }),
          expect.objectContaining({ label: 'Codex', kind: 'actor' }),
        ],
      }),
    )
    expect(mapping.zones[2]).toEqual(
      expect.objectContaining({
        label: 'Wall',
        items: [
          expect.objectContaining({ label: 'CFO', kind: 'anchor' }),
          expect.objectContaining({ label: 'Renewal', kind: 'anchor' }),
          expect.objectContaining({ label: 'Launch deck', kind: 'tunnel' }),
        ],
      }),
    )
    expect(mapping.zones[5]).toEqual(
      expect.objectContaining({
        label: 'Window',
        tone: 'ready',
        items: [
          expect.objectContaining({ label: 'Phone brief', kind: 'brief' }),
          expect.objectContaining({ label: 'Desktop brief', kind: 'brief' }),
        ],
      }),
    )
    expect(mapping.zones[6]).toEqual(
      expect.objectContaining({
        label: 'Floor',
        items: [
          expect.objectContaining({ label: 'Doorway', kind: 'locus' }),
          expect.objectContaining({ label: 'Table', kind: 'locus' }),
        ],
      }),
    )
    expect(mapping.zones[7]).toEqual(
      expect.objectContaining({
        label: 'Console',
        summary: 'Latest run: Swarm run-8',
        tone: 'ready',
        items: [
          expect.objectContaining({
            label: 'Swarm run-8',
            kind: 'run',
            detail: 'Latest run',
          }),
        ],
      }),
    )
  })

  it('normalizes blank values and keeps repeated calls deterministic', () => {
    const input = {
      title: '  Garden Room  ',
      summary: '  ',
      actors: ['  Ada  ', '', '  ', 'Bea'],
      loci: [' North ', 'South'],
      artifacts: [' Note '],
      tunnels: ['  Path  '],
      anchors: [' Anchor '],
      briefs: ['  Phone  '],
      openQuestions: ['  Q1  '],
      latestRun: '  Run-1  ',
    }

    const first = buildRoomPalaceMapping(input)
    const second = buildRoomPalaceMapping(input)

    expect(first).toEqual(second)
    expect(first.title).toBe('Garden Room')
    expect(first.summary).toBe('Room palace for Garden Room')
    expect(first.zones[1].items.map((item) => item.label)).toEqual(['Ada', 'Bea'])
    expect(first.zones[5].items.map((item) => item.label)).toEqual(['Phone'])
    expect(first.zones[7].items.map((item) => item.label)).toEqual(['Run-1'])
  })

  it('caps zone items and adds an overflow item when a zone is crowded', () => {
    const mapping = buildRoomPalaceMapping({
      title: 'Overflow Room',
      actors: ['A', 'B', 'C', 'D', 'E', 'F'],
      briefs: ['One', 'Two', 'Three', 'Four', 'Five'],
      loci: ['L1', 'L2', 'L3', 'L4', 'L5'],
    })

    expect(mapping.zones[1].items).toHaveLength(5)
    expect(mapping.zones[1].items.at(-1)).toEqual(
      expect.objectContaining({
        label: '+2 more',
        kind: 'overflow',
      }),
    )
    expect(mapping.zones[5].items).toHaveLength(5)
    expect(mapping.zones[6].items).toHaveLength(5)
  })
})
