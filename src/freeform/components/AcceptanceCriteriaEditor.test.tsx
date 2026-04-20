import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AcceptanceCriteriaEditor, type BriefEditorValue } from './AcceptanceCriteriaEditor'

function value(overrides: Partial<BriefEditorValue> = {}): BriefEditorValue {
  return {
    creative: {
      mission: 'Help Stephanie stay oriented.',
      beneficiary: 'Stephanie',
      audience: 'Phone-first operator',
      tone: 'Direct and calm',
      references: '99designs brief intake',
      ...overrides.creative,
    },
    execution: {
      task: 'Build a contact module.',
      deliverables: 'Contacts list, notes, search.',
      scopeIn: 'Contacts, notes, search',
      scopeOut: 'Bulk import',
      milestones: 'M1: skeleton',
      dependencies: 'CRM auth',
      criteria: [],
      ...overrides.execution,
    },
  }
}

describe('AcceptanceCriteriaEditor', () => {
  it('renders the brief panels and supports criterion editing', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    render(<AcceptanceCriteriaEditor value={value()} onChange={onChange} />)

    expect(screen.getByRole('heading', { name: 'Brief editor' })).toBeInTheDocument()
    expect(screen.getByText(/No criteria yet/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Add criterion' }))
    expect(onChange).toHaveBeenCalled()

    onChange.mockClear()

    render(
      <AcceptanceCriteriaEditor
        value={value({
          execution: {
            task: 'Build a contact module.',
            deliverables: 'Contacts list, notes, search.',
            scopeIn: 'Contacts, notes, search',
            scopeOut: 'Bulk import',
            milestones: 'M1: skeleton',
            dependencies: 'CRM auth',
            criteria: [{ id: 'criterion-1', description: '', verificationHint: '' }],
          },
        })}
        onChange={onChange}
      />,
    )

    await user.type(screen.getByPlaceholderText('What must be true for this to count as done?'), 'Search works')
    expect(onChange).toHaveBeenCalled()
  })
})
