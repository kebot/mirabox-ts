// demo2.tsx — react-mirabox end-user demo
//
// Run:  bun demo2.tsx
// - Press a regular key to increment its counter
// - Press a touch key to toggle its color
// - Rotate a knob to see direction logged
// - Press Ctrl+C to exit

import React, { useState } from 'react'
import { Rect, Text } from 'react-konva'
import { mountDevice, Key, TouchKey, Knob } from './src/index'
import { DeviceManager } from 'mirabox-client/src/DeviceManager'

const [device] = await new DeviceManager().enumerate()
if (!device) {
  console.error('No StreamDock device found.')
  process.exit(1)
}
await device.open()
await device.init()
console.log(`Connected: ${device.path} (${device.KEY_COUNT} keys)`)

// N4/N4Pro: KEY_COUNT=14 or 15 — keys 11-14 are the touch key slots
const TOUCH_KEY_COUNT = device.KEY_COUNT > 10 ? 4 : 0
const MAIN_KEY_COUNT = device.KEY_COUNT - TOUCH_KEY_COUNT
const KNOB_COUNT = 4


function VolumeControl () {
  const [volume, setVolume] = useState(0)


  return (
    <Key index={1} onKeyDown={() => console.log('volume up')}>
      <Rect x={0} y={0} width={112} height={112} fill="#1e293b" />
      <Text text="Volume Up" fill="white" fontSize={28} width={112} height={112} align="center" verticalAlign="middle" />
    </Key>
  )
}

function App() {
  return (
    <>
      <VolumeControl />
    </>
  )
}

function App1() {
  const [counts, setCounts] = useState<Record<number, number>>({})
  const [touched, setTouched] = useState<Record<number, boolean>>({})

  const inc = (i: number) => setCounts(p => ({ ...p, [i]: (p[i] ?? 0) + 1 }))
  const toggle = (i: number) => setTouched(p => ({ ...p, [i]: !p[i] }))

  return (
    <>
      {/* Regular keys */}
      {Array.from({ length: MAIN_KEY_COUNT }, (_, i) => {
        const idx = i + 1
        const count = counts[idx] ?? 0
        return (
          <Key key={idx} index={idx} onKeyDown={() => inc(idx)}>
            <Rect x={0} y={0} width={112} height={112} fill={count > 0 ? '#1d4ed8' : '#1e293b'} cornerRadius={6} />
            <Text
              text={count > 0 ? String(count) : String(idx)}
              fontSize={28}
              fontStyle="bold"
              fill="white"
              width={112}
              height={112}
              align="center"
              verticalAlign="middle"
            />
          </Key>
        )
      })}

      {/* Touch keys */}
      {Array.from({ length: TOUCH_KEY_COUNT }, (_, i) => {
        const idx = i + 1
        const active = touched[idx] ?? false
        return (
          <TouchKey key={`t${idx}`} index={idx} onClick={() => { console.log('touch key', idx); toggle(idx) }}>
            <Rect x={0} y={0} width={176} height={112} fill={active ? '#059669' : '#1e293b'} cornerRadius={6} />
            <Text
              text={`T${idx}`}
              fontSize={24}
              fontStyle="bold"
              fill="white"
              width={176}
              height={112}
              align="center"
              verticalAlign="middle"
            />
          </TouchKey>
        )
      })}

      {/* Knobs */}
      {Array.from({ length: KNOB_COUNT }, (_, i) => (
        <Knob
          key={`k${i + 1}`}
          index={i + 1}
          onRotate={(dir) => console.log(`Knob ${i + 1} → ${dir}`)}
          onClick={() => console.log(`Knob ${i + 1} clicked`)}
        />
      ))}
    </>
  )
}

const { destroy } = mountDevice(device, <App />)

process.on('SIGINT', async () => {
  await destroy()
  await device.close?.()
  console.log('\nBye.')
  process.exit(0)
})

console.log(`${MAIN_KEY_COUNT} keys, ${TOUCH_KEY_COUNT} touch keys, ${KNOB_COUNT} knobs. Ctrl+C to stop.`)
