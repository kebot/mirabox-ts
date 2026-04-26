# StreamDock SDK (TypeScript)

TypeScript port of the StreamDock Python SDK. Controls StreamDock USB macro pad devices (293, N3, N4, N4Pro, N1, XL, M3, M18, K1Pro, and variants) from Node.js.

## Architecture

The SDK wraps the same proprietary C transport library used by the Python SDK (`libtransport.so` / `.dylib` / `.dll`). No USB protocol reverse-engineering was needed — the C binary handles all HID communication; this SDK calls it via FFI.

```
Your code
   ↓
StreamDock device class  (src/devices/)
   ↓
LibUSBHIDAPI             (src/transport/LibUSBHIDAPI.ts)   ← koffi FFI
   ↓
libtransport.so / .dylib / .dll                            ← proprietary C binary
   ↓
USB HID device
```

## Design Decisions

### FFI: koffi instead of node-hid

The C library exposes high-level operations (`transport_set_key_image_stream`, `transport_set_led_color`, etc.) rather than raw HID bytes. Wrapping it with [koffi](https://koffi.dev) was the right choice:

- No need to reverse-engineer the USB wire protocol
- The same binary runs on Windows, macOS (x86_64 + arm64), and Linux (glibc-versioned, arm64 variants)
- koffi has first-class TypeScript support, no native build step, and handles `void**` output parameters and self-referential structs

`node-hid` was explicitly ruled out — it provides raw HID access and would have required reimplementing the entire device protocol.

### Image processing: sharp instead of PIL

Python uses PIL for image transforms (rotate → resize → flip → JPEG). TypeScript uses [sharp](https://sharp.pixelplumbing.com), which wraps libvips:

| PIL operation | sharp equivalent |
|---|---|
| `image.rotate(deg, expand=True)` | `.rotate(deg)` — auto-expands for ±90° |
| `image.resize(w, h)` | `.resize(w, h, { fit: 'fill' })` |
| `image.transpose(FLIP_LEFT_RIGHT)` | `.flop()` |
| `image.transpose(FLIP_TOP_BOTTOM)` | `.flip()` |
| `image.convert('RGB')` | `.jpeg()` |

**Order matters**: rotation must happen before resize (matching Python). sharp's `.rotate(180)` preserves canvas size; `.rotate(90)` auto-expands — both match PIL's `expand` behaviour exactly.

The Python SDK wrote images to temporary files and passed file paths to the C library. The TypeScript SDK processes everything in memory and passes `Buffer` objects directly, eliminating the temp-file round-trip.

### Async model: koffi async + EventEmitter instead of threads

Python uses two daemon threads per device — a read loop and a heartbeat. Node.js is single-threaded, so:

| Python | TypeScript |
|---|---|
| Read daemon thread (100ms polling) | koffi async FFI call on libuv thread pool, self-rescheduling |
| Heartbeat daemon thread (10s interval) | `setInterval(..., 10_000)` |
| `threading.Lock` for callback safety | Not needed — event loop is single-threaded |
| `set_key_callback(fn)` | `device.on('input', fn)` |
| `set_key_callback_async(fn, loop)` | `device.on('input', async fn)` — async listeners work natively |

The read loop uses koffi's `.async()` variant, which runs `transport_read` on libuv's thread pool and delivers the callback on the main thread. This gives the same 100ms polling cadence as Python without blocking the event loop.

### wchar_t width

`serial_number`, `manufacturer_string`, and `product_string` in the `HidDeviceInfo` C struct are `wchar_t*`. On Linux/macOS `sizeof(wchar_t) == 4`; on Windows it is `2`. The struct definition in `LibUSBHIDAPI.ts` branches on `process.platform` to use `char32_t*` vs `char16_t*` accordingly.

### K1Pro byte offset

All devices decode input events from `arr[9]` (hardware code) and `arr[10]` (state). The K1Pro uses `arr[10]` and `arr[11]`. The base class `_handleRawData()` branches on `featureOption.deviceType === DeviceType.K1Pro`.

### libuv thread pool

Each open device runs one persistent async koffi call on libuv's thread pool. The default pool size is 4. With more than 4 devices connected simultaneously, set:

```
UV_THREADPOOL_SIZE=16 node your-app.js
```

## Installation

```bash
cd sdk-ts
npm install
```

## Usage

```typescript
import { DeviceManager, EventType } from './src'

const manager = new DeviceManager()
const devices = manager.enumerate()

for (const device of devices) {
  device.init()
  device.open()

  device.on('input', (dev, event) => {
    if (event.eventType === EventType.BUTTON) {
      console.log(`Key ${event.key} ${event.state === 1 ? 'pressed' : 'released'}`)
    } else if (event.eventType === EventType.KNOB_ROTATE) {
      console.log(`Knob ${event.knobId} rotated ${event.direction}`)
    }
  })

  await device.setKeyImage(1, '/path/to/image.png')
  device.setBrightness(80)
}
```

### Hotplug

```typescript
manager.enumerate()

manager.startHotplug(
  (device) => {
    console.log('Device connected:', device.path)
    device.init()
    device.open()
  },
  (path) => {
    console.log('Device disconnected:', path)
  },
)
```

### LED (N4Pro, XL, M18)

```typescript
device.setLedColor(255, 0, 128)   // RGB
device.setLedBrightness(80)        // 0–100
device.resetLedEffect()
```

### K1Pro keyboard lighting

```typescript
import { K1Pro } from './src'

const k1 = device as K1Pro
k1.setKeyboardLightingEffects(1)    // 0 = static, 1–9 = animated
k1.setKeyboardRgbBacklight(0, 200, 255)
k1.setKeyboardLightingSpeed(4)      // 0–7
```

## Supported Devices

| Device | Keys | Knobs | Touch | RGB LED |
|--------|------|-------|-------|---------|
| StreamDock 293 | 15 | — | — | — |
| StreamDock 293V3 | 15 | — | — | — |
| StreamDock 293s | 18 | — | — | — |
| StreamDock 293sV3 | 18 | — | — | — |
| StreamDock N3 | 9 | 3 | — | — |
| StreamDock N4 | 15 | 4 | secondary strip | — |
| StreamDock N4Pro | 15 | 4 | secondary strip | 4 LEDs |
| StreamDock N1 | 17 | 1 | — | — |
| StreamDock XL | 32 | 2 | 1024×600 | 6 LEDs |
| StreamDock M3 | 15 | 3 | 854×480 | — |
| StreamDock M18 | 15 | — | 480×272 | 24 LEDs |
| K1Pro | 6 | 3 | — | RGB per-key |

## File Structure

```
sdk-ts/
├── TransportDLL/                    # proprietary C binaries (all platforms)
├── src/
│   ├── index.ts                     # barrel exports
│   ├── DeviceManager.ts             # enumerate + polling hotplug
│   ├── transport/
│   │   ├── platformLoader.ts        # resolves C library path (OS/arch/glibc)
│   │   └── LibUSBHIDAPI.ts          # koffi FFI wrapper (~35 C functions)
│   ├── imageHelpers/
│   │   └── imageHelper.ts           # toNativeFormat() via sharp
│   ├── types/
│   │   ├── InputTypes.ts            # enums + InputEvent + DeviceInfo
│   │   ├── FeatureOption.ts         # DeviceType enum + FeatureOption class
│   │   └── ProductIDs.ts            # VID/PID constants + device registry
│   └── devices/
│       ├── StreamDock.ts            # abstract base class
│       ├── StreamDock293.ts
│       ├── StreamDock293V3.ts
│       ├── StreamDock293s.ts
│       ├── StreamDock293sV3.ts
│       ├── StreamDockN3.ts
│       ├── StreamDockN4.ts
│       ├── StreamDockN4Pro.ts
│       ├── StreamDockN1.ts
│       ├── StreamDockXL.ts
│       ├── StreamDockM3.ts
│       ├── StreamDockM18.ts
│       └── K1Pro.ts
└── package.json
```

## Building

```bash
npm run build    # outputs to dist/ (CJS + ESM + .d.ts)
```

## Notes

- The C transport library binaries live in `sdk-ts/TransportDLL/` (co-located with the SDK).
- On Linux the correct glibc-versioned library is selected automatically. If none match, falls back to the generic `libtransport.so`.
- macOS arm64 (`libtransport_arm64.dylib`) and x86_64 (`libtransport.dylib`) are both supported. Confirm the `.dylib` files are present in the `TransportDLL/` directory before targeting macOS.
