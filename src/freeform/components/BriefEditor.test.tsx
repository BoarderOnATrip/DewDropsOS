import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { BriefSpec } from '../briefSpec'
import { BriefEditor } from './BriefEditor'

function briefSpec(): BriefSpec {
  return {
    id: 'brief-1',
    creative: {
      mission: 'Build a focused CRM surface.',
      beneficiary: 'Stephanie',
      audience: 'Real estate operator',
      tone: 'clear and direct',
      references: [
        {
          label: 'Good example',
          ref: 'docs/good',
          note: 'Short and concrete.',
          polarity: 'good',
        },
      ],
    },
    execution: {
      task: 'Implement the contact room.',
      projectStructure: ['src/app/', 'src/app/contact/page.tsx'],
      deliverables: ['Contact list UI'],
      scope: {
        in: ['Search', 'Notes'],
        out: ['Team sharing'],
      },
      acceptanceCriteria: [
        {
          id: 'criteria-1',
          description: 'Search returns results quickly.',
          verificationHint: 'Run the search test.',
        },
      ],
      antiPatterns: ['Don’t require a keyboard.'],
      milestone: 'M1',
      dependsOn: ['auth'],
      blockedBy: ['design-signoff'],
    },
    escalationPolicy: 'outcome-contradiction-only',
    autonomyPolicy: 'full-auto',
  }
}

describe('BriefEditor', () => {
  it('renders the creative and execution panels', () => {
    render(<BriefEditor value={briefSpec()} onChange={vi.fn()} />)

    expect(screen.getByText('Creative brief')).toBeInTheDocument()
    expect(screen.getByText('Execution brief')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Build a focused CRM surface.')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Implement the contact room.')).toBeInTheDocument()
    expect(screen.getByText('References')).toBeInTheDocument()
    expect(screen.getByText('Project structure')).toBeInTheDocument()
    expect(screen.getByText('Acceptance criteria')).toBeInTheDocument()
  })

  it('emits updated brief values from core fields', async () => {
    const user = userEvent.setup()
    const value = briefSpec()
    const onChange = vi.fn()

    render(<BriefEditor value={value} onChange={onChange} />)

    fireEvent.change(screen.getByRole('textbox', { name: 'Mission' }), {
      target: { value: 'Build a focused CRM surface with notes.' },
    })
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        creative: expect.objectContaining({ mission: 'Build a focused CRM surface with notes.' }),
      }),
    )

    fireEvent.change(screen.getByRole('textbox', { name: 'Task' }), {
      target: { value: 'Implement the contact room and search.' },
    })
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        execution: expect.objectContaining({ task: 'Implement the contact room and search.' }),
      }),
    )

    await user.click(screen.getAllByRole('button', { name: 'Add' })[0]!)
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        creative: expect.objectContaining({
          references: expect.arrayContaining([
            expect.objectContaining({
              label: 'reference-2',
              polarity: 'good',
            }),
          ]),
        }),
      }),
    )
  })
})
