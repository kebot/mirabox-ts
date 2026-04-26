import { describe, it, expect, vi } from 'vitest'

// Mock node-hid before any device imports
vi.mock('node-hid', () => ({ default: {} }))
// Mock sharp to avoid native binaries
vi.mock('sharp', () => ({ default: vi.fn() }))

import { PRODUCT_REGISTRY, USB_VID, USB_PID } from '../types/ProductIDs'
import { StreamDock293 } from '../devices/StreamDock293'
import { StreamDockN4 } from '../devices/StreamDockN4'
import { K1Pro } from '../devices/K1Pro'

describe('PRODUCT_REGISTRY', () => {
  it('has no duplicate VID/PID combinations', () => {
    const seen = new Set<string>()
    for (const [vid, pid] of PRODUCT_REGISTRY) {
      const key = `${vid}:${pid}`
      expect(seen.has(key), `Duplicate 0x${vid.toString(16)}:0x${pid.toString(16)}`).toBe(false)
      seen.add(key)
    }
  })

  it('maps StreamDock293 by VID/PID', () => {
    const entry = PRODUCT_REGISTRY.find(([vid, pid]) => vid === USB_VID.V293 && pid === USB_PID.STREAMDOCK_293)
    expect(entry).toBeDefined()
    expect(entry![2]).toBe(StreamDock293)
  })

  it('maps StreamDockN4 entries', () => {
    const entries = PRODUCT_REGISTRY.filter(([, , Ctor]) => Ctor === StreamDockN4)
    expect(entries.length).toBeGreaterThan(0)
  })

  it('maps K1Pro entries', () => {
    const entries = PRODUCT_REGISTRY.filter(([, , Ctor]) => Ctor === K1Pro)
    expect(entries.length).toBe(2)
  })

  it('all entries have a valid constructor', () => {
    for (const [, , Ctor] of PRODUCT_REGISTRY) {
      expect(typeof Ctor).toBe('function')
    }
  })
})
