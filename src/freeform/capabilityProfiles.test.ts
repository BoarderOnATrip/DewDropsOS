import { describe, expect, it } from 'vitest'
import {
  CAPABILITY_PROFILES,
  getCapabilityProfile,
  listCapabilityProfiles,
} from './capabilityProfiles'

describe('capability profile catalog', () => {
  it('contains at least one profile per kind', () => {
    const kinds = CAPABILITY_PROFILES.map((p) => p.kind)
    expect(kinds).toContain('research')
    expect(kinds).toContain('build')
    expect(kinds).toContain('review')
    expect(kinds).toContain('ship')
    expect(kinds).toContain('ops')
  })

  it('every profile has a non-empty id, label, and description', () => {
    for (const profile of CAPABILITY_PROFILES) {
      expect(profile.id.trim()).not.toBe('')
      expect(profile.label.trim()).not.toBe('')
      expect(profile.description.trim()).not.toBe('')
    }
  })

  it('all profile ids are unique', () => {
    const ids = CAPABILITY_PROFILES.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('getCapabilityProfile returns the matching profile', () => {
    const profile = getCapabilityProfile('build-local')
    expect(profile).toBeDefined()
    expect(profile?.kind).toBe('build')
    expect(profile?.tools).toContain('bash')
  })

  it('getCapabilityProfile returns undefined for an unknown id', () => {
    expect(getCapabilityProfile('does-not-exist')).toBeUndefined()
  })

  it('listCapabilityProfiles returns all profiles', () => {
    expect(listCapabilityProfiles()).toBe(CAPABILITY_PROFILES)
    expect(listCapabilityProfiles().length).toBeGreaterThan(0)
  })
})
