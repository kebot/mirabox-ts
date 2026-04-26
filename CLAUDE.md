# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Bun monorepo with two packages:
- **`packages/mirabox-client`** — Node.js TypeScript SDK that wraps a proprietary C transport library (`libtransport.so`/`.dylib`/`.dll`) via **koffi FFI** to control StreamDock USB macro pad devices (13 models)
- **`packages/web-client`** — React + TypeScript UI that connects to a Python backend server on `:9002` via REST and WebSocket

## Commands

### Root
```bash
bun install          # install all workspace deps
```

### mirabox-client (`packages/mirabox-client/`)
```bash
bun dev              # run src/main.ts (CLI demo)
bun run build        # emit dist/index.js + dist/index.d.ts
```

### web-client (`packages/web-client/`)
```bash
bun run dev          # Vite dev server → http://localhost:5173
bun run build        # tsc -b && vite build → dist/
bun run lint         # ESLint
bun run preview      # serve built dist/
bun run generate     # regenerate src/api/schema.d.ts from live backend OpenAPI
```

To run the headless Konva frame renderer:
```bash
cd packages/web-client && bun server.ts   # writes 60 PNG frames to ./frames/
```

## Architecture

### mirabox-client

```
Your code
   ↓
StreamDock device class  (src/devices/)
   ↓
LibUSBHIDAPI             (src/transport/LibUSBHIDAPI.ts)  ← koffi FFI
   ↓
libtransport.so / .dylib / .dll          ← proprietary C binary in TransportDLL/
   ↓
USB HID device
```

- **Transport:** `koffi` FFI (not node-hid) calls high-level C functions (`transport_set_key_image_stream`, etc.). The C binary handles all USB wire protocol; no reverse-engineering needed.
- **Image processing:** `sharp` maps PIL ops — rotation before resize, `flop()`/`flip()` for mirrors, in-memory `Buffer` (no temp files).
- **Async model:** Devices extend `EventEmitter`. `transport_read` runs on libuv thread pool via `koffi.async()` and delivers callbacks on the main thread. Heartbeat via `setInterval`. Hotplug via 2s polling in `DeviceManager`.
- **Platform:** `platformLoader.ts` selects the correct C binary for OS/arch/glibc. `wchar_t` width branches on `process.platform` (4 bytes on Linux/macOS, 2 on Windows). K1Pro input events use byte offsets `[10,11]` instead of `[9,10]`.
- If running >4 devices simultaneously, set `UV_THREADPOOL_SIZE=16`.

Key files:
| File | Purpose |
|---|---|
| `src/DeviceManager.ts` | `enumerate()` + `startHotplug()` |
| `src/transport/LibUSBHIDAPI.ts` | koffi FFI wrapper (~35 C functions) |
| `src/devices/StreamDock.ts` | Abstract base class |
| `src/types/ProductIDs.ts` | VID/PID registry → device class map |
| `src/types/InputTypes.ts` | `InputEvent`, `EventType`, key/knob enums |
| `src/imageHelpers/imageHelper.ts` | `toNativeFormat()` via sharp |

### web-client

The UI communicates exclusively with the Python backend (`:9002`); it does not import `mirabox-client` directly.

- **Vite proxy:** `/api/*` → `http://localhost:9002`, `/ws` → `ws://localhost:9002`
- **API client:** `openapi-fetch` typed against `src/api/schema.d.ts` (generated from backend). Regenerate with `bun run generate` while the backend is running.
- **State:** `useStreamDock()` manages the WebSocket connection (auto-reconnect every 2s), device list, and input events. `useN4State()` parses events into button/knob/touch state for the N4 visualization.
- **Layout:** 3-pane — left (device list + controls), center (N4 virtual device with Konva canvas keys), right (event log, max 200 entries).
- **React Compiler:** enabled via `babel-plugin-react-compiler` (auto-memoization; impacts build performance).
- **Tailwind CSS v4** via `@tailwindcss/vite`. Path alias `@/` → `src/`.

Key files:
| File | Purpose |
|---|---|
| `src/App.tsx` | Root layout |
| `src/hooks/useStreamDock.ts` | WebSocket + device state |
| `src/hooks/useN4State.ts` | N4 button/knob/touch state |
| `src/api/client.ts` | OpenAPI fetch client |
| `src/components/DeviceCard.tsx` | Per-device controls |
| `src/panels/N4Panel.tsx` | N4 virtual device composition |
| `server.ts` | Headless Konva renderer (Node.js, outputs PNG frames) |

## Development Flow

1. Start the Python backend (exposes `:9002` REST + WebSocket + `/openapi.json`)
2. Optionally regenerate API types: `cd packages/web-client && bun run generate`
3. `cd packages/web-client && bun run dev`
