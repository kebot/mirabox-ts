# mirabox-ts

TypeScript monorepo for controlling StreamDock USB macro pad devices. Render React components directly onto hardware keys, handle button/knob/touch input with React event props, and build ready-made widgets on top.

## Packages

| Package | Description |
|---|---|
| [`mirabox-client`](#mirabox-client) | Node.js SDK — USB device control via FFI |
| [`react-mirabox`](#react-mirabox) | React component layer — render Konva onto keys |
| [`mirabox-widgets`](#mirabox-widgets) | Pre-built widgets (volume, Aerospace WM) |
| `web-client` | Browser UI connecting to a Python backend on `:9002` |

```
packages/
├── mirabox-client/    # USB transport + device classes
├── react-mirabox/     # <Key>, <Knob>, <TouchKey>, mountDevice
├── mirabox-widgets/   # VolumeControl, AerospaceControl
└── web-client/        # Vite + React browser dashboard
```

## Supported Devices

13 StreamDock models:

| Class | Notes |
|---|---|
| `StreamDock293` / `StreamDock293V3` | 2×3 grid |
| `StreamDock293s` / `StreamDock293sV3` | Compact variant |
| `StreamDockN1` | Single-column |
| `StreamDockN3` | N-series 3 |
| `StreamDockN4` | N-series 4 — 10 keys + 4 touch keys + 4 knobs |
| `StreamDockN4Pro` | N4 Pro — 15 keys + 4 touch keys + 4 knobs + RGB LEDs |
| `StreamDockXL` | Extended large format |
| `StreamDockM3` | 3-key compact |
| `StreamDockM18` | 18-key |
| `K1Pro` | K1 Pro |

---

## mirabox-client

Low-level Node.js SDK. Wraps a proprietary C transport library via **koffi FFI** — no reverse-engineering required.

### Install

```bash
bun add mirabox-client
```

### Usage

```ts
import { DeviceManager } from 'mirabox-client'

const manager = new DeviceManager()
const [device] = await manager.enumerate()

await device.open()
await device.init()

// Send an image to key 1 (accepts Buffer or file path)
await device.setKeyImage(1, '/path/to/image.png')
device.refresh()

// Input events
device.on('input', (dev, event) => {
  console.log(event.eventType, event.key, event.state)
})

await device.close()
```

### Input event types

```ts
import { EventType } from 'mirabox-client'

// event.eventType values:
EventType.BUTTON      // key pressed/released   → event.key, event.state (1=press, 0=release)
EventType.TOUCH       // touch key              → event.touchKey, event.state (0=press, 1=release)
EventType.KNOB_ROTATE // knob turned            → event.knobId, event.direction ('left'|'right')
EventType.KNOB_PRESS  // knob pushed            → event.knobId, event.state (1=press)
EventType.SWIPE       // touchscreen swipe      → event.direction
```

### Key API

```ts
device.setKeyImage(key, source, options?)       // send image to a button key
device.setKeyImagesBatch(entries, options?)     // batch write, single refresh
device.setTouchscreenImage(source, options?)    // full touchscreen background
device.setBrightness(percent)
device.setLedColor(r, g, b)                     // RGB LED (N4Pro)
device.refresh()                                // commit pending frame
device.wakeScreen()
device.clearAllIcon()
```

---

## react-mirabox

Render React + Konva components headlessly onto device keys. Each `<Key>` gets its own off-screen canvas; frames are batched and flushed at up to 30 FPS via USB.

### Install

```bash
bun add react-mirabox mirabox-client
```

### Quick start

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

### API

#### `mountDevice(device, jsx, options?)`

Mounts a React tree onto the device. All `<Key>`, `<TouchKey>`, and `<Knob>` components inside share React state — `useState`, `useEffect`, `useContext` all work normally.

```ts
interface MountDeviceOptions {
  flushFps?: number  // USB write rate, default 30
}
// returns: { destroy: () => Promise<void> }
```

#### `<Key>`

Renders Konva children onto a physical button key.

```tsx
<Key
  index={1}             // 1-based logical key index
  onClick={() => {}}    // fires on release
  onKeyDown={() => {}}  // fires on press  (state=1)
  onKeyUp={() => {}}    // fires on release (state=0)
>
  {/* react-konva elements: Rect, Text, Arc, Image, ... */}
</Key>
```

Key dimensions are read from the device automatically (typically 112×112 px).

#### `<TouchKey>`

Renders onto a secondary-screen touch key slot (176×112 px on N4/N4Pro).

```tsx
<TouchKey
  index={1}             // 1-based, 1–4
  onClick={() => {}}    // fires on press (active-low: state=0)
  onKeyDown={() => {}}
  onKeyUp={() => {}}
>
  {/* optional Konva children */}
</TouchKey>
```

#### `<Knob>`

Event-only — no visual rendering.

```tsx
<Knob
  index={1}                          // 1-based, 1–4
  onClick={() => {}}                 // knob push (fires on press)
  onRotate={(dir) => {}}             // 'left' | 'right'
/>
```

#### Low-level primitives

```ts
// Mount a single React/Konva tree into a headless stage
const { stage, fiber, unmount } = mountCanvasKey(jsx, { width: 112, height: 112 })

// Capture canvas as PNG after every React commit
<CanvasKey onFrame={(buf: Buffer) => device.setKeyImage(1, buf)}>
  <Rect fill="blue" width={112} height={112} />
</CanvasKey>
```

### Demo

```bash
cd packages/react-mirabox
bun run demo   # bun --watch demo.tsx
```

---

## mirabox-widgets

Pre-built widgets using `react-mirabox`. macOS-only (uses `osascript`, `sips`, `aerospace`).

### Install

```bash
bun add mirabox-widgets mirabox-client react-mirabox
```

### VolumeControl

Displays system volume on a touch key; knob adjusts level. Both knob click and touch key click toggle mute.

```tsx
import { VolumeControl } from 'mirabox-widgets'

<VolumeControl
  touchKeyIndex={1}   // default: 1
  knobIndex={1}       // default: 1
  step={5}            // % per knob tick, default: 5
/>
```

Syncs from system volume every second so external changes (Spotify, menu bar) are reflected.

### AerospaceControl

Workspace switcher for the [Aerospace](https://github.com/nikitabobko/AeroSpace) tiling window manager. Each key shows the app icons running in that workspace and highlights the active one.

```tsx
import { AerospaceControl } from 'mirabox-widgets'

<AerospaceControl
  workspaces={['1','2','3','4','5','Q','W','E','R','T']}  // default
  keyOffset={1}   // first key index, default: 1
/>
```

- **Keys 1–10**: switch workspace — shows app icons (up to 4), polls every 3 s
- **TouchKeys 1–4**: `focus left / down / up / right`
- Active workspace highlighted in blue; icons extracted from macOS app bundles via `sips`

### Demo

```bash
cd packages/mirabox-widgets
bun run demo   # bun --watch demo.tsx
```

---

## Development

```bash
# Install all workspace dependencies
bun install

# Run tests
bun test
```

Each package has its own build and dev scripts — see the package-level README or `package.json` for details.
