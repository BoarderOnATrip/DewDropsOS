import { describe, expect, it } from 'vitest'
import {
  buildBriefCompartmentOptions,
  collectProblemAnchorRefs,
  createBriefCompartmentAsset,
  createBriefCompartmentAssetFromRunArtifact,
} from './briefCompartments'
import type { WorkflowCard } from './types'

function problem(overrides: Partial<WorkflowCard> = {}): WorkflowCard {
  return {
    id: 'room-1',
    title: 'DIYMovie Story Forge',
    expanded: true,
    color: '#fff',
    kind: 'problem',
    x: 0,
    y: 0,
    width: 320,
    height: 220,
    briefSpec: {
      id: 'brief-1',
      creative: {
        mission: 'Turn story ideas into publishable short-form videos.',
        beneficiary: 'A solo creator who needs fast execution.',
        references: [],
      },
      execution: {
        task: 'Organize raw material and execute the next content cut.',
        acceptanceCriteria: [
          {
            id: 'ac-1',
            description: 'Source material is mapped into the right room compartment.',
          },
        ],
        scope: {
          in: ['Script', 'Shotlist', 'Capture', 'Edit', 'Publish'],
          out: ['Unreviewed posting'],
        },
        antiPatterns: ['Losing track of source material'],
        deliverables: ['Publish-ready cut'],
      },
      escalationPolicy: 'outcome-contradiction-only',
      autonomyPolicy: 'milestone-checkpoint',
      projectId: 'diy-movie',
    },
    memoryPalaceLoci: [
      {
        id: 'idea-wall',
        title: 'Idea Wall',
        kind: 'north_star',
        detail: 'Mission, hooks, and audience intent live here.',
      },
      {
        id: 'script-table',
        title: 'Script Table',
        kind: 'artifact',
        detail: 'Draft scripts, captions, and hook variants.',
      },
      {
        id: 'publish-gate',
        title: 'Publish Gate',
        kind: 'checkpoint',
        detail: 'Final review before a reel or short ships.',
      },
    ],
    ...overrides,
  }
}

describe('briefCompartments', () => {
  it('derives compartment options from the room loci before falling back to system compartments', () => {
    const options = buildBriefCompartmentOptions(problem())

    expect(options.map((option) => option.label)).toEqual(
      expect.arrayContaining(['Idea Wall', 'Script Table', 'Publish Gate', 'Source Compartment']),
    )
  })

  it('sorts a script-like file into the room script locus', () => {
    const asset = createBriefCompartmentAsset(
      problem(),
      {
        name: 'episode-script-v2.md',
        type: 'text/markdown',
        size: 2048,
      },
      {
        assetId: 'compartment-1',
        addedAt: '2026-04-19T12:00:00.000Z',
      },
    )

    expect(asset.compartmentLabel).toBe('Script Table')
    expect(asset.compartmentKind).toBe('script')
    expect(asset.anchorRef).toBe('compartment/script-table')
    expect(asset.organizeStatus).toBe('sorted')
    expect(asset.organizeReason).toContain('Sorted into Script Table')
  })

  it('folds indexed compartment assets back into the room anchor set', () => {
    const anchors = collectProblemAnchorRefs(
      problem({
        memoryAnchors: ['room/story-forge'],
        briefCompartmentAssets: [
          {
            id: 'compartment-social-1',
            name: 'instagram-reel-caption.md',
            mimeType: 'text/markdown',
            sizeBytes: 1024,
            addedAt: '2026-04-19T12:00:00.000Z',
            compartmentId: 'system:social',
            compartmentLabel: 'Social Queue',
            compartmentKind: 'social',
            anchorRef: 'compartment/social-queue',
            extension: 'md',
            organizeStatus: 'sorted',
          },
        ],
      }),
    )

    expect(anchors).toEqual(
      expect.arrayContaining([
        'room/story-forge',
        'compartment/social-queue',
        'artifact/instagram-reel-caption-md',
        'social/instagram-reels',
      ]),
    )
  })

  it('mirrors accepted run artifacts into stable briefcase assets', () => {
    const asset = createBriefCompartmentAssetFromRunArtifact(
      problem(),
      {
        id: 'playwright-shot',
        runId: 'dewdrop-session-1',
        kind: 'image',
        title: 'Screenshot accepted.png',
        summary: 'Accepted screenshot.',
        path: '.dewdrops-artifacts/agent-1/test-results/accepted.png',
        mimeType: 'image/png',
        sizeBytes: 256,
        createdAt: '2026-04-19T12:00:00.000Z',
        status: 'accepted',
      },
      {
        runId: 'dewdrop-session-1',
        assetId: 'compartment-mirror-1',
      },
    )

    expect(asset.id).toBe('compartment-mirror-1')
    expect(asset.name).toBe('accepted.png')
    expect(asset.compartmentKind).toBe('publish')
    expect(asset.organizeStatus).toBe('sorted')
    expect(asset.sourceRunId).toBe('dewdrop-session-1')
    expect(asset.sourceArtifactId).toBe('playwright-shot')
    expect(asset.sourcePath).toBe('.dewdrops-artifacts/agent-1/test-results/accepted.png')
  })
})
