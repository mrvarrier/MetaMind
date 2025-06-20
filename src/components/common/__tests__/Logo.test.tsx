import { describe, it, expect } from 'vitest'
import { render, screen } from '../../../test/utils'
import { Logo } from '../Logo'

describe('Logo Component', () => {
  it('renders with default props', () => {
    render(<Logo />)
    
    // Check for brain icon
    const brainIcon = screen.getByTestId('brain-icon')
    expect(brainIcon).toBeInTheDocument()
    
    // Check for text
    const logoText = screen.getByText('MetaMind')
    expect(logoText).toBeInTheDocument()
  })

  it('renders icon only variant', () => {
    render(<Logo variant="icon" />)
    
    const brainIcon = screen.getByTestId('brain-icon')
    expect(brainIcon).toBeInTheDocument()
    
    // Text should not be present
    const logoText = screen.queryByText('MetaMind')
    expect(logoText).not.toBeInTheDocument()
  })

  it('renders text only variant', () => {
    render(<Logo variant="text" />)
    
    const logoText = screen.getByText('MetaMind')
    expect(logoText).toBeInTheDocument()
    
    // Icon should not be present
    const brainIcon = screen.queryByTestId('brain-icon')
    expect(brainIcon).not.toBeInTheDocument()
  })

  it('renders full variant (default)', () => {
    render(<Logo variant="full" />)
    
    const brainIcon = screen.getByTestId('brain-icon')
    expect(brainIcon).toBeInTheDocument()
    
    const logoText = screen.getByText('MetaMind')
    expect(logoText).toBeInTheDocument()
  })

  it('renders with different sizes', () => {
    const { rerender } = render(<Logo size="sm" />)
    let brainIcon = screen.getByTestId('brain-icon')
    expect(brainIcon.parentElement).toHaveClass('h-5', 'w-5')
    
    rerender(<Logo size="md" />)
    brainIcon = screen.getByTestId('brain-icon')
    expect(brainIcon.parentElement).toHaveClass('h-6', 'w-6')
    
    rerender(<Logo size="lg" />)
    brainIcon = screen.getByTestId('brain-icon')
    expect(brainIcon.parentElement).toHaveClass('h-8', 'w-8')
    
    rerender(<Logo size="xl" />)
    brainIcon = screen.getByTestId('brain-icon')
    expect(brainIcon.parentElement).toHaveClass('h-10', 'w-10')
  })

  it('applies custom className', () => {
    render(<Logo className="custom-logo-class" />)
    
    const logoContainer = screen.getByTestId('brain-icon').closest('div')
    expect(logoContainer).toHaveClass('custom-logo-class')
  })

  it('has proper text sizing for different logo sizes', () => {
    const { rerender } = render(<Logo size="sm" />)
    let logoText = screen.getByText('MetaMind')
    expect(logoText).toHaveClass('text-sm')
    
    rerender(<Logo size="md" />)
    logoText = screen.getByText('MetaMind')
    expect(logoText).toHaveClass('text-base')
    
    rerender(<Logo size="lg" />)
    logoText = screen.getByText('MetaMind')
    expect(logoText).toHaveClass('text-lg')
    
    rerender(<Logo size="xl" />)
    logoText = screen.getByText('MetaMind')
    expect(logoText).toHaveClass('text-xl')
  })

  it('maintains proper spacing between icon and text', () => {
    render(<Logo />)
    
    const logoContainer = screen.getByTestId('brain-icon').closest('div')
    expect(logoContainer).toHaveClass('space-x-2')
  })

  it('has proper styling for brand colors', () => {
    render(<Logo />)
    
    const brainIcon = screen.getByTestId('brain-icon')
    expect(brainIcon).toHaveClass('text-primary-500')
    
    const logoText = screen.getByText('MetaMind')
    expect(logoText).toHaveClass('text-gray-900', 'dark:text-white')
  })

  it('renders as a clickable element when wrapped', () => {
    render(
      <button>
        <Logo />
      </button>
    )
    
    const button = screen.getByRole('button')
    expect(button).toBeInTheDocument()
    
    const brainIcon = screen.getByTestId('brain-icon')
    const logoText = screen.getByText('MetaMind')
    expect(button).toContainElement(brainIcon)
    expect(button).toContainElement(logoText)
  })

  it('supports accessibility attributes when used as a link', () => {
    render(
      <a href="/" aria-label="MetaMind Home">
        <Logo />
      </a>
    )
    
    const link = screen.getByRole('link', { name: /metamind home/i })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', '/')
  })

  it('renders with proper semantic structure', () => {
    render(<Logo />)
    
    // The logo should be in a div container
    const logoContainer = screen.getByTestId('brain-icon').closest('div')
    expect(logoContainer).toHaveClass('flex', 'items-center')
    
    // Text should be in a span
    const logoText = screen.getByText('MetaMind')
    expect(logoText.tagName).toBe('SPAN')
  })
})