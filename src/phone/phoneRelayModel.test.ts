import { describe, expect, it } from 'vitest'
import type { ButlerSwarmRun } from '../lib/butlerBridge'
import { diyMoviePreset } from '../freeform/presets/diyMovie'
import type { WorkflowCard } from '../freeform/types'
import { stephanieCrmPreset } from '../freeform/presets/stephanieCrm'
import { buildPhoneRelayWorkspaceView, collectPhoneRelayProblems } from './phoneRelayModel'

function problem(overrides: Partial<WorkflowCard> = {}): WorkflowCard {
  return {
    id: 'p1',
    title: 'Phone Relay MVP',
    expanded: true,
    color: '#fff',
    kind: 'problem',
    x: 0,
    y: 0,
    width: 280,
    height: 180,
    butlerRoomId: 'room-1',
    ...overrides,
  }
}

function run(overrides: Partial<ButlerSwarmRun> = {}): ButlerSwarmRun {
  return {
    id: 'run-1',
    run_id: 'run-1',
    contract_id: 'contract-1',
    room_id: 'room-1',
    title: 'Latest pass',
    status: 'running',
    updated_at: '2026-04-15T12:30:00Z',
    ...overrides,
  }
}

describe('phoneRelayModel', () => {
  it('collects problem cards from a mixed workspace snapshot', () => {
    const problems = collectPhoneRelayProblems({
      cards: [
        problem(),
        {
          id: 'a1',
          title: 'Agent',
          expanded: true,
          color: '#0f0',
          kind: 'agent',
          x: 0,
          y: 0,
          width: 120,
          height: 44,
        },
      ],
    })

    expect(problems).toHaveLength(1)
    expect(problems[0]?.title).toBe('Phone Relay MVP')
  })

  it('builds a phone-ready view model with readiness and latest run context', () => {
    const view = buildPhoneRelayWorkspaceView({
      workspaceName: 'DewDrops',
      workspaceSubtitle: 'Phone relay workspace snapshot',
      workspaceMode: 'phone',
      bridgeHealth: { ok: true },
      cards: [
        problem({
          preferredLaunchSurface: 'phone',
          phoneRelayBrief: 'Relay urgent review items.',
          memoryWing: 'relay-wing',
          memoryRoom: 'screening-bay',
          memoryContextSummary: 'Compact relay context.',
          memoryAnchors: ['compartment/phone'],
          memoryPalaceLoci: [
            {
              id: 'north-star',
              title: 'North Star',
              kind: 'north_star',
              detail: 'Keep the relay mission visible.',
            },
          ],
          capabilityProfileId: 'research-standard',
          swarmRecipeId: 'operator-relay',
        }),
        {
          id: 'a1',
          title: 'Relay agent',
          expanded: true,
          color: '#0f0',
          kind: 'agent',
          x: 0,
          y: 0,
          width: 120,
          height: 44,
          assignedToProblemId: 'p1',
          parentAgentId: null,
        },
      ],
      runs: [run()],
      latestRun: run(),
    })

    expect(view.problemCount).toBe(1)
    expect(view.selectedProblem?.problem.id).toBe('p1')
    expect(view.selectedProblem?.readiness.tone).toBe('ready')
    expect(view.selectedProblem?.roomLabel).toBe('relay-wing/screening-bay')
    expect(view.selectedProblem?.projectionLabel).toBe('Pocket projection')
    expect(view.selectedProblem?.packetText).toContain('pb:Relay urgent review items.')
    expect(view.selectedProblem?.memoryPalaceLoci[0]?.title).toBe('North Star')
    expect(view.selectedProblem?.packetText).toContain('latest_run: Latest pass (running)')
    expect(view.activeRunCount).toBe(1)
  })

  it('builds a decision inbox from the latest run ledger entry', () => {
    const view = buildPhoneRelayWorkspaceView({
      workspaceMode: 'phone',
      cards: [
        problem({
          phoneRelayBrief: 'Escalate only real contradictions.',
          runLedger: [
            {
              runId: 'run-2',
              contractId: 'contract-2',
              roomId: 'room-1',
              title: 'Acceptance pass',
              status: 'complete',
              startedAt: '2026-04-16T12:00:00Z',
              completedAt: '2026-04-16T12:10:00Z',
              continuationDecision: 'complete',
              artifacts: [
                {
                  id: 'artifact-1',
                  runId: 'run-2',
                  kind: 'plan',
                  title: 'CRM schema',
                  summary: 'Draft schema ready for review.',
                  createdAt: '2026-04-16T12:09:00Z',
                },
              ],
              selfEvaluation: {
                alignmentSummary: 'Defined the CRM schema and mapped it to the brief.',
                criteriaChecks: [],
                allCriteriaMet: true,
                criteriaCovered: ['ac-1'],
                criteriaRemaining: [],
                nextAction: null,
                escalationReason: null,
                assumptions: ['SQLite is sufficient for the first offline slice.'],
                handoffNotes: 'dec:Keep SQLite for the offline MVP\nwhy:It minimizes setup and preserves local-first behavior\nwatch:Revisit when sync arrives',
              },
            },
          ],
        }),
      ],
    })

    expect(view.selectedProblem?.decisionInbox?.label).toBe('Awaiting acceptance')
    expect(view.selectedProblem?.decisionInbox?.pendingArtifactCount).toBe(1)
    expect(view.selectedProblem?.decisionInbox?.reasoning?.dec).toContain('Keep SQLite')
    expect(view.selectedProblem?.decisionInbox?.reasoning?.why).toContain('local-first')
  })

  it('projects the seeded Stephanie CRM Contacts pass into the phone relay inbox', () => {
    const preset = stephanieCrmPreset()
    const view = buildPhoneRelayWorkspaceView({
      workspaceName: 'Stephanie CRM',
      workspaceMode: 'phone',
      cards: preset.cards,
      selectedProblemId: 'stephanie-crm-contacts',
    })

    expect(view.selectedProblem?.problem.id).toBe('stephanie-crm-contacts')
    expect(view.selectedProblem?.decisionInbox?.label).toBe('Awaiting acceptance')
    expect(view.selectedProblem?.decisionInbox?.pendingArtifactCount).toBe(4)
    expect(view.selectedProblem?.decisionInbox?.pendingArtifactLabels).toEqual(
      expect.arrayContaining([
        'note: Contact schema',
        'note: Relationship map',
        'note: Field dictionary',
      ]),
    )
    expect(view.selectedProblem?.packetText).toContain('artifact/stephanie-crm/contact-schema')
    expect(view.selectedProblem?.packetText).toContain('pb:Capture contact updates, note relationship changes, and generate a Mira-backed aiButler phone brief')
  })

  it('projects the DIYMovie preset into a review-gated phone relay packet', () => {
    const preset = diyMoviePreset()
    const cards = preset.cards.map((card, index) =>
      card.kind === 'agent' && index < 3
        ? {
            ...card,
            assignedToProblemId: 'diy-movie-room',
          }
        : card,
    )
    const view = buildPhoneRelayWorkspaceView({
      workspaceName: 'DIYMovie workspace',
      workspaceMode: 'phone',
      bridgeHealth: { ok: true },
      cards,
      selectedProblemId: 'diy-movie-room',
    })

    expect(view.selectedProblem?.problem.id).toBe('diy-movie-room')
    expect(view.selectedProblem?.readiness.tone).toBe('attention')
    expect(view.selectedProblem?.decisionInbox?.label).toBe('Awaiting acceptance')
    expect(view.selectedProblem?.decisionInbox?.pendingArtifactCount).toBe(4)
    expect(view.selectedProblem?.decisionInbox?.pendingArtifactLabels).toEqual(
      expect.arrayContaining([
        'plan: Publish approval packet',
        'plan: Master shot list',
      ]),
    )
    expect(view.selectedProblem?.packetText).toContain('social/tiktok')
    expect(view.selectedProblem?.packetText).toContain('l6:checkpoint | Publish Gate | Final review for captions, thumbnails, release packet, and channel approvals.')
  })
})
