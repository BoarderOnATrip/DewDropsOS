import { describe, expect, it } from 'vitest'
import {
  SWARM_RECIPES,
  getSwarmRecipe,
  listSwarmRecipes,
  listSwarmRecipesByKind,
} from './swarmRecipes'

describe('swarm recipe catalog', () => {
  it('every recipe has a non-empty id, label, description, and at least one role', () => {
    for (const recipe of SWARM_RECIPES) {
      expect(recipe.id.trim()).not.toBe('')
      expect(recipe.label.trim()).not.toBe('')
      expect(recipe.description.trim()).not.toBe('')
      expect(recipe.roles.length).toBeGreaterThan(0)
    }
  })

  it('all recipe ids are unique', () => {
    const ids = SWARM_RECIPES.map((r) => r.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every role has a non-empty role name and objective', () => {
    for (const recipe of SWARM_RECIPES) {
      for (const role of recipe.roles) {
        expect(role.role.trim()).not.toBe('')
        expect(role.objective.trim()).not.toBe('')
      }
    }
  })

  it('templates map to valid Butler swarm template values', () => {
    const valid = new Set(['planning', 'relationship', 'operator', 'research', 'build'])
    for (const recipe of SWARM_RECIPES) {
      expect(valid.has(recipe.template)).toBe(true)
    }
  })

  it('getSwarmRecipe returns the matching recipe', () => {
    const recipe = getSwarmRecipe('build-review-ship')
    expect(recipe).toBeDefined()
    expect(recipe?.kind).toBe('build')
    expect(recipe?.template).toBe('build')
    expect(recipe?.roles.map((r) => r.role)).toEqual(['builder', 'reviewer', 'shipper'])
  })

  it('getSwarmRecipe returns undefined for an unknown id', () => {
    expect(getSwarmRecipe('does-not-exist')).toBeUndefined()
  })

  it('listSwarmRecipes returns all recipes', () => {
    expect(listSwarmRecipes()).toBe(SWARM_RECIPES)
    expect(listSwarmRecipes().length).toBeGreaterThan(0)
  })

  it('listSwarmRecipesByKind filters correctly', () => {
    const researchRecipes = listSwarmRecipesByKind('research')
    expect(researchRecipes.length).toBeGreaterThan(0)
    for (const recipe of researchRecipes) {
      expect(recipe.kind).toBe('research')
    }
  })
})
