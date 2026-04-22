import { describe, expect, it } from 'vitest'

import {
  buildProjection,
  buildWorldIndex,
  describeWorldRef,
  getParentWorldRef,
  isAgent,
  isActor,
  isOrganization,
  isPerson,
  isRoom,
  listDrillTargets,
  projectEarth,
  projectRoom,
  worldRef,
} from './model'
import { seedWorldGraph, seedWorldProjection } from './seed'

describe('world ontology', () => {
  it('indexes the seeded world graph', () => {
    const index = buildWorldIndex(seedWorldGraph)

    expect(index.wingById.size).toBe(1)
    expect(index.roomById.size).toBe(3)
    expect(index.actorById.size).toBe(5)
    expect(index.locusById.size).toBe(10)
    expect(index.artifactById.size).toBe(4)

    expect(index.roomsByWingId.get('wing-work-goals')?.map((room) => room.id)).toEqual([
      'room-launch-deck',
      'room-memory-palace',
      'room-phone-relay',
    ])

    expect(index.actorsByRoomId.get('room-launch-deck')?.map((actor) => actor.id)).toEqual([
      'person-tyler',
      'organization-aibutler',
      'agent-codex',
      'agent-claude',
    ])
  })

  it('projects a room into a UI-friendly world slice', () => {
    const projection = buildProjection(seedWorldGraph, worldRef('room', 'room-launch-deck'), 'room')

    expect(projection.kind).toBe('projection')
    expect(projection.mode).toBe('room')
    expect(projection.title).toBe('Launch Deck')
    expect(projection.breadcrumb).toEqual(['DewDrops Swarm OS World', 'Work-Goals', 'Launch Deck'])
    expect(projection.cards.map((card) => card.id)).toEqual(
      expect.arrayContaining([
        'room-launch-deck',
        'wing-work-goals',
        'person-tyler',
        'organization-aibutler',
        'agent-codex',
        'agent-claude',
        'room-memory-palace',
        'room-phone-relay',
      ]),
    )
    expect(projection.links.map((link) => link.kind)).toEqual(
      expect.arrayContaining(['containment', 'tunnel']),
    )
  })

  it('exposes the seeded projection for the first UI shell', () => {
    expect(seedWorldProjection.focus).toEqual(worldRef('room', 'room-launch-deck'))
    expect(seedWorldProjection.cards[0]?.kind).toBe('room')
    expect(seedWorldProjection.cards.map((card) => card.id)).toContain('room-memory-palace')
  })

  it('keeps the ontology guards aligned with the union types', () => {
    const person = seedWorldGraph.actors.find((actor) => actor.kind === 'person')
    const org = seedWorldGraph.actors.find((actor) => actor.kind === 'organization')
    const agent = seedWorldGraph.actors.find((actor) => actor.kind === 'agent')
    const room = seedWorldGraph.rooms[0]

    expect(person && isPerson(person)).toBe(true)
    expect(org && isOrganization(org)).toBe(true)
    expect(agent && isAgent(agent)).toBe(true)
    expect(room && isRoom(room)).toBe(true)
    expect(person && isActor(person)).toBe(true)
  })

  it('describes world refs for UI labels', () => {
    expect(describeWorldRef(seedWorldGraph, worldRef('room', 'room-phone-relay'))).toBe('Phone Relay (room)')
  })

  it('can project the world and earth views from the same graph', () => {
    const roomProjection = projectRoom(seedWorldGraph, 'room-memory-palace')
    const earthProjection = projectEarth(seedWorldGraph)

    expect(roomProjection.focus).toEqual(worldRef('room', 'room-memory-palace'))
    expect(roomProjection.cards.map((card) => card.id)).toContain('room-phone-relay')
    expect(earthProjection.mode).toBe('earth')
    expect(earthProjection.cards.map((card) => card.kind)).toContain('wing')
  })

  it('supports drill-up and drill-down references', () => {
    expect(getParentWorldRef(seedWorldGraph, worldRef('locus', 'locus-control-surface'))).toEqual(
      worldRef('room', 'room-launch-deck'),
    )
    expect(listDrillTargets(seedWorldGraph, worldRef('room', 'room-launch-deck'))).toEqual(
      expect.arrayContaining([
        worldRef('locus', 'locus-north-star'),
        worldRef('locus', 'locus-control-surface'),
      ]),
    )
  })
})
