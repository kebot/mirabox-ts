# react-mirabox

Render React components onto StreamDock macro pad keys using Konva canvas, with a React-native event API for buttons, touch keys, and knobs.

## How it works

1. `mountDevice` creates a headless React tree (via `react-konva` + `skia-canvas`)
2. Each `<Key>` renders its Konva children into a separate off-screen canvas
3. Frames are batched and flushed to the device via `setKeyImage` at up to 30 FPS
4. Input events from the device are dispatched through a single listener and routed to the matching `<Key>`, `<TouchKey>`, or `<Knob>` via React props

## Installation

```bash
bun add react-mirabox mirabox-client
```

## Quick start

```tsx
import React, { useState } from 'react'
import { Rect, Text } from 'react-konva'
import { mountDevice, Key, TouchKey, Knob } from 'react-mirabox'
import { DeviceManager } from 'mirabox-client'

const [device] = await new DeviceManager().enumerate()
await device.open()
await device.init()

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <Key index={1} onKeyDown={() => setCount(c => c + 1)}>
        <Rect x={0} y={0} width={112} height={112} fill="#1e293b" />
        <Text text={String(count)} fill="white" fontSize={32}
              width={112} height={112} align="center" verticalAlign="middle" />
      </Key>

      <TouchKey index={1} onClick={() => setCount(0)}>
        <Rect x={0} y={0} width={176} height={112} fill="#7c3aed" />
        <Text text="Reset" fill="white" fontSize={22}
              width={176} height={112} align="center" verticalAlign="middle" />
      </TouchKey>

      <Knob index={1} onRotate={(dir) => console.log('Knob →', dir)} />
    </>
  )
}

const { destroy } = mountDevice(device, <App />)

process.on('SIGINT', async () => {
  await destroy()
  await device.close()
  process.exit(0)
})
```

## API

### `mountDevice(device, jsx, options?)`

Mounts a React tree onto a device. Returns `{ destroy }`.

```ts
interface MountDeviceOptions {
  flushFps?: number  // USB write rate, default 30
}

interface DeviceHandle {
  destroy: () => Promise<void>
}
```

All `<Key>`, `<TouchKey>`, and `<Knob>` components inside the tree share React state — you can use `useState`, `useEffect`, `useContext`, etc. freely across keys.

---

### `<Key>`

Renders Konva children onto a physical button key and handles press events.

```tsx
<Key
  index={1}           // 1-based logical key index
  onKeyDown={() => {}}  // button pressed
  onKeyUp={() => {}}    // button released
  onClick={() => {}}    // press + release (fires on release)
>
  <Rect fill="#1e293b" width={112} height={112} />
  <Text text="1" fill="white" ... />
</Key>
```

Children are Konva elements (`Rect`, `Text`, `Arc`, `Image`, etc. from `react-konva`). Key dimensions are read from the device automatically (typically 112×112).

---

### `<TouchKey>`

Renders Konva children onto a touch key slot and handles touch events. Touch keys use a wider secondary-screen format (176×112 on N4/N4Pro).

```tsx
<TouchKey
  index={1}           // 1-based touch key index (1–4)
  onClick={() => {}}    // touch pressed (active-low: fires on state=0)
  onKeyDown={() => {}}  // touch pressed
  onKeyUp={() => {}}    // touch released
>
  <Rect fill="#1e293b" width={176} height={112} />
  <Text text="T1" fill="white" ... />
</TouchKey>
```

Children are optional — omit them to use `<TouchKey>` as an event-only binding.

---

### `<Knob>`

Event-only component for rotary knobs (no visual rendering).

```tsx
<Knob
  index={1}                            // 1-based knob index (1–4)
  onClick={() => {}}                   // knob pressed
  onRotate={(dir) => {}}               // 'left' | 'right'
/>
```

---

## Low-level API

For advanced use cases, the underlying primitives are still exported:

### `mountCanvasKey(jsx, options?)`

Mounts a single React/Konva tree into a headless stage and returns a handle.

```ts
const handle = mountCanvasKey(
  <CanvasKey onFrame={(buf) => device.setKeyImage(1, buf)}>
    <Rect fill="blue" width={112} height={112} />
  </CanvasKey>,
  { width: 112, height: 112 }
)

// Later:
handle.unmount()
```

### `<CanvasKey>`

Renders Konva children and emits a PNG `Buffer` via `onFrame` after every React commit. Deduplicates unchanged frames.

```tsx
<CanvasKey onFrame={(buf: Buffer) => { /* send to device */ }}>
  {/* Konva elements */}
</CanvasKey>
```
