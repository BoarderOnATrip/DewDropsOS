import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { WorkerTerminalPanel } from './WorkerTerminalPanel'
import type { WorkflowCard } from '../types'

function agent(overrides: Partial<WorkflowCard> = {}): WorkflowCard {
  return {
    id: 'agent-1',
    title: 'Worker 1',
    x: 0,
    y: 0,
    width: 160,
    height: 96,
    expanded: true,
    color: '#0af',
    kind: 'agent',
    assignedToProblemId: 'problem-1',
    agentRuntime: {
      kind: 'terminal',
      profile: 'openclaw',
      transport: 'cli',
      instanceLabel: 'worker-1',
      command: 'openclaw',
      workspaceRoot: '/tmp/project',
      sessionState: {
        status: 'running',
        sessionId: 'session-1',
        pid: '1234',
        startedAt: '2026-04-19T10:00:00.000Z',
        lastHeartbeatAt: '2026-04-19T10:00:05.000Z',
        currentTask: 'openclaw',
        logTail: ['[stdout] ready'],
      },
    },
    ...overrides,
  }
}

describe('WorkerTerminalPanel', () => {
  it('renders runtime controls and forwards edits and actions', async () => {
    const user = userEvent.setup()
    const onTitleChange = vi.fn()
    const onRuntimeChange = vi.fn()
    const onStart = vi.fn()
    const onStop = vi.fn()
    const onRefresh = vi.fn()
    const onSendInput = vi.fn()

    function Harness() {
      const [currentAgent, setCurrentAgent] = useState(agent())
      return (
        <WorkerTerminalPanel
          agents={[currentAgent]}
          onTitleChange={(agentId, title) => {
            onTitleChange(agentId, title)
            setCurrentAgent((prev) => ({
              ...prev,
              title,
            }))
          }}
          onRuntimeChange={(agentId, patch) => {
            onRuntimeChange(agentId, patch)
            setCurrentAgent((prev) => ({
              ...prev,
              agentRuntime: prev.agentRuntime
                ? {
                    ...prev.agentRuntime,
                    ...patch,
                  }
                : undefined,
            }))
          }}
          onStart={onStart}
          onStop={onStop}
          onRefresh={onRefresh}
          onSendInput={onSendInput}
        />
      )
    }

    render(<Harness />)

    expect(screen.getByText('Worker 1')).toBeInTheDocument()
    expect(screen.getByLabelText('Terminal label')).toHaveValue('Worker 1')
    expect(screen.getByLabelText('Shell')).toHaveValue('openclaw')
    expect(screen.getByLabelText('Root')).toHaveValue('/tmp/project')
    expect(screen.getByText('[stdout] ready')).toBeInTheDocument()

    await user.clear(screen.getByLabelText('Terminal label'))
    await user.type(screen.getByLabelText('Terminal label'), 'Builder 7')
    expect(onTitleChange).toHaveBeenLastCalledWith('agent-1', 'Builder 7')
    expect(screen.getByLabelText('Terminal label')).toHaveValue('Builder 7')

    await user.clear(screen.getByLabelText('Shell'))
    await user.type(screen.getByLabelText('Shell'), 'codex')
    expect(onRuntimeChange).toHaveBeenLastCalledWith('agent-1', expect.objectContaining({ command: 'codex' }))
    expect(screen.getByLabelText('Shell')).toHaveValue('codex')

    await user.type(screen.getByLabelText('Live input'), 'npm test')
    await user.click(screen.getByRole('button', { name: 'Send' }))
    expect(onSendInput).toHaveBeenCalledWith('agent-1', 'npm test\n')

    await user.click(screen.getByRole('button', { name: 'Restart' }))
    await user.click(screen.getByRole('button', { name: 'Stop' }))
    await user.click(screen.getByRole('button', { name: 'Refresh' }))

    expect(onStart).toHaveBeenCalledWith('agent-1')
    expect(onStop).toHaveBeenCalledWith('agent-1')
    expect(onRefresh).toHaveBeenCalledWith('agent-1')
  })
})
