import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SwarmRecipePicker } from './SwarmRecipePicker'

describe('SwarmRecipePicker', () => {
  it('renders the selected recipe and emits changes', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    render(
      <SwarmRecipePicker
        value="build-review-ship"
        options={[
          { value: 'research-sweep', label: 'Research sweep', detail: 'Research and synthesize.' },
          { value: 'build-review-ship', label: 'Build → review → ship', detail: 'Build and verify.' },
        ]}
        onChange={onChange}
      />,
    )

    expect(screen.getByText('Build and verify.')).toBeInTheDocument()
    expect(screen.getByRole('combobox')).toHaveValue('build-review-ship')
    await user.selectOptions(screen.getByRole('combobox'), 'research-sweep')
    expect(onChange).toHaveBeenCalledWith('research-sweep')
  })

  it('keeps an explicit empty option when no recipe is selected', () => {
    render(
      <SwarmRecipePicker
        value=""
        options={[{ value: 'build-review-ship', label: 'Build', detail: 'Builder, reviewer, shipper.' }]}
        onChange={() => {}}
        emptyLabel="Compose from assigned agents"
      />,
    )

    expect(screen.getByRole('combobox')).toHaveValue('')
    expect(screen.getByRole('option', { name: 'Compose from assigned agents' })).toBeInTheDocument()
  })
})
