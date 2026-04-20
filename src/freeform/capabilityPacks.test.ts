import { describe, expect, it } from 'vitest'
import { emptyBriefSpec } from './briefSpec'
import { applyCapabilityPack, getCapabilityPack, resolveCapabilityPackId, syncCapabilityPack } from './capabilityPacks'
import type { WorkflowCard } from './types'

function problemCard(overrides: Partial<WorkflowCard> = {}): WorkflowCard {
  return {
    id: 'problem-1',
    x: 0,
    y: 0,
    width: 320,
    height: 220,
    title: 'Contacts',
    expanded: true,
    color: '#fff',
    kind: 'problem',
    swarmTemplate: 'relationship',
    preferredLaunchSurface: 'hybrid',
    capabilityProfileId: 'research-standard',
    swarmRecipeId: 'relationship-map',
    briefSpec: {
      ...emptyBriefSpec('brief-1'),
      capabilityProfileId: 'research-standard',
      swarmRecipeId: 'relationship-map',
    },
    ...overrides,
  }
}

describe('capabilityPacks', () => {
  it('infers a pack from a matching room configuration', () => {
    expect(resolveCapabilityPackId(problemCard())).toBe('relationship-memory')
  })

  it('clears an explicit pack id when the room no longer matches it', () => {
    const card = problemCard({
      capabilityPackId: 'relationship-memory',
      preferredLaunchSurface: 'desktop',
    })
    expect(resolveCapabilityPackId(card)).toBeUndefined()
  })

  it('applies pack defaults to the room and brief', () => {
    const pack = getCapabilityPack('delivery-builder')
    expect(pack).toBeTruthy()

    const next = applyCapabilityPack(problemCard(), pack!)
    expect(next.capabilityPackId).toBe('delivery-builder')
    expect(next.capabilityProfileId).toBe('build-local')
    expect(next.swarmRecipeId).toBe('build-review-ship')
    expect(next.swarmTemplate).toBe('build')
    expect(next.preferredLaunchSurface).toBe('desktop')
    expect(next.briefSpec?.autonomyPolicy).toBe('milestone-checkpoint')
  })

  it('syncs a stale room back to the matching pack id', () => {
    const synced = syncCapabilityPack(
      problemCard({
        capabilityPackId: 'delivery-builder',
      }),
    )
    expect(synced.capabilityPackId).toBe('relationship-memory')
  })
})
