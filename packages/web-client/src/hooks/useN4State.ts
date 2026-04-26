import { useEffect, useRef, useState } from 'react'
import type { InputEvent } from '@/hooks/useStreamDock'

export interface KnobState {
  angle: number
  pressed: boolean
}

export interface N4State {
  activeKeys: Record<number, boolean>
  activeTouchKeys: Record<number, boolean>
  knobs: KnobState[]
}

export function useN4State(events: InputEvent[]): N4State {
  const [activeKeys, setActiveKeys] = useState<Record<number, boolean>>({})
  const [activeTouchKeys, setActiveTouchKeys] = useState<Record<number, boolean>>({})
  const [knobs, setKnobs] = useState<KnobState[]>(
    Array.from({ length: 4 }, () => ({ angle: 0, pressed: false })),
  )
  const lastProcessed = useRef(-1)

  useEffect(() => {
    const ev = events[0]
    if (!ev || ev.id === lastProcessed.current) return
    lastProcessed.current = ev.id

    if (ev.type === 'BUTTON') {
      const m = ev.detail.match(/key=(\d+)\s+(\S+)/)
      if (m) {
        const id = parseInt(m[1])
        const down = m[2] === 'keyDown'
        setActiveKeys((p) => ({ ...p, [id]: down }))
        if (down) setTimeout(() => setActiveKeys((p) => ({ ...p, [id]: false })), 300)
      }
    } else if (ev.type === 'TOUCH') {
      const m = ev.detail.match(/key=touch_(\d+)/)
      if (m) {
        const id = parseInt(m[1])
        setActiveTouchKeys((p) => ({ ...p, [id]: true }))
        setTimeout(() => setActiveTouchKeys((p) => ({ ...p, [id]: false })), 250)
      }
    } else if (ev.type === 'KNOB_ROT') {
      const m = ev.detail.match(/knob=knob_(\d+)\s+(\S+)/)
      if (m) {
        const idx = parseInt(m[1]) - 1
        const delta = m[2] === 'right' ? 36 : -36
        setKnobs((p) => p.map((k, i) => (i === idx ? { ...k, angle: k.angle + delta } : k)))
      }
    } else if (ev.type === 'KNOB_BTN') {
      const m = ev.detail.match(/knob=knob_(\d+)\s+(\S+)/)
      if (m) {
        const idx = parseInt(m[1]) - 1
        setKnobs((p) => p.map((k, i) => (i === idx ? { ...k, pressed: true } : k)))
        setTimeout(() => setKnobs((p) => p.map((k, i) => (i === idx ? { ...k, pressed: false } : k))), 200)
      }
    }
  }, [events])

  return { activeKeys, activeTouchKeys, knobs }
}
