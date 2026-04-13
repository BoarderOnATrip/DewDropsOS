import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { OpenQuestionsBlock } from './OpenQuestionsBlock'

describe('OpenQuestionsBlock', () => {
  it('renders nothing when there are no items', () => {
    const { container } = render(<OpenQuestionsBlock items={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders a status region and list entries', () => {
    render(<OpenQuestionsBlock items={['First?', 'Second?']} />)
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByText('First?')).toBeInTheDocument()
    expect(screen.getByText('Second?')).toBeInTheDocument()
    expect(screen.getByText(/Open questions — check and steer/)).toBeInTheDocument()
  })
})
