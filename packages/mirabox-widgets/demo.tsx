// demo.tsx — mirabox-widgets demo
//
// Layout:
//   Keys 1–10 →  Aerospace workspaces: 1 2 3 4 5 / q w e r t
//   TouchKey 1  →  Volume display / mute toggle
//   TouchKey 2–4 →  Aerospace focus ← ↓ ↑ →
//   Knob 1  →  Volume adjust (rotate) / mute (click)
//
// Run:
//   bun run demo
//   bun --watch demo.tsx

import React from 'react'
import { mountDevice } from 'react-mirabox'
import { DeviceManager } from 'mirabox-client'
import { VolumeControl, AerospaceControl } from './src/index'

const [device] = await new DeviceManager().enumerate()
if (!device) {
  console.error('No StreamDock device found.')
  process.exit(1)
}
await device.open()
await device.init()
console.log(`Connected: ${device.path}`)

function App() {
  return (
    <>
      {/* Keys 1–10: switch Aerospace workspace */}
      <AerospaceControl keyOffset={1} />

      {/* TouchKey 1 + Knob 1: volume display and control
          (AerospaceControl uses TouchKeys 1–4 for focus direction,
           so VolumeControl overrides TouchKey 1 with its own binding) */}
      <VolumeControl touchKeyIndex={1} knobIndex={1} />
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

console.log('Running. Ctrl+C to stop.')
