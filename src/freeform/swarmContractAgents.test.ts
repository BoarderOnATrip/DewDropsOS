import { describe, expect, it } from 'vitest'
import { buildSwarmContractAgents } from './swarmContractAgents'
import type { WorkflowCard } from './types'

function problemCard(): WorkflowCard {
  return {
    id: 'problem-1',
    x: 0,
    y: 0,
    width: 280,
    height: 180,
    title: 'Main Problem',
    expanded: true,
    color: '#fff',
    kind: 'problem',
  }
}

function agentCard(id: string, title: string, x: number, y: number): WorkflowCard {
  return {
    id,
    x,
    y,
    width: 160,
    height: 96,
    title,
    expanded: true,
    color: '#0af',
    kind: 'agent',
    assignedToProblemId: 'problem-1',
  }
}

describe('buildSwarmContractAgents', () => {
  it('returns no explicit agents when there are no marble cards', () => {
    const result = buildSwarmContractAgents(problemCard(), [], 'planning', 'Do the work')
    expect(result).toEqual([])
  })

  it('maps three marbles to on_duty, worker, review with DewDrops metadata', () => {
    const result = buildSwarmContractAgents(
      problemCard(),
      [
        agentCard('agent-a', 'Alpha', 0, 0),
        agentCard('agent-b', 'Beta', 100, 0),
        agentCard('agent-c', 'Gamma', 200, 0),
      ],
      'planning',
      'Ship the slice',
    )

    expect(result.map((agent) => agent.role)).toEqual(['on_duty', 'worker', 'review'])
    expect(result[1]?.depends_on).toEqual(['agent-a'])
    expect(result[2]?.depends_on).toEqual(['agent-b'])
    expect(result[0]?.metadata?.dewdrops_card_id).toBe('agent-a')
    expect(result[2]?.metadata?.dewdrops_card_title).toBe('Gamma')
    expect(result[0]?.metadata?.runtime_kind).toBe('terminal')
    expect(result[0]?.metadata?.runtime_profile).toBe('custom')
    expect(result[0]?.metadata?.runtime_transport).toBe('cli')
    expect(result[0]?.metadata?.session_policy_allow_network).toBe(false)
  })

  it('keeps workers parallel behind the on duty agent when more than three marbles exist', () => {
    const result = buildSwarmContractAgents(
      problemCard(),
      [
        agentCard('agent-a', 'Alpha', 0, 0),
        agentCard('agent-b', 'Beta', 100, 0),
        agentCard('agent-c', 'Gamma', 200, 0),
        agentCard('agent-d', 'Delta', 300, 0),
      ],
      'build',
      'Implement the thing',
    )

    expect(result.map((agent) => agent.role)).toEqual(['on_duty', 'worker', 'worker', 'review'])
    expect(result[1]?.depends_on).toEqual(['agent-a'])
    expect(result[2]?.depends_on).toEqual(['agent-a'])
    expect(result[3]?.depends_on).toEqual(['agent-b', 'agent-c'])
  })

  it('uses a lone worker when only one DewDrop is assigned', () => {
    const result = buildSwarmContractAgents(
      problemCard(),
      [agentCard('agent-a', 'Solo', 0, 0)],
      'build',
      'Implement the thing',
    )

    expect(result.map((agent) => agent.role)).toEqual(['worker'])
    expect(result[0]?.depends_on).toEqual([])
    expect(result[0]?.objective).toContain('Duty:')
    expect(result[0]?.objective).toContain('Session policy:')
  })
})
