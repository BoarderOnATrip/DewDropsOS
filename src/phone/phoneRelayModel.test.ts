import { describe, expect, it } from 'vitest'
import type { ButlerSwarmRun } from '../lib/butlerBridge'
import type { WorkflowCard } from '../freeform/types'
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
          memoryAnchors: ['drawer/phone'],
          memoryPalaceLoci: [
            {
              id: 'north-star',
              title: 'North Star',
              kind: 'north_star',
              detail: 'Keep the relay mission visible.',
            },
          ],
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
    expect(view.selectedProblem?.packetText).toContain('phone_brief: Relay urgent review items.')
    expect(view.selectedProblem?.memoryPalaceLoci[0]?.title).toBe('North Star')
    expect(view.selectedProblem?.packetText).toContain('latest_run: Latest pass (running)')
    expect(view.activeRunCount).toBe(1)
  })
})
