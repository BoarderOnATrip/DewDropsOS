import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { WorkflowCard } from '../types'
import { DewDropTerminalSurface } from './DewDropTerminalSurface'

function terminalCard(): WorkflowCard {
  return {
    id: 'agent-1',
    title: 'Terminal 1',
    x: 0,
    y: 0,
    width: 320,
    height: 240,
    expanded: true,
    color: '#af52de',
    kind: 'agent',
    assignedToProblemId: null,
    parentAgentId: null,
    agentRuntime: {
      kind: 'terminal',
      profile: 'custom',
      transport: 'cli',
      instanceLabel: 'terminal-1',
      command: 'zsh -i -f',
      workspaceRoot: '.',
      sessionState: {
        status: 'running',
        sessionId: 'session-1',
        terminalBuffer: 'prompt',
        outputVersion: 1,
        logTail: [],
      },
    },
  }
}

describe('DewDropTerminalSurface', () => {
  it('forwards keyboard input from the terminal surface itself', async () => {
    const onSendInput = vi.fn()
    render(
      <DewDropTerminalSurface
        agent={terminalCard()}
        onStart={vi.fn()}
        onStop={vi.fn()}
        onRefresh={vi.fn()}
        onSendInput={onSendInput}
      />,
    )

    const surface = screen.getByLabelText('Terminal 1 live terminal')
    const input = screen.getByLabelText('Terminal 1 terminal input')
    fireEvent.click(surface)
    fireEvent.keyDown(input, { key: 'p' })
    fireEvent.keyDown(input, { key: 'Enter' })
    fireEvent.keyDown(input, { key: 'ArrowUp' })
    fireEvent.paste(input, {
      clipboardData: {
        getData: (type: string) => (type === 'text' ? 'pwd' : ''),
      },
    })

    await waitFor(() => {
      expect(onSendInput).toHaveBeenCalledWith('agent-1', 'p\n\u001b[Apwd')
    })
  })
})
