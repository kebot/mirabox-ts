import { useLayoutEffect, useEffect, useRef, type ReactNode } from 'react'
import { KonvaRenderer } from 'react-konva'
import Konva from 'konva'
import { EventType } from 'mirabox-client'
import { CanvasKey } from './CanvasKey'
import { useDeviceContext } from './DeviceContext'
import type { MountHandle } from './mount'

export interface TouchKeyProps {
  /** 1-based touch key index (TOUCH_1 = 1, …, TOUCH_4 = 4) */
  index: number
  children?: ReactNode
  onClick?: () => void
  onKeyDown?: () => void
  onKeyUp?: () => void
}

export function TouchKey({ index, children, onClick, onKeyDown, onKeyUp }: TouchKeyProps) {
  const { device, enqueueFrame, subscribeInput } = useDeviceContext()
  const handleRef = useRef<MountHandle | null>(null)

  // N4/N4Pro touch keys occupy visual key slots 11–14 (offset +10 from touch index).
  // Images are sent via setKeyImage at these logical indices using the secondary-screen format.
  const keyIndex = index + 10

  // Syncs children into the touch key's private Konva stage after every render.
  useLayoutEffect(() => {
    if (!children) return

    const fmt = device.keyImageFormat()
    // Touch keys use a wider secondary-screen canvas (176×112) when the device supports it
    const secondFmt = (device as any).secondscreenImageFormat?.() ?? fmt
    const [w, h] = secondFmt.size

    const wrapped = (
      <CanvasKey onFrame={(buf) => enqueueFrame(keyIndex, buf)}>
        {children}
      </CanvasKey>
    )

    if (!handleRef.current) {
      const stage = new Konva.Stage({ width: w, height: h })
      const fiber = KonvaRenderer.createContainer(stage, 1, null, false, null, '', console.error, console.error, console.error, () => {})
      KonvaRenderer.updateContainer(wrapped, fiber, null, () => {})
      handleRef.current = {
        stage,
        fiber,
        unmount: () => {
          KonvaRenderer.flushSyncFromReconciler(() => {
            KonvaRenderer.updateContainer(null, fiber, null, () => {})
          })
          stage.destroy()
        },
      }
    } else {
      KonvaRenderer.updateContainer(wrapped, handleRef.current.fiber, null, () => {})
    }
  })

  // Destroy the per-key Konva stage when this component unmounts
  useEffect(() => {
    return () => handleRef.current?.unmount()
  }, [])

  // Route device TOUCH events for this touch index to the event props.
  // Touch keys are active-low: state=0 means pressed, state=1 means released.
  useEffect(() => {
    return subscribeInput((event) => {
      if (event.eventType !== EventType.TOUCH) return
      if (event.touchKey !== `touch_${index}`) return
      if (event.state === 0) {
        onKeyDown?.()
        onClick?.()
      } else {
        onKeyUp?.()
      }
    })
  }, [subscribeInput, index, onClick, onKeyDown, onKeyUp])

  return null
}
