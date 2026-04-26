import { useEffect } from 'react'
import { EventType, type Direction } from 'mirabox-client'
import { useDeviceContext } from './DeviceContext'

export interface KnobProps {
  index: number
  onClick?: () => void
  onRotate?: (direction: Direction) => void
}

export function Knob({ index, onClick, onRotate }: KnobProps) {
  const { subscribeInput } = useDeviceContext()

  // Route KNOB_ROTATE and KNOB_PRESS events for this knob index to the event props.
  // Filters by knobId first so BUTTON/TOUCH events are discarded without checking eventType.
  // state=1 means pressed (knob push fires onClick on press, not release).
  useEffect(() => {
    return subscribeInput((event) => {
      if (event.knobId !== `knob_${index}`) return

      if (event.eventType === EventType.KNOB_ROTATE) {
        if (event.direction) onRotate?.(event.direction)
      } else if (event.eventType === EventType.KNOB_PRESS) {
        if (event.state === 1) onClick?.()
      }
    })
  }, [subscribeInput, index, onClick, onRotate])

  return null
}
