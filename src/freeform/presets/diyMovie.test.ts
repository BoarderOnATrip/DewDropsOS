import { describe, expect, it } from 'vitest'
import { compileBriefPacket } from '../briefCompiler'
import { getCapabilityProfile } from '../capabilityProfiles'
import { buildProblemLaunchMetadata } from '../launchMetadata'
import { getSwarmRecipe } from '../swarmRecipes'
import { diyMoviePreset } from './diyMovie'

describe('diyMoviePreset', () => {
  it('seeds one DIYMovie room with a staffed orbit of production agents', () => {
    const preset = diyMoviePreset()
    const problemCards = preset.cards.filter((card) => card.kind === 'problem')
    const agentCards = preset.cards.filter((card) => card.kind === 'agent')

    expect(problemCards).toHaveLength(1)
    expect(agentCards).toHaveLength(6)
    expect(problemCards[0]?.title).toBe('DIYMovie Story Forge')
    expect(problemCards[0]?.briefLocked).toBe(true)
    expect(problemCards[0]?.briefVersion).toBe(1)
    expect(problemCards[0]?.briefSpec?.projectId).toBe('diy-movie')
  })

  it('pins the six room loci for the story-to-publish workflow', () => {
    const preset = diyMoviePreset()
    const room = preset.cards.find((card) => card.kind === 'problem')

    expect(room?.memoryPalaceLoci?.map((locus) => locus.title)).toEqual([
      'Idea Wall',
      'Script Table',
      'Shotlist Rail',
      'Capture Bay',
      'Edit Desk',
      'Publish Gate',
    ])
  })

  it('references valid capability profiles and swarm recipes', () => {
    const preset = diyMoviePreset()
    const room = preset.cards.find((card) => card.kind === 'problem')

    expect(room).toBeDefined()
    expect(getCapabilityProfile(room?.capabilityProfileId ?? '')).toBeDefined()
    expect(getSwarmRecipe(room?.swarmRecipeId ?? '')).toBeDefined()
  })

  it('seeds a completed approval-pass run that is still waiting on artifact acceptance', () => {
    const preset = diyMoviePreset()
    const room = preset.cards.find((card) => card.kind === 'problem')
    const run = room?.runLedger?.[0]
    const briefPacket = room ? compileBriefPacket(room, room.id) : null

    expect(run?.title).toBe('DIYMovie publish packet pass')
    expect(run?.continuationDecision).toBe('complete')
    expect(run?.selfEvaluation?.allCriteriaMet).toBe(true)
    expect(run?.selfEvaluation?.criteriaCovered).toEqual([
      'diymovie-story-to-script',
      'diymovie-production-handoff',
      'diymovie-publish-gate',
    ])
    expect(run?.briefVersion).toBe(briefPacket?.briefVersion)
    expect(run?.briefHash).toBe(briefPacket?.briefHash)
    expect(run?.artifacts.map((artifact) => artifact.title)).toEqual([
      'DIYMovie room publish packet report',
      'Master shot list',
      'Edit decision list',
      'Publish approval packet',
    ])
  })

  it('derives launch metadata with explicit social publish approval hooks', () => {
    const preset = diyMoviePreset()
    const room = preset.cards.find((card) => card.kind === 'problem')
    const metadata = room ? buildProblemLaunchMetadata(room) : null

    expect(metadata?.roomKind).toBe('diy_movie')
    expect(metadata?.approvalHooks.approvalRequired).toBe(true)
    expect(metadata?.approvalHooks.configured).toBe(true)
    expect(metadata?.approvalHooks.publishCheckpoint).toBe('Publish Gate')
    expect(metadata?.approvalHooks.socialTargets).toEqual([
      'instagram-reels',
      'tiktok',
      'youtube-shorts',
    ])
  })
})
