import { describe, expect, it } from 'vitest'
import { buildProblemApprovalHooks, buildProblemLaunchMetadata, formatSocialTargetLabel } from './launchMetadata'
import type { WorkflowCard } from './types'

function problem(overrides: Partial<WorkflowCard> = {}): WorkflowCard {
  return {
    id: 'room-1',
    title: 'Room',
    expanded: true,
    color: '#fff',
    kind: 'problem',
    x: 0,
    y: 0,
    width: 320,
    height: 220,
    ...overrides,
  }
}

describe('launch metadata helpers', () => {
  it('derives publish approval hooks from social anchors and publish loci', () => {
    const card = problem({
      memoryAnchors: [
        'product/diymovie',
        'artifact/diymovie/publish-approval-packet',
        'social/instagram-reels',
        'social/tiktok',
        'social/youtube-shorts',
      ],
      memoryPalaceLoci: [
        {
          id: 'publish-gate',
          title: 'Publish Gate',
          kind: 'checkpoint',
          detail: 'Final review and approval before release.',
        },
      ],
      swarmRecipeId: 'build-review-ship',
      briefSpec: {
        id: 'brief-1',
        creative: {
          mission: 'Ship the movie room.',
          beneficiary: 'Creators need a clean production loop.',
          references: [],
        },
        execution: {
          task: 'Prepare a publish-ready room packet.',
          acceptanceCriteria: [
            {
              id: 'publish-approval',
              description: 'A human approval gate exists before publishing any social cutdown.',
            },
          ],
          scope: {
            in: ['Publish packet'],
            out: ['Autonomous posting without review'],
          },
          antiPatterns: ['Posting without approval'],
          deliverables: ['Publish approval packet'],
        },
        escalationPolicy: 'outcome-contradiction-only',
        autonomyPolicy: 'milestone-checkpoint',
        projectId: 'diy-movie',
      },
    })

    const hooks = buildProblemApprovalHooks(card)
    const launchMetadata = buildProblemLaunchMetadata(card)

    expect(hooks.roomArchetype).toBe('diy_movie')
    expect(hooks.approvalRequired).toBe(true)
    expect(hooks.approvalMode).toBe('human_review_before_publish')
    expect(hooks.configured).toBe(true)
    expect(hooks.publishCheckpoint).toBe('Publish Gate')
    expect(hooks.socialTargets).toEqual(['instagram-reels', 'tiktok', 'youtube-shorts'])
    expect(hooks.publishArtifacts).toEqual(['artifact/diymovie/publish-approval-packet'])

    expect(launchMetadata.roomKind).toBe('diy_movie')
    expect(launchMetadata.metadata).toEqual(
      expect.objectContaining({
        room_archetype: 'diy_movie',
        social_delivery: true,
        approval_required: true,
        approval_configured: true,
        approval_mode: 'human_review_before_publish',
        publish_checkpoint: 'Publish Gate',
        publish_targets: ['instagram-reels', 'tiktok', 'youtube-shorts'],
      }),
    )
  })

  it('falls back to a generic project launch when no publish hooks exist', () => {
    const card = problem({
      briefSpec: {
        id: 'brief-1',
        creative: {
          mission: 'Ship the room.',
          beneficiary: 'Operator',
          references: [],
        },
        execution: {
          task: 'Do the work.',
          acceptanceCriteria: [],
          scope: { in: [], out: [] },
          antiPatterns: [],
          deliverables: [],
        },
        escalationPolicy: 'outcome-contradiction-only',
        autonomyPolicy: 'full-auto',
      },
    })

    const hooks = buildProblemApprovalHooks(card)
    const launchMetadata = buildProblemLaunchMetadata(card)

    expect(hooks.approvalRequired).toBe(false)
    expect(hooks.configured).toBe(true)
    expect(launchMetadata.roomKind).toBe('project')
    expect(launchMetadata.metadata).toEqual({
      social_delivery: false,
      approval_required: false,
      approval_configured: true,
    })
  })

  it('detects social delivery targets from indexed room compartment assets', () => {
    const card = problem({
      briefCompartmentAssets: [
        {
          id: 'compartment-social-1',
          name: 'youtube-shorts-hook-sheet.md',
          mimeType: 'text/markdown',
          sizeBytes: 2048,
          addedAt: '2026-04-19T12:00:00.000Z',
          compartmentId: 'system:social',
          compartmentLabel: 'Social Queue',
          compartmentKind: 'social',
          anchorRef: 'compartment/social-queue',
          extension: 'md',
          organizeStatus: 'sorted',
        },
      ],
      briefSpec: {
        id: 'brief-1',
        creative: {
          mission: 'Package the cut for social.',
          beneficiary: 'Creator',
          references: [],
        },
        execution: {
          task: 'Prepare the approval packet.',
          acceptanceCriteria: [
            {
              id: 'approval-gate',
              description: 'A human review gate exists before publishing.',
            },
          ],
          scope: { in: ['Approval packet'], out: ['Autonomous posting'] },
          antiPatterns: ['Posting without review'],
          deliverables: ['Approval packet'],
        },
        escalationPolicy: 'outcome-contradiction-only',
        autonomyPolicy: 'milestone-checkpoint',
      },
      swarmRecipeId: 'build-review-ship',
    })

    const hooks = buildProblemApprovalHooks(card)
    expect(hooks.socialTargets).toEqual(['youtube-shorts'])
    expect(hooks.approvalRequired).toBe(true)
  })
})

describe('formatSocialTargetLabel', () => {
  it('formats well-known and generic social target tokens', () => {
    expect(formatSocialTargetLabel('instagram-reels')).toBe('Instagram Reels')
    expect(formatSocialTargetLabel('youtube-shorts')).toBe('YouTube Shorts')
    expect(formatSocialTargetLabel('festival-cut')).toBe('Festival Cut')
  })
})
