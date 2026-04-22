import { describe, expect, it } from 'vitest'
import { compileBriefPacket } from '../briefCompiler'
import { getCapabilityProfile } from '../capabilityProfiles'
import { getSwarmRecipe } from '../swarmRecipes'
import { stephanieCrmPreset } from './stephanieCrm'

describe('stephanieCrmPreset', () => {
  it('seeds the four CRM rooms with briefs and dependency wires', () => {
    const preset = stephanieCrmPreset()
    const problemCards = preset.cards.filter((card) => card.kind === 'problem')

    expect(problemCards).toHaveLength(4)
    expect(preset.wires).toHaveLength(4)
    expect(problemCards.map((card) => card.title)).toEqual([
      'Contacts',
      'Listings',
      'Pipeline',
      'Follow-ups',
    ])
    expect(problemCards.every((card) => card.briefLocked)).toBe(true)
    expect(problemCards.every((card) => card.briefVersion === 1)).toBe(true)
    expect(problemCards.every((card) => card.briefSpec?.projectId === 'stephanie-crm')).toBe(true)
  })

  it('references only valid capability profiles from the catalog', () => {
    const preset = stephanieCrmPreset()
    for (const card of preset.cards) {
      if (!card.capabilityProfileId) continue
      expect(
        getCapabilityProfile(card.capabilityProfileId),
        `Capability profile '${card.capabilityProfileId}' used by '${card.title}' is not in the catalog`,
      ).toBeDefined()
    }
  })

  it('references only valid swarm recipes from the catalog', () => {
    const preset = stephanieCrmPreset()
    for (const card of preset.cards) {
      if (!card.swarmRecipeId) continue
      expect(
        getSwarmRecipe(card.swarmRecipeId),
        `Swarm recipe '${card.swarmRecipeId}' used by '${card.title}' is not in the catalog`,
      ).toBeDefined()
    }
  })

  it('has globally unique acceptance criteria IDs across all rooms', () => {
    const preset = stephanieCrmPreset()
    const allCriterionIds = preset.cards.flatMap(
      (card) => card.briefSpec?.execution.acceptanceCriteria.map((ac) => ac.id) ?? [],
    )
    const uniqueIds = new Set(allCriterionIds)
    expect(uniqueIds.size).toBe(allCriterionIds.length)
  })

  it('wires correspond to dependsOn relationships declared in briefs', () => {
    const preset = stephanieCrmPreset()
    const cardIds = new Set(preset.cards.map((card) => card.id))
    const wireTargets = new Set(preset.wires.map((wire) => wire.toCardId))

    for (const card of preset.cards) {
      const dependsOn = card.briefSpec?.execution.dependsOn ?? []
      for (const dep of dependsOn) {
        expect(cardIds, `dependsOn ref '${dep}' in '${card.title}' must be a room in the preset`).toContain(dep)
        expect(
          wireTargets.has(card.id) || preset.wires.some((w) => w.fromCardId === dep && w.toCardId === card.id),
          `'${card.title}' depends on '${dep}' but no wire exists for that dependency`,
        ).toBe(true)
      }
    }
  })

  it('every room has a non-empty mission and at least one acceptance criterion', () => {
    const preset = stephanieCrmPreset()
    for (const card of preset.cards) {
      expect(card.mission?.trim(), `'${card.title}' should have a mission`).toBeTruthy()
      expect(
        (card.briefSpec?.execution.acceptanceCriteria.length ?? 0) > 0,
        `'${card.title}' should have at least one acceptance criterion`,
      ).toBe(true)
    }
  })

  it('seeds the Contacts room with a completed first-pass run and reviewable CRM artifacts', () => {
    const preset = stephanieCrmPreset()
    const contactsRoom = preset.cards.find((card) => card.id === 'stephanie-crm-contacts')

    expect(contactsRoom).toBeDefined()
    expect(contactsRoom?.runLedger).toHaveLength(1)

    const run = contactsRoom?.runLedger?.[0]
    const briefPacket = contactsRoom ? compileBriefPacket(contactsRoom, contactsRoom.id) : null

    expect(run?.title).toBe('Contacts room live brief-engine pass')
    expect(run?.continuationDecision).toBe('complete')
    expect(run?.selfEvaluation?.allCriteriaMet).toBe(true)
    expect(run?.selfEvaluation?.criteriaCovered).toEqual([
      'contacts-core-entities',
      'contacts-context-capture',
    ])
    expect(run?.briefVersion).toBe(briefPacket?.briefVersion)
    expect(run?.briefHash).toBe(briefPacket?.briefHash)
    expect(run?.artifacts.map((artifact) => artifact.title)).toEqual([
      'Contacts room brief pass report',
      'Contact schema',
      'Relationship map',
      'Field dictionary',
    ])
    expect(contactsRoom?.memoryAnchors).toEqual(
      expect.arrayContaining([
        'artifact/stephanie-crm/contact-schema',
        'artifact/stephanie-crm/relationship-map',
        'artifact/stephanie-crm/field-dictionary',
      ]),
    )
  })
})
