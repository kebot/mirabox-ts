import { useLayoutEffect, useEffect, useRef, type ReactNode } from 'react'
import { KonvaRenderer } from 'react-konva'
import Konva from 'konva'
import { EventType } from 'mirabox-client'
import { CanvasKey } from './CanvasKey'
import { useDeviceContext } from './DeviceContext'
import type { MountHandle } from './mount'

export interface KeyProps {
  index: number
  children?: ReactNode
  onClick?: () => void
  onKeyDown?: () => void
  onKeyUp?: () => void
}

export function Key({ index, children, onClick, onKeyDown, onKeyUp }: KeyProps) {
  const { device, enqueueFrame, subscribeInput } = useDeviceContext()
  const handleRef = useRef<MountHandle | null>(null)

  // Runs after every render — syncs children into the key's private Konva stage.
  // On first render a new stage + fiber are created; subsequent renders call
  // updateContainer on the existing fiber so React reconciles in place.
  useLayoutEffect(() => {
    const [w, h] = device.keyImageFormat().size
    const wrapped = (
      // CanvasKey captures the stage as PNG after each commit and forwards the
      // buffer to enqueueFrame, which batches it for the next USB flush cycle.
      <CanvasKey onFrame={(buf) => enqueueFrame(index, buf)}>
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

  // Route device BUTTON events for this key index to the event props.
  // state=1 → pressed, state=0 → released. onClick fires on release (like web).
  useEffect(() => {
    return subscribeInput((event) => {
      if (event.eventType !== EventType.BUTTON) return
      if ((event.key as number) !== index) return
      if (event.state === 1) {
        onKeyDown?.()
      } else {
        onKeyUp?.()
        onClick?.()
      }
    })
  }, [subscribeInput, index, onClick, onKeyDown, onKeyUp])

  // Keys render into their own Konva stages — nothing to output in the outer tree
  return null
}
