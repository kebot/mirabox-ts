import { createContext, useContext } from 'react'
import type { StreamDock, InputEvent } from 'mirabox-client'

export type InputHandler = (event: InputEvent) => void

export interface DeviceContextValue {
  device: StreamDock
  enqueueFrame: (keyIndex: number, buf: Buffer) => void
  /** Subscribe to device input events. Returns an unsubscribe function. */
  subscribeInput: (handler: InputHandler) => () => void
}

export const DeviceContext = createContext<DeviceContextValue | null>(null)

export function useDeviceContext(): DeviceContextValue {
  const ctx = useContext(DeviceContext)
  if (!ctx) throw new Error('useDeviceContext must be used inside mountDevice')
  return ctx
}
