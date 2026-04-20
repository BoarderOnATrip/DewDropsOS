import { describe, expect, it } from 'vitest'
import { getCapabilityProfile } from '../capabilityProfiles'
import { getSwarmRecipe } from '../swarmRecipes'
import { getPreset, PRESET_REGISTRY } from './index'

describe('PRESET_REGISTRY', () => {
  it('contains at least two entries: crm and stephanie-crm', () => {
    const ids = PRESET_REGISTRY.map((e) => e.id)
    expect(ids).toContain('crm')
    expect(ids).toContain('stephanie-crm')
  })

  it('every entry has a non-empty name, description, workspaceName, and factory', () => {
    for (const entry of PRESET_REGISTRY) {
      expect(entry.name.trim().length).toBeGreaterThan(0)
      expect(entry.description.trim().length).toBeGreaterThan(0)
      expect(entry.workspaceName.trim().length).toBeGreaterThan(0)
      expect(typeof entry.factory).toBe('function')
    }
  })

  it('each factory produces cards and wires without throwing', () => {
    for (const entry of PRESET_REGISTRY) {
      const preset = entry.factory()
      expect(preset.cards.length).toBeGreaterThan(0)
      expect(Array.isArray(preset.wires)).toBe(true)
    }
  })

  it('no preset references an invalid capability profile or swarm recipe', () => {
    for (const entry of PRESET_REGISTRY) {
      const preset = entry.factory()
      for (const card of preset.cards) {
        if (card.capabilityProfileId) {
          expect(getCapabilityProfile(card.capabilityProfileId), `${entry.id}: unknown capabilityProfileId "${card.capabilityProfileId}"`).toBeDefined()
        }
        if (card.swarmRecipeId) {
          expect(getSwarmRecipe(card.swarmRecipeId), `${entry.id}: unknown swarmRecipeId "${card.swarmRecipeId}"`).toBeDefined()
        }
      }
    }
  })

  it('no two entries share the same id', () => {
    const ids = PRESET_REGISTRY.map((e) => e.id)
    expect(ids.length).toBe(new Set(ids).size)
  })
})

describe('getPreset', () => {
  it('returns the matching entry by id', () => {
    const entry = getPreset('crm')
    expect(entry?.id).toBe('crm')
  })

  it('returns undefined for an unknown id', () => {
    expect(getPreset('does-not-exist')).toBeUndefined()
  })
})
