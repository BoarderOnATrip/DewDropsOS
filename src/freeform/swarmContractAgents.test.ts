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

  it('maps three marbles to framer, builder, reviewer with DewDrops metadata', () => {
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

    expect(result.map((agent) => agent.role)).toEqual(['framer', 'builder', 'reviewer'])
    expect(result[1]?.depends_on).toEqual(['agent-a'])
    expect(result[2]?.depends_on).toEqual(['agent-b'])
    expect(result[0]?.metadata?.dewdrops_card_id).toBe('agent-a')
    expect(result[2]?.metadata?.dewdrops_card_title).toBe('Gamma')
  })

  it('keeps builders parallel behind the framer when more than three marbles exist', () => {
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

    expect(result.map((agent) => agent.role)).toEqual(['framer', 'builder', 'builder', 'reviewer'])
    expect(result[1]?.depends_on).toEqual(['agent-a'])
    expect(result[2]?.depends_on).toEqual(['agent-a'])
    expect(result[3]?.depends_on).toEqual(['agent-b', 'agent-c'])
  })
})
