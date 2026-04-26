import 'konva/skia-backend'
import Konva from 'konva'
import { KonvaRenderer } from 'react-konva'
import type { ReactNode } from 'react'
import type { StreamDock, InputEvent } from 'mirabox-client'
import { DeviceContext, type InputHandler } from './DeviceContext'

export interface MountDeviceOptions {
  flushFps?: number
}

export interface DeviceHandle {
  destroy: () => Promise<void>
}

export function mountDevice(
  device: StreamDock,
  jsx: ReactNode,
  options: MountDeviceOptions = {}
): DeviceHandle {
  const { flushFps = 30 } = options
  const flushMs = Math.round(1000 / flushFps)

  // Latest frame per key — superseded frames are dropped before they hit USB
  const latestFrames = new Map<number, Buffer>()
  let flushInFlight = false
  let stopped = false

  function enqueueFrame(keyIndex: number, buf: Buffer) {
    if (!stopped) latestFrames.set(keyIndex, buf)
  }

  // Drain the frame queue at flushFps: write changed keys then refresh the display
  const flushTimer = setInterval(async () => {
    if (stopped || flushInFlight || latestFrames.size === 0) return
    flushInFlight = true
    const entries = Array.from(latestFrames.entries())
    latestFrames.clear()
    await Promise.all(entries.map(([k, buf]) => device.setKeyImage(k, buf)))
    device.refresh()
    flushInFlight = false
  }, flushMs)

  // One listener on the device; each Key/TouchKey/Knob registers a handler
  // in the Set below. This avoids the MaxListeners warning that would occur
  // if every component called device.on('input') independently.
  const inputHandlers = new Set<InputHandler>()
  const deviceInputListener = (_dev: unknown, event: InputEvent) => {
    for (const handler of inputHandlers) handler(event)
  }
  device.on('input', deviceInputListener)

  // Components call subscribeInput() in useEffect; the returned fn unsubscribes
  const subscribeInput = (handler: InputHandler) => {
    inputHandlers.add(handler)
    return () => { inputHandlers.delete(handler) }
  }

  // 0×0 dummy Konva stage — acts as the React root container for the device tree.
  // No pixels are ever drawn to it; all visual output goes to per-key stages inside <Key>.
  const stage = new Konva.Stage({ width: 0, height: 0 })
  const fiber = KonvaRenderer.createContainer(stage, 1, null, false, null, '', console.error, console.error, console.error, () => {})

  const tree = (
    <DeviceContext.Provider value={{ device, enqueueFrame, subscribeInput }}>
      {jsx}
    </DeviceContext.Provider>
  )

  KonvaRenderer.updateContainer(tree, fiber, null, () => {})

  return {
    destroy: () =>
      new Promise<void>((resolve) => {
        stopped = true
        clearInterval(flushTimer)
        latestFrames.clear()
        device.off('input', deviceInputListener)
        inputHandlers.clear()
        // Unmount the React tree, which triggers cleanup effects in Key/TouchKey/Knob
        KonvaRenderer.flushSyncFromReconciler(() => {
          KonvaRenderer.updateContainer(null, fiber, null, () => {})
        })
        stage.destroy()
        resolve()
      }),
  }
}
