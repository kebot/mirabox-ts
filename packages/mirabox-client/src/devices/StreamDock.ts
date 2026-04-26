import { EventEmitter } from 'events'
import { InputEvent, DeviceInfo, ButtonKey, EventType } from '../types/InputTypes'
import { FeatureOption, DeviceType } from '../types/FeatureOption'
import { ImageFormat, toNativeFrames } from '../imageHelpers/imageHelper'
import { LibUSBHIDAPI } from '../transport/LibUSBHIDAPI'

export interface StreamDockEvents {
  input: [device: StreamDock, event: InputEvent]
  error: [err: Error]
  disconnected: []
}

export interface ImageRenderOptions {
  animate?: boolean
  maxFrames?: number
  minFrameDelayMs?: number
}

export interface SetKeyImageOptions extends ImageRenderOptions {
  alreadyNative?: boolean
}

export interface SetKeyImageBatchEntry {
  key: number | ButtonKey
  source: Buffer | string
  options?: SetKeyImageOptions
}

export interface SetKeyImageBatchOptions {
  refresh?: boolean
  continueOnError?: boolean
}

export interface SetKeyImageBatchResult {
  key: number | ButtonKey
  code: number
  error?: Error
}

export abstract class StreamDock extends EventEmitter {
  KEY_COUNT = 0

  readonly transport: LibUSBHIDAPI
  readonly vendorId: number
  readonly productId: number
  readonly path: string
  serialNumber: string
  firmwareVersion = ''

  featureOption: FeatureOption

  private _running = false
  private _heartbeatTimer?: ReturnType<typeof setTimeout>

  constructor(transport: LibUSBHIDAPI, devInfo: DeviceInfo) {
    super()
    this.transport = transport
    this.vendorId = devInfo.vendor_id
    this.productId = devInfo.product_id
    this.path = devInfo.path
    this.serialNumber = devInfo.serial_number ?? ''
    this.featureOption = new FeatureOption()
  }

  // ---- Abstract interface -----------------------------------------------

  abstract setDevice(): void
  abstract setKeyImage(
    key: number | ButtonKey,
    source: Buffer | string,
    options?: SetKeyImageOptions,
  ): Promise<number>
  abstract setBrightness(percent: number): void
  abstract setTouchscreenImage(source: Buffer | string, options?: ImageRenderOptions): Promise<number>
  abstract getImageKey(logicalKey: ButtonKey): number
  abstract decodeInputEvent(hardwareCode: number, state: number): InputEvent
  abstract keyImageFormat(): ImageFormat
  abstract touchscreenImageFormat(): ImageFormat

  // ---- Lifecycle ---------------------------------------------------------

  async open(): Promise<void> {
    const opened = await this.transport.open(this.path)
    if (!opened) {
      throw new Error(`Failed to open device at path: ${this.path}`)
    }
    this._running = true
    this._scheduleRead()
    // Delay heartbeat slightly so read loop can initialise
    setTimeout(() => this._startHeartbeat(), 100)
    if (process.platform === 'darwin') {
      this.firmwareVersion = await this.transport.getFirmwareVersion()
    }
  }

  async init(): Promise<void> {
    this.setDevice()
    this.wakeScreen()
    this.setBrightness(100)
    this.clearAllIcon()
    if (process.platform !== 'darwin') {
      this.firmwareVersion = await this.transport.getFirmwareVersion()
    }
    this.refresh()
  }

  async close(): Promise<void> {
    this._running = false
    if (this._heartbeatTimer) {
      clearInterval(this._heartbeatTimer)
      this._heartbeatTimer = undefined
    }
    try { this.transport.notifyDisconnected() } catch { /**/ }
    try { await this.transport.close() } catch { /**/ }
    this.emit('disconnected')
  }

  // ---- Controls ----------------------------------------------------------

  wakeScreen(): void { this.transport.wakeupScreen() }
  refresh(): void { this.transport.refreshScreen() }

  clearIcon(index: number): void {
    if (index < 1 || index > this.KEY_COUNT) {
      console.warn(`key '${index}' out of range (1 ~ ${this.KEY_COUNT})`)
      return
    }
    const logicalKey = index as ButtonKey
    const hwKey = this.getImageKey(logicalKey)
    this.transport.clearKey(hwKey)
  }

  clearAllIcon(): void { this.transport.clearAllKeys() }

  setLedBrightness(percent: number): void {
    if (this.featureOption.hasRGBLed) this.transport.setLedBrightness(percent)
  }

  setLedColor(r: number, g: number, b: number): void {
    if (this.featureOption.hasRGBLed) this.transport.setLedColor(this.featureOption.ledCounts, r, g, b)
  }

  resetLedEffect(): number | void {
    if (this.featureOption.hasRGBLed) return this.transport.resetLedColor()
  }

  async setKeyImagesBatch(
    entries: ReadonlyArray<SetKeyImageBatchEntry>,
    options: SetKeyImageBatchOptions = {},
  ): Promise<SetKeyImageBatchResult[]> {
    const continueOnError = options.continueOnError ?? true
    const results: SetKeyImageBatchResult[] = []

    this.transport.beginKeyImageBatch()
    try {
      for (const entry of entries) {
        try {
          const code = await this.setKeyImage(entry.key, entry.source, entry.options)
          results.push({ key: entry.key, code })
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error))
          results.push({ key: entry.key, code: -1, error: err })
          if (!continueOnError) throw err
        }
      }
    } finally {
      await this.transport.flushKeyImageBatch()
    }

    if (options.refresh) {
      this.refresh()
    }

    return results
  }

  setBackgroundImage(source: Buffer | string, options?: ImageRenderOptions): Promise<number> {
    return this.setTouchscreenImage(source, options)
  }

  protected supportsAnimatedKeyImage(): boolean { return true }
  protected supportsAnimatedTouchscreenImage(): boolean { return true }
  protected supportsAnimatedFrameBackground(): boolean { return true }
  protected supportsAnimatedN1SkinBitmap(): boolean { return true }

  protected async playProcessedFrames(
    frames: { frames: Buffer[]; delaysMs: number[] },
    send: (frame: Buffer) => Promise<number> | number,
    animate = true,
  ): Promise<number> {
    if (frames.frames.length === 0) return -1

    const count = animate ? frames.frames.length : 1
    let last = 0

    for (let i = 0; i < count; i += 1) {
      const code = await send(frames.frames[i])
      if (typeof code === 'number') last = code

      const delay = frames.delaysMs[i] ?? 0
      if (i < count - 1 && delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }

    return last
  }

  protected async setKeyImageWithFormat(
    key: number,
    source: Buffer | string,
    format: ImageFormat,
    options?: SetKeyImageOptions,
  ): Promise<number> {
    if (options?.alreadyNative && Buffer.isBuffer(source)) {
      return this.transport.setKeyImageStream(source, key)
    }

    const processed = await toNativeFrames(source, format, options)
    const animate = (options?.animate ?? true) && this.supportsAnimatedKeyImage()
    return this.playProcessedFrames(
      processed,
      async (frame) => this.transport.setKeyImageStream(frame, key),
      animate,
    )
  }

  protected async setTouchscreenImageWithFormat(
    source: Buffer | string,
    format: ImageFormat,
    options?: ImageRenderOptions,
  ): Promise<number> {
    const processed = await toNativeFrames(source, format, options)
    const animate = (options?.animate ?? true) && this.supportsAnimatedTouchscreenImage()
    return this.playProcessedFrames(
      processed,
      (frame) => {
        this.transport.setBackgroundImageStream(frame)
        return 0
      },
      animate,
    )
  }

  protected async setFrameBackgroundWithFormat(
    source: Buffer | string,
    format: ImageFormat,
    width: number,
    height: number,
    options?: ImageRenderOptions,
  ): Promise<number> {
    const processed = await toNativeFrames(source, format, options)
    const animate = (options?.animate ?? true) && this.supportsAnimatedFrameBackground()
    return this.playProcessedFrames(
      processed,
      (frame) => {
        this.transport.setBackgroundFrameStream(frame, width, height)
        return 0
      },
      animate,
    )
  }

  protected async setN1SkinWithFormat(
    source: Buffer | string,
    format: ImageFormat,
    skinMode: number,
    skinPage: number,
    skinStatus: number,
    keyIndex: number,
    options?: ImageRenderOptions,
  ): Promise<number> {
    const processed = await toNativeFrames(source, format, options)
    const animate = (options?.animate ?? true) && this.supportsAnimatedN1SkinBitmap()
    return this.playProcessedFrames(
      processed,
      (frame) => {
        this.transport.setN1SkinBitmap(frame, skinMode, skinPage, skinStatus, keyIndex)
        return 0
      },
      animate,
    )
  }

  getPath(): string { return this.path }
  id(): string { return this.path }
  getSerialNumber(): string { return this.serialNumber }

  // ---- Private: async read loop -----------------------------------------

  private _scheduleRead(): void {
    if (!this._running) return
    this.transport.readAsync(100, (data) => {
      if (data !== null && data.length >= 10) {
        this._handleRawData(data)
      }
      // Re-schedule immediately after completion
      this._scheduleRead()
    })
  }

  private _handleRawData(arr: Buffer): void {
    if (arr[9] === 0xff) return // write-confirm packet

    try {
      // K1Pro uses arr[10]/arr[11]; all others use arr[9]/arr[10]
      const hwCode = this.featureOption.deviceType === DeviceType.K1Pro ? arr[10] : arr[9]
      const stateCode = this.featureOption.deviceType === DeviceType.K1Pro ? arr[11] : arr[10]
      const event = this.decodeInputEvent(hwCode, stateCode)
      this.emit('input', this, event)
    } catch (err) {
      // decode errors are non-fatal
    }
  }

  // ---- Private: heartbeat ------------------------------------------------

  private _startHeartbeat(): void {
    // Initial 1-second delay before first heartbeat (matches Python's time.sleep(1.0))
    const startTimer = setTimeout(() => {
      this._heartbeatTimer = setInterval(() => {
        if (!this._running) return
        try { this.transport.heartbeat() } catch { /**/ }
      }, 10_000)
    }, 1_000)
    // Ensure the start timer doesn't prevent process exit
    if (startTimer.unref) startTimer.unref()
  }
}
