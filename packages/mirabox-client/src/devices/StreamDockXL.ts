import { StreamDock, ImageRenderOptions, SetKeyImageOptions } from './StreamDock'
import { InputEvent, ButtonKey, EventType, KnobId, Direction, DeviceInfo } from '../types/InputTypes'
import { DeviceType } from '../types/FeatureOption'
import { ImageFormat } from '../imageHelpers/imageHelper'
import { LibUSBHIDAPI } from '../transport/LibUSBHIDAPI'

const IMAGE_KEY_MAP = new Map<ButtonKey, number>([
  [ButtonKey.KEY_1, 25], [ButtonKey.KEY_2, 26], [ButtonKey.KEY_3, 27],
  [ButtonKey.KEY_4, 28], [ButtonKey.KEY_5, 29], [ButtonKey.KEY_6, 30],
  [ButtonKey.KEY_7, 31], [ButtonKey.KEY_8, 32], [ButtonKey.KEY_9, 17],
  [ButtonKey.KEY_10, 18],[ButtonKey.KEY_11, 19],[ButtonKey.KEY_12, 20],
  [ButtonKey.KEY_13, 21],[ButtonKey.KEY_14, 22],[ButtonKey.KEY_15, 23],
  [ButtonKey.KEY_16, 24],[ButtonKey.KEY_17, 9], [ButtonKey.KEY_18, 10],
  [ButtonKey.KEY_19, 11],[ButtonKey.KEY_20, 12],[ButtonKey.KEY_21, 13],
  [ButtonKey.KEY_22, 14],[ButtonKey.KEY_23, 15],[ButtonKey.KEY_24, 16],
  [ButtonKey.KEY_25, 1], [ButtonKey.KEY_26, 2], [ButtonKey.KEY_27, 3],
  [ButtonKey.KEY_28, 4], [ButtonKey.KEY_29, 5], [ButtonKey.KEY_30, 6],
  [ButtonKey.KEY_31, 7], [ButtonKey.KEY_32, 8],
])
const HW_TO_LOGICAL = new Map([...IMAGE_KEY_MAP.entries()].map(([k, v]) => [v, k]))

const KNOB_ROTATE_MAP = new Map<number, [KnobId, Direction]>([
  [0x23, [KnobId.KNOB_1, Direction.LEFT]],  [0x21, [KnobId.KNOB_1, Direction.RIGHT]],
  [0x24, [KnobId.KNOB_2, Direction.LEFT]],  [0x26, [KnobId.KNOB_2, Direction.RIGHT]],
])

export class StreamDockXL extends StreamDock {
  KEY_COUNT = 36

  constructor(transport: LibUSBHIDAPI, devInfo: DeviceInfo) { super(transport, devInfo) }

  setDevice(): void {
    this.transport.setReportSize(513, 1025, 0)
    this.featureOption.hasRGBLed = true
    this.featureOption.ledCounts = 6
    this.featureOption.deviceType = DeviceType.DockXL
  }

  getImageKey(logicalKey: ButtonKey): number {
    const hw = IMAGE_KEY_MAP.get(logicalKey)
    if (hw === undefined) throw new Error(`StreamDockXL: unsupported key ${logicalKey}`)
    return hw
  }

  decodeInputEvent(hwCode: number, state: number): InputEvent {
    const rotate = KNOB_ROTATE_MAP.get(hwCode)
    if (rotate) return { eventType: EventType.KNOB_ROTATE, knobId: rotate[0], direction: rotate[1] }
    const normalizedState = state === 0x01 ? 1 : 0
    const key = HW_TO_LOGICAL.get(hwCode)
    if (key !== undefined) return { eventType: EventType.BUTTON, key, state: normalizedState as 0 | 1 }
    return { eventType: EventType.UNKNOWN }
  }

  async setKeyImage(key: number | ButtonKey, source: Buffer | string, options?: SetKeyImageOptions): Promise<number> {
    const hwKey = this.getImageKey(key as ButtonKey)
    if (hwKey < 1 || hwKey > 32) return -1
    return this.setKeyImageWithFormat(hwKey, source, this.keyImageFormat(), options)
  }

  async setTouchscreenImage(source: Buffer | string, options?: ImageRenderOptions): Promise<number> {
    return this.setTouchscreenImageWithFormat(source, this.touchscreenImageFormat(), options)
  }

  async setFrameBackground(source: Buffer | string, options?: ImageRenderOptions): Promise<number> {
    return this.setFrameBackgroundWithFormat(source, this.touchscreenImageFormat(), 1024, 600, options)
  }

  setBrightness(percent: number): void { this.transport.setKeyBrightness(percent) }

  keyImageFormat(): ImageFormat { return { size: [80, 80], format: 'JPEG', rotation: 180, flip: [false, false] } }
  touchscreenImageFormat(): ImageFormat { return { size: [1024, 600], format: 'JPEG', rotation: 180, flip: [false, false] } }
}
