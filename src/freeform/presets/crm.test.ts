import { describe, expect, it } from 'vitest'
import { compileBriefPacket } from '../briefCompiler'
import { getCapabilityProfile } from '../capabilityProfiles'
import { getSwarmRecipe } from '../swarmRecipes'
import { crmPreset } from './crm'

describe('crmPreset', () => {
  it('seeds the generic CRM rooms with briefs and dependency wires', () => {
    const preset = crmPreset()
    const problemCards = preset.cards.filter((card) => card.kind === 'problem')

    expect(problemCards).toHaveLength(4)
    expect(preset.wires).toHaveLength(4)
    expect(problemCards.map((card) => card.title)).toEqual([
      'Contacts',
      'Opportunities',
      'Pipeline',
      'Follow-ups',
    ])
    expect(problemCards.every((card) => card.briefLocked)).toBe(true)
    expect(problemCards.every((card) => card.briefVersion === 1)).toBe(true)
    expect(problemCards.every((card) => card.briefSpec?.projectId === 'crm')).toBe(true)
    expect(problemCards.some((card) => card.id.includes('stephanie'))).toBe(false)
    expect(
      problemCards
        .filter((card) => card.runLedger && card.runLedger.length > 0)
        .map((card) => card.id),
    ).toEqual(['crm-opportunities'])
  })

  it('references only valid capability profiles and swarm recipes', () => {
    const preset = crmPreset()

    for (const card of preset.cards) {
      if (card.capabilityProfileId) {
        expect(getCapabilityProfile(card.capabilityProfileId)).toBeDefined()
      }
      if (card.swarmRecipeId) {
        expect(getSwarmRecipe(card.swarmRecipeId)).toBeDefined()
      }
    }
  })

  it('matches brief dependencies with actual wires', () => {
    const preset = crmPreset()

    for (const card of preset.cards) {
      const dependsOn = card.briefSpec?.execution.dependsOn ?? []
      for (const dep of dependsOn) {
        expect(
          preset.wires.some((wire) => wire.fromCardId === dep && wire.toCardId === card.id),
          `'${card.title}' depends on '${dep}' but no wire exists for that dependency`,
        ).toBe(true)
      }
    }
  })

  it('seeds the Opportunities room with a completed first-pass run and reviewable CRM artifacts', () => {
    const preset = crmPreset()
    const opportunitiesRoom = preset.cards.find((card) => card.id === 'crm-opportunities')

    expect(opportunitiesRoom).toBeDefined()
    expect(opportunitiesRoom?.runLedger).toHaveLength(1)

    const run = opportunitiesRoom?.runLedger?.[0]
    const briefPacket = opportunitiesRoom ? compileBriefPacket(opportunitiesRoom, opportunitiesRoom.id) : null

    expect(run?.title).toBe('Opportunities room live brief-engine pass')
    expect(run?.continuationDecision).toBe('complete')
    expect(run?.selfEvaluation?.allCriteriaMet).toBe(true)
    expect(run?.selfEvaluation?.criteriaCovered).toEqual([
      'crm-opportunities-stage-flow',
      'crm-opportunities-deliverables',
    ])
    expect(run?.briefVersion).toBe(briefPacket?.briefVersion)
    expect(run?.briefHash).toBe(briefPacket?.briefHash)
    expect(run?.artifacts.map((artifact) => artifact.title)).toEqual([
      'Opportunities room brief pass report',
      'Opportunity workflow spec',
      'Opportunity module plan',
      'Opportunity readiness artifact',
    ])
    expect(opportunitiesRoom?.memoryAnchors).toEqual(
      expect.arrayContaining([
        'artifact/crm/opportunity-workflow-spec',
        'artifact/crm/opportunity-module-plan',
        'artifact/crm/opportunity-readiness-artifact',
      ]),
    )
  })
})
