import HID from 'node-hid'
import { DeviceInfo } from '../types/InputTypes'

/**
 * HID reports must be fixed-width for these devices.
 * Pad with zeros so each write is exactly reportId + packetSize bytes.
 */
function pad(buf: number[], totalLen: number): number[] {
  while (buf.length < totalLen) buf.push(0x00)
  return buf
}

// Common command prefix for Mirabox protocol: "CRT\0\0"
// (report-id byte is prepended dynamically by _withReportId()).
const CRT = [0x43, 0x52, 0x54, 0x00, 0x00]

function toLowHigh(len: number): [number, number] {
  return [(len >> 8) & 0xff, len & 0xff]
}

function clampByte(value: number): number {
  return value & 0xff
}

export class LibUSBHIDAPI {
  private _hid: HID.HIDAsync | null = null
  private _isOpen = false
  private _packetSize = 512
  private _reportId = 0x00
  private _deviceInfo: DeviceInfo | null = null
  private _keyImageBatchDepth = 0
  private _keyImageBatchDirty = false
  private _flushPromise: Promise<void> = Promise.resolve()

  constructor(deviceInfo?: DeviceInfo) {
    this._deviceInfo = deviceInfo ?? null
  }

  private _withReportId(payload: number[]): number[] {
    return [this._reportId, ...payload]
  }

  private _writeExtended(payload: number[]): Promise<number> {
    if (!this._hid) return Promise.resolve(0)
    return this._hid.write(pad(this._withReportId(payload), 1 + this._packetSize))
  }

  private _writeCRT(...suffix: number[]): void {
    void this._writeExtended([...CRT, ...suffix])
  }

  /**
   * Generic image-stream sender used by background/special-image commands.
   * Flow: send header (command + payload length + extra args), stream payload in
   * packet-sized chunks, then send STP to commit/refresh.
   */
  private async _sendImageStream(command: [number, number, number], imageData: Buffer, ...extraHeader: number[]): Promise<number> {
    if (!this._hid) return -1

    const len = imageData.length
    const reportLen = 1 + this._packetSize
    const [lenHi, lenLo] = toLowHigh(len)
    const writes: Promise<number>[] = []

    writes.push(this._writeExtended([...CRT, ...command, 0x00, 0x00, lenHi, lenLo, ...extraHeader.map(clampByte)]))

    let offset = 0
    while (offset < len) {
      const chunkLen = Math.min(this._packetSize, len - offset)
      const chunk = this._withReportId(Array.from(imageData.slice(offset, offset + chunkLen)))
      writes.push(this._hid.write(pad(chunk, reportLen)))
      offset += chunkLen
    }

    await Promise.allSettled(writes)
    await this._writeExtended([...CRT, 0x53, 0x54, 0x50])
    return 0
  }

  private async _streamRawBuffer(data: Buffer): Promise<void> {
    if (!this._hid) return

    const reportLen = 1 + this._packetSize
    let offset = 0
    while (offset < data.length) {
      const chunkLen = Math.min(this._packetSize, data.length - offset)
      const chunk = this._withReportId(Array.from(data.slice(offset, offset + chunkLen)))
      await this._hid.write(pad(chunk, reportLen))
      offset += chunkLen
    }
  }

  async open(devicePath: string): Promise<boolean> {
    if (this._isOpen) {
      console.warn('[WARNING] Device already open')
      return false
    }
    try {
      this._hid = await HID.HIDAsync.open(devicePath)
      this._hid.pause()
      this._isOpen = true
      return true
    } catch (err) {
      console.error(`[ERROR] Failed to open device: ${err}`)
      return false
    }
  }

  async close(): Promise<void> {
    if (!this._hid) return
    try { await this._hid.close() } catch { /* ignore */ }
    this._hid = null
    this._isOpen = false
    this._keyImageBatchDepth = 0
    this._keyImageBatchDirty = false
    this._flushPromise = Promise.resolve()
  }

  async getFirmwareVersion(): Promise<string> {
    if (!this._hid) return ''
    try {
      const buf = await this._hid.getFeatureReport(0x01, 20)
      if (!buf || buf.length === 0) return ''
      const start = buf[0] === 0x01 ? 1 : 0
      const end = buf.indexOf(0, start)
      return buf.slice(start, end === -1 ? undefined : end).toString('utf-8')
    } catch {
      return ''
    }
  }

  canWrite(): boolean { return this._isOpen }

  clearTaskQueue(): void { /* no-op */ }

  // One async read operation; callers re-schedule to build a continuous read loop.
  readAsync(timeoutMs: number, cb: (data: Buffer | null) => void): void {
    if (!this._hid) { cb(null); return }
    void this._hid.read(timeoutMs > 0 ? timeoutMs : undefined).then(
      (data) => cb(data && data.length > 0 ? data : null),
      () => cb(null),
    )
  }

  wakeupScreen(): void { this._writeCRT(0x44, 0x49, 0x53) }
  refreshScreen(): void { this._writeCRT(0x53, 0x54, 0x50) }
  sleep(): void { this._writeCRT(0x48, 0x41, 0x4e) }

  magneticCalibration(): void { /* no-op */ }

  setKeyBrightness(brightness: number): void {
    this._writeCRT(0x4c, 0x49, 0x47, 0x00, 0x00, brightness & 0xff)
  }

  clearAllKeys(): void {
    this._writeCRT(0x43, 0x4c, 0x45, 0x00, 0x00, 0x00, 0xff)
    this._writeCRT(0x53, 0x54, 0x50)
  }

  clearKey(keyIndex: number): void {
    this._writeCRT(0x43, 0x4c, 0x45, 0x00, 0x00, 0x00, (keyIndex + 1) & 0xff)
  }

  /**
   * Send a JPEG payload to one key.
   * Uses BAT header + chunked payload writes. When batching is active, STP is
   * deferred until flushKeyImageBatch() so multiple keys can be committed once.
   */
  async setKeyImageStream(jpegData: Buffer, keyIndex: number): Promise<number> {
    if (!this._hid) return -1

    const len = jpegData.length


    const reportLen = 1 + this._packetSize
    const writes: Promise<number>[] = []

    writes.push(this._writeExtended([...CRT, 0x42, 0x41, 0x54, 0x00, 0x00, (len >> 8) & 0xff, len & 0xff, (keyIndex + 1) & 0xff]))

    let offset = 0
    while (offset < len) {
      const chunkLen = Math.min(this._packetSize, len - offset)
      const chunk = this._withReportId(Array.from(jpegData.slice(offset, offset + chunkLen)))
      writes.push(this._hid.write(pad(chunk, reportLen)))
      offset += chunkLen
    }

    if (this._keyImageBatchDepth > 0) {
      this._keyImageBatchDirty = true
      this._flushPromise = this._flushPromise.then(async () => {
        await Promise.allSettled(writes)
      })
      return 0
    }

    await Promise.allSettled(writes)
    await this._writeExtended([...CRT, 0x53, 0x54, 0x50])
    return 0
  }

  beginKeyImageBatch(): void {
    this._keyImageBatchDepth += 1
  }

  isKeyImageBatchActive(): boolean {
    return this._keyImageBatchDepth > 0
  }

  /**
   * Ends one batch scope; only the outermost scope actually flushes.
   * Waits for queued key-image writes, then sends one STP commit.
   */
  async flushKeyImageBatch(): Promise<number> {
    if (this._keyImageBatchDepth <= 0) return 0
    this._keyImageBatchDepth -= 1
    if (this._keyImageBatchDepth > 0) return 0
    if (!this._keyImageBatchDirty) return 0

    const debug = process.env.MIRABOX_DEBUG_FLUSH === '1'
    const waitStart = debug ? performance.now() : 0
    await this._flushPromise
    const waitMs = debug ? performance.now() - waitStart : 0

    this._flushPromise = Promise.resolve()
    this._keyImageBatchDirty = false

    const stpStart = debug ? performance.now() : 0
    await this._writeExtended([...CRT, 0x53, 0x54, 0x50])
    const stpMs = debug ? performance.now() - stpStart : 0

    if (debug) {
      console.log(`[timing] flushKeyImageBatch waitWrites=${waitMs.toFixed(2)}ms stp=${stpMs.toFixed(2)}ms total=${(waitMs + stpMs).toFixed(2)}ms`)
    }

    return 0
  }

  cancelKeyImageBatch(): void {
    this._keyImageBatchDepth = 0
    this._keyImageBatchDirty = false
    this._flushPromise = Promise.resolve()
  }

  // Send full-screen background image with device-side timeout metadata.
  setBackgroundImageStream(jpegData: Buffer, timeoutMs = 3000): void {
    void this._sendImageStream([0x42, 0x47, 0x49], jpegData, clampByte(timeoutMs >> 8), clampByte(timeoutMs))
  }

  // Send a JPEG frame to a rectangular region/layer on the background framebuffer.
  setBackgroundFrameStream(jpegData: Buffer, width: number, height: number, x = 0, y = 0, fbLayer = 0x00): void {
    const [wHi, wLo] = toLowHigh(width)
    const [hHi, hLo] = toLowHigh(height)
    void this._sendImageStream(
      [0x42, 0x47, 0x46],
      jpegData,
      clampByte(fbLayer),
      clampByte(x),
      clampByte(y),
      wHi,
      wLo,
      hHi,
      hLo,
    )
  }

  clearBackgroundFrameStream(position = 0x03): void {
    this._writeCRT(0x46, 0x43, 0x4c, 0x00, 0x00, clampByte(position))
  }

  // Legacy BMP-style path: send header first, stream raw bytes, then STP commit.
  setBackgroundBitmap(bitmapData: Buffer, timeoutMs = 5000): void {
    const [lenHi, lenLo] = toLowHigh(bitmapData.length)
    this._writeCRT(0x42, 0x4d, 0x50, 0x00, 0x00, lenHi, lenLo, clampByte(timeoutMs >> 8), clampByte(timeoutMs))
    void (async () => {
      await this._streamRawBuffer(bitmapData)
      await this._writeExtended([...CRT, 0x53, 0x54, 0x50])
    })()
  }

  setN1SkinBitmap(jpegData: Buffer, skinMode: number, skinPage: number, skinStatus: number, keyIndex: number, timeoutMs = 3000): void {
    void this._sendImageStream(
      [0x4e, 0x31, 0x42],
      jpegData,
      clampByte(skinMode),
      clampByte(skinPage),
      clampByte(skinStatus),
      clampByte(keyIndex),
      clampByte(timeoutMs >> 8),
      clampByte(timeoutMs),
    )
  }

  setLedBrightness(brightness: number): void {
    this._writeCRT(0x4c, 0x42, 0x4c, 0x49, 0x47, brightness & 0xff)
  }

  setLedColor(_count: number, r: number, g: number, b: number): void {
    this._writeCRT(0x53, 0x45, 0x54, 0x4c, 0x42, r & 0xff, g & 0xff, b & 0xff)
  }

  resetLedColor(): number { return 0 }

  setKeyboardBacklightBrightness(_brightness: number): void { /* stub */ }
  setKeyboardLightingEffects(_effect: number): void { /* stub */ }
  setKeyboardLightingSpeed(_speed: number): void { /* stub */ }
  setKeyboardRgbBacklight(_red: number, _green: number, _blue: number): void { /* stub */ }
  keyboardOsModeSwitch(_osMode: number): void { /* stub */ }

  setDeviceConfig(configs: number[]): void {
    this._writeCRT(0x43, 0x46, 0x47, 0x00, 0x00, ...configs.map(clampByte))
  }

  changeMode(mode: number): void {
    this._writeCRT(0x4d, 0x4f, 0x44, 0x00, 0x00, 0x30 + (mode & 0xff))
  }

  changePage(page: number): void {
    this._writeCRT(0x50, 0x41, 0x47, 0x00, 0x00, clampByte(page))
  }

  setReportId(reportId: number): void {
    this._reportId = reportId
  }

  getReportId(): number {
    return this._reportId
  }

  // HID sizes include report-id byte; internal packetSize tracks payload bytes only.
  setReportSize(inputSize: number, outputSize: number, _featureSize: number): void {
    this._packetSize = (outputSize > 0 ? outputSize : inputSize) - 1
  }

  heartbeat(): void {
    this._writeCRT(0x43, 0x4f, 0x4e, 0x4e, 0x45, 0x43, 0x54)
  }

  notifyDisconnected(): void {
    this._writeCRT(0x43, 0x4c, 0x45, 0x00, 0x00, 0x44, 0x43)
    this._writeCRT(0x48, 0x41, 0x4e)
  }

  getLastError(): string { return '' }
  getLastErrorInfo(): Record<string, unknown> { return {} }

  static disableOutput(_disable = true): void { /* no-op */ }

  /**
   * Enumerate HID nodes for a VID/PID and keep the interface used for input.
   * usagePage/usage filter mirrors prior behavior and avoids non-input endpoints.
   */
  static async enumerateDevicesAsync(vendorId: number, productId: number): Promise<DeviceInfo[]> {
    const all = await HID.devicesAsync(vendorId, productId)
    return all
      .filter((d) => (d.usagePage ?? 0) > 1025 && d.usage === 1)
      .map((d) => ({
        path: d.path ?? '',
        vendor_id: d.vendorId,
        product_id: d.productId,
        serial_number: d.serialNumber ?? '',
        manufacturer_string: d.manufacturer ?? '',
        product_string: d.product ?? '',
        release_number: d.release ?? 0,
        usage_page: d.usagePage ?? 0,
        usage: d.usage ?? 0,
        interface_number: d.interface ?? 0,
      }))
  }

  get inputReportSize(): number { return this._packetSize + 1 }
  get outputReportSize(): number { return this._packetSize + 1 }
  get featureReportSize(): number { return 0 }
}
