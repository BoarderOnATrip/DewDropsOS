import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { RunLedgerPanel } from './RunLedgerPanel'

describe('RunLedgerPanel', () => {
  it('renders run entries, artifacts, and selection events', async () => {
    const user = userEvent.setup()
    const onSelectRun = vi.fn()
    const onArtifactStatusChange = vi.fn()

    render(
      <RunLedgerPanel
        entries={[
          {
            runId: 'run-1',
            contractId: 'contract-1',
            roomId: 'room-1',
            title: 'Launch room',
            status: 'done',
            capabilityProfileId: 'build-local',
            swarmRecipeId: 'build-review-ship',
            startedAt: '2026-04-18T10:00:00.000Z',
            completedAt: '2026-04-18T10:15:00.000Z',
            artifacts: [
              {
                id: 'artifact-1',
                runId: 'run-1',
                kind: 'report',
                title: 'Launch report',
                summary: 'Completed successfully.',
                createdAt: '2026-04-18T10:15:00.000Z',
              },
            ],
          },
        ]}
        currentRunId="run-1"
        onSelectRun={onSelectRun}
        onArtifactStatusChange={onArtifactStatusChange}
      />,
    )

    expect(screen.getByText('Launch room')).toBeInTheDocument()
    expect(screen.getByText('build-local')).toBeInTheDocument()
    expect(screen.getByText('report: Launch report')).toBeInTheDocument()
    expect(screen.getByText('provisional')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Launch room/ }))
    expect(onSelectRun).toHaveBeenCalledWith('run-1')
    await user.selectOptions(screen.getByRole('combobox', { name: /Artifact review/i }), 'accepted')
    expect(onArtifactStatusChange).toHaveBeenCalledWith('run-1', 'artifact-1', 'accepted')
  })
})
