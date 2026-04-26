# StreamDock HID Protocol — Low-Level Reference

## 1. Physical Transport

All communication is USB HID. Both clients use a wrapper over `hidapi`/`libusb`:

| Client | Library |
|--------|---------|
| TypeScript (`mirabox-client`) | `node-hid` (npm) |
| Rust (`mirajazz-rust-client`) | `async-hid` crate |

No custom kernel driver. The device exposes a standard HID interface. During enumeration, valid interfaces require `usagePage > 1025` and `usage === 1`.

---

## 2. HID Report Frame

Every write to the device is a fixed-size HID output report:

```
┌─────────────┬──────────────────────────────────────────┐
│  Report ID  │  Payload (zero-padded to packetSize)      │
│   1 byte    │  512 or 1024 bytes                        │
└─────────────┴──────────────────────────────────────────┘
  Total: 513 or 1025 bytes
```

**Packet sizes by device family:**

| Device | Total Report | Payload |
|--------|-------------|---------|
| StreamDock293 | 513 | 512 |
| N3, N4, N4Pro, N1, K1Pro, M3, XL | 1025 | 1024 |

**Report ID:**
- `0x00` — all devices (default)
- `0x04` — K1Pro only (set explicitly at device open)

---

## 3. Command Prefix — "CRT"

Every command begins with a 5-byte prefix:

```
Bytes 0–2: 0x43 0x52 0x54  →  ASCII "CRT"
Bytes 3–4: 0x00 0x00       →  reserved
```

Full command frame layout (before zero-padding):

```
[ReportID] [C R T 0x00 0x00] [CMD[0] CMD[1] CMD[2]] [command-specific payload...]
   byte 0       bytes 1–5          bytes 6–8                bytes 9+
```

---

## 4. Command Table

| Command | ASCII | Hex | Purpose | Extra bytes after CMD |
|---------|-------|-----|---------|----------------------|
| **DIS** | DIS | `44 49 53` | Wake / show screen | — |
| **HAN** | HAN | `48 41 4E` | Sleep / blank screen | — |
| **STP** | STP | `53 54 50` | Refresh / commit display | — |
| **LIG** | LIG | `4C 49 47` | Set key brightness | `00 00 00 <brightness>` |
| **CLE** | CLE | `43 4C 45` | Clear key(s) | `00 00 00 <keyIdx\|0xFF>` |
| **BAT** | BAT | `42 41 54` | Send key image | `00 00 <lenHi> <lenLo> <keyIdx>` |
| **BGI** | BGI | `42 47 49` | Full background JPEG | `00 00 <lenHi> <lenLo> <toHi> <toLo>` |
| **BGF** | BGF | `42 47 46` | Background frame buffer | `<layer> <x> <y> <wHi> <wLo> <hHi> <hLo>` |
| **BMP** | BMP | `42 4D 50` | Background bitmap (legacy) | `00 00 <lenHi> <lenLo> <toHi> <toLo>` |
| **FCL** | FCL | `46 43 4C` | Frame clear | `00 00 <position>` |
| **N1B** | N1B | `4E 31 42` | N1 skin bitmap | `<mode> <page> <status> <key> <toHi> <toLo>` |
| **MOD** | MOD | `4D 4F 44` | Change mode | `00 00 <0x30+mode>` |
| **PAG** | PAG | `50 41 47` | Change page | `00 00 <page>` |
| **CFG** | CFG | `43 46 47` | Device config | `00 00 <config_bytes…>` |
| **LBLIG** | LBLIG | `4C 42 4C 49 47` | LED brightness (5-byte cmd) | `<brightness>` |
| **SETLB** | SETLB | `53 45 54 4C 42` | Set LED RGB colors (5-byte cmd) | `<r1 g1 b1 r2 g2 b2 …>` |
| **CONNECT** | CONNECT | `43 4F 4E 4E 45 43 54` | Heartbeat keep-alive (7-byte cmd) | — |
| **DISCONNECT** | DISCONNECT | `43 4C 45 00 00 44 43` | Notify clean disconnect | — |

Length values are big-endian 16-bit: `lenHi = (n >> 8) & 0xFF`, `lenLo = n & 0xFF`.

---

## 5. Key Image Transfer (BAT)

Sending an image to one key is a multi-report sequence.

### Step 1 — BAT header report

```
Byte  0: Report ID (0x00)
Bytes 1–5: CRT prefix (43 52 54 00 00)
Bytes 6–8: 0x42 0x41 0x54  ("BAT")
Bytes 9–10: 0x00 0x00  (padding)
Byte 11: lenHi  (JPEG byte count, high byte)
Byte 12: lenLo  (JPEG byte count, low byte)
Byte 13: keyIndex + 1  (hardware key index is 0-based; protocol adds 1)
Bytes 14…: 0x00 padding to fill report
```

### Step 2 — image data chunk reports

Split the raw JPEG buffer into chunks of `packetSize` bytes. Each chunk is a separate report:

```
Byte 0: Report ID (0x00)
Bytes 1…packetSize: JPEG chunk data (zero-padded if last chunk is short)
```

### Step 3 — STP commit report

After all chunks are sent, send an STP command to commit to the display:

```
Byte 0: Report ID
Bytes 1–5: CRT prefix
Bytes 6–8: 0x53 0x54 0x50  ("STP")
Bytes 9…: 0x00 padding
```

---

## 6. Image Formats by Device

Key images are JPEG (quality 90), processed through a rotate → resize → flip pipeline before transmission.

**Key images:**

| Device | Key size | Rotation |
|--------|----------|----------|
| StreamDockN4 / N4Pro (buttons) | 112×112 | 180° |
| StreamDockN4Pro (touch keys) | 176×112 | 180° |
| StreamDockN3 / K1Pro | 64×64 | −90° |
| StreamDockN1 | 96×96 | 0° |
| StreamDock293 | 100×100 | 180° |

**Background / full-panel images:**

| Device | Size | Rotation |
|--------|------|----------|
| N3 | 320×240 | −90° |
| N4 / N4Pro | 800×480 | 180° |
| N1 | 480×854 | 0° |

---

## 7. Input Event Reading

Input is read via async `hid.read()` with a 100ms timeout. The device sends variable-length HID input reports.

### ACK prefix (protocol v1+)

Protocol v1 and above prefix every valid input report with three bytes:

```
0x41 0x43 0x4B  →  ASCII "ACK"
```

Protocol v0 (legacy firmware, no serial number) omits this prefix.

### Payload byte layout

```
Most devices:
  arr[9]  → hardware code  (identifies which key/knob fired)
  arr[10] → state code     (0x01 = pressed, 0x00 = released)

K1Pro only:
  arr[10] → hardware code
  arr[11] → state code
```

Reports shorter than 10 bytes are discarded. Reports where `arr[9] === 0xFF` are write-confirm acknowledgements and are skipped.

### Protocol v3 dual-state

Protocol v3 devices report both press and release in one packet (`arr[10]` carries state). Earlier versions (v1/v2) only report keydown; the driver injects a synthetic keyup.

---

## 8. Hardware Code Maps

### StreamDockN4

**Physical keys:** `0x01`–`0x0A` (10 buttons)  
**Touch keys:** `0x40`–`0x43` (4 secondary screen touch areas)

**Knob rotation:**
```
KNOB_1: 0xA0 (CCW)  0xA1 (CW)
KNOB_2: 0x50 (CCW)  0x51 (CW)
KNOB_3: 0x90 (CCW)  0x91 (CW)
KNOB_4: 0x70 (CCW)  0x71 (CW)
```

**Knob press:** `0x37` / `0x35` / `0x33` / `0x36`  
**Swipe gestures:** `0x38` (right), `0x39` (left)

### StreamDockN3

**Keys:** `0x01`–`0x09` (9 buttons)  
**Knob rotation:** `0x90/0x91`, `0x60/0x61`, `0x50/0x51`  
**Knob press:** `0x33` / `0x34` / `0x35`

### K1Pro

**Keys (non-sequential mapping):**
```
0x05 → KEY_1   0x03 → KEY_2   0x01 → KEY_3
0x06 → KEY_4   0x04 → KEY_5   0x02 → KEY_6
```

**Knob press:** `0x25` / `0x30` / `0x31`  
**Knob rotation:** `0x50/0x51`, `0x60/0x61`, `0x90/0x91`

### StreamDockN1

**Keys:** `0x01`–`0x0F` + `0x1E` + `0x1F` (17 buttons)  
**Knob rotation:** `0x32` (CCW), `0x33` (CW)  
**Knob press:** `0x23`

---

## 9. Device Initialization Sequence

```
1. Open HID device by path
2. hid.pause()                →  enable non-blocking async reads
3. getFeatureReport(0x01, 20) →  read firmware version string
                                 (skipped on Windows in Rust client)
4. Send DIS  →  wake screen
5. Send LIG  →  set brightness (default 100)
6. Send CLE  →  clear all keys
7. Send STP  →  flush / refresh display
8. Start async read loop (100ms poll)
9. Start heartbeat timer (CONNECT every N seconds)
```

---

## 10. Batch Flush Optimization

To avoid redundant STP commands when updating many keys at once, the TypeScript client supports batching:

```
beginKeyImageBatch()
  setKeyImage(0, img)   ← queued, no STP yet
  setKeyImage(1, img)   ← queued, no STP yet
  setKeyImage(2, img)   ← queued, no STP yet
flushKeyImageBatch()    ← waits for all writes, then sends STP once
```

The depth counter allows nesting; only the outermost `flushKeyImageBatch()` call sends STP.

---

## 11. Firmware Version Read

```
Feature report ID: 0x01
Buffer length:     20 bytes
Content:           UTF-8 firmware version string (e.g. "V1.0.2")
```

Read once at open time. Used to infer the protocol version.

---

## 12. Protocol Version Summary

| Version | Packet size | ACK prefix | State reporting | Notes |
|---------|------------|-----------|----------------|-------|
| v0 | 512 | none | keydown only | Legacy firmware, no serial |
| v1 | 512 | ACK | keydown only | Serial `355499441494` |
| v2 | 1024 | ACK | keydown only | Valid serial |
| v3 | 1024 | ACK | press + release | Full state in single packet |

Version is inferred from the serial number string read at enumeration time.
