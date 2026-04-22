import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { CapabilityProfilePicker } from './CapabilityProfilePicker'

describe('CapabilityProfilePicker', () => {
  it('renders the selected profile and emits changes', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    render(
      <CapabilityProfilePicker
        value="build-local"
        options={[
          { value: 'research-standard', label: 'Research', detail: 'Read-only research.' },
          { value: 'build-local', label: 'Build', detail: 'Local write access.' },
        ]}
        onChange={onChange}
      />,
    )

    expect(screen.getByText('Local write access.')).toBeInTheDocument()
    expect(screen.getByRole('combobox')).toHaveValue('build-local')
    await user.selectOptions(screen.getByRole('combobox'), 'research-standard')
    expect(onChange).toHaveBeenCalledWith('research-standard')
  })

  it('keeps an explicit empty option when no profile is selected', () => {
    render(
      <CapabilityProfilePicker
        value=""
        options={[{ value: 'build-local', label: 'Build', detail: 'Local write access.' }]}
        onChange={() => {}}
        emptyLabel="Use Butler defaults"
      />,
    )

    expect(screen.getByRole('combobox')).toHaveValue('')
    expect(screen.getByRole('option', { name: 'Use Butler defaults' })).toBeInTheDocument()
  })
})
