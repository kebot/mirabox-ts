import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

// Mock the WebSocket-backed hook
vi.mock('@/hooks/useStreamDock', () => ({
  useStreamDock: () => ({
    status: 'disconnected',
    devices: {},
    events: [],
    clearEvents: vi.fn(),
  }),
}))

// Mock Konva (canvas) to avoid jsdom canvas limitations
vi.mock('react-konva', () => ({
  Stage: ({ children }: { children: React.ReactNode }) => <div data-testid="konva-stage">{children}</div>,
  Layer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Rect: () => null,
  Text: () => null,
  Image: () => null,
  Group: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

import App from '../App'

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the header title', () => {
    render(<App />)
    expect(screen.getByText('StreamDock Demo')).toBeInTheDocument()
  })

  it('shows disconnected status when not connected', () => {
    render(<App />)
    expect(screen.getByText('Disconnected')).toBeInTheDocument()
  })

  it('shows empty device list message', () => {
    render(<App />)
    expect(screen.getByText(/no devices/i)).toBeInTheDocument()
  })
})
