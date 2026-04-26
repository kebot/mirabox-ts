import { StreamDock, ImageRenderOptions, SetKeyImageOptions } from './StreamDock'
import { InputEvent, ButtonKey, EventType, KnobId, Direction, DeviceInfo } from '../types/InputTypes'
import { DeviceType } from '../types/FeatureOption'
import { ImageFormat } from '../imageHelpers/imageHelper'
import { LibUSBHIDAPI } from '../transport/LibUSBHIDAPI'

const IMAGE_KEY_MAP = new Map<ButtonKey, number>([
  [ButtonKey.KEY_1, 1],   [ButtonKey.KEY_2, 2],   [ButtonKey.KEY_3, 3],
  [ButtonKey.KEY_4, 4],   [ButtonKey.KEY_5, 5],   [ButtonKey.KEY_6, 6],
  [ButtonKey.KEY_7, 7],   [ButtonKey.KEY_8, 8],   [ButtonKey.KEY_9, 9],
  [ButtonKey.KEY_10, 10], [ButtonKey.KEY_11, 11], [ButtonKey.KEY_12, 12],
  [ButtonKey.KEY_13, 13], [ButtonKey.KEY_14, 14], [ButtonKey.KEY_15, 15],
  [ButtonKey.KEY_16, 0x1E],[ButtonKey.KEY_17, 0x1F],
])
const HW_TO_LOGICAL = new Map([...IMAGE_KEY_MAP.entries()].map(([k, v]) => [v, k]))

const KNOB_ROTATE_MAP = new Map<number, [KnobId, Direction]>([
  [0x32, [KnobId.KNOB_1, Direction.LEFT]],
  [0x33, [KnobId.KNOB_1, Direction.RIGHT]],
])
const KNOB_PRESS_MAP = new Map<number, KnobId>([[0x23, KnobId.KNOB_1]])

export const enum N1DeviceMode { KEYBOARD = 0, CALCULATOR = 1, DOCK = 2 }
export const enum N1SkinMode { KEYBOARD = 0x11, KEYBOARD_LOCK = 0x1F, CALCULATOR = 0xFF }
export const enum N1SkinStatus { PRESS = 0, RELEASE = 1 }

export class StreamDockN1 extends StreamDock {
  KEY_COUNT = 20

  constructor(transport: LibUSBHIDAPI, devInfo: DeviceInfo) { super(transport, devInfo) }

  async open(): Promise<void> {
    await super.open()
    this.transport.changeMode(2) // Dock mode
  }

  setDevice(): void {
    this.transport.setReportSize(513, 1025, 0)
    this.featureOption.deviceType = DeviceType.DockN1
  }

  getImageKey(logicalKey: ButtonKey): number {
    const hw = IMAGE_KEY_MAP.get(logicalKey)
    if (hw === undefined) throw new Error(`StreamDockN1: unsupported key ${logicalKey}`)
    return hw
  }

  decodeInputEvent(hwCode: number, state: number): InputEvent {
    const rotate = KNOB_ROTATE_MAP.get(hwCode)
    if (rotate) return { eventType: EventType.KNOB_ROTATE, knobId: rotate[0], direction: rotate[1] }
    const normalizedState = state === 0x01 ? 1 : 0
    const knob = KNOB_PRESS_MAP.get(hwCode)
    if (knob !== undefined) return { eventType: EventType.KNOB_PRESS, knobId: knob, state: normalizedState as 0 | 1 }
    const key = HW_TO_LOGICAL.get(hwCode)
    if (key !== undefined) return { eventType: EventType.BUTTON, key, state: normalizedState as 0 | 1 }
    return { eventType: EventType.UNKNOWN }
  }

  secondscreenImageFormat(): ImageFormat { return { size: [80, 80], format: 'JPEG', rotation: 0, flip: [false, false] } }

  async setKeyImage(key: number | ButtonKey, source: Buffer | string, options?: SetKeyImageOptions): Promise<number> {
    const logicalKey = key as ButtonKey
    const hwKey = this.getImageKey(logicalKey)
    const isSecondScreen = logicalKey >= ButtonKey.KEY_16 && logicalKey <= ButtonKey.KEY_17
    const fmt = isSecondScreen ? this.secondscreenImageFormat() : this.keyImageFormat()
    return this.setKeyImageWithFormat(hwKey, source, fmt, options)
  }

  async setTouchscreenImage(source: Buffer | string, options?: ImageRenderOptions): Promise<number> {
    return this.setTouchscreenImageWithFormat(source, this.touchscreenImageFormat(), options)
  }

  setBrightness(percent: number): void { this.transport.setKeyBrightness(percent) }

  switchMode(mode: N1DeviceMode): void { this.transport.changeMode(mode) }
  changePage(page: number): void { this.transport.changePage(page) }

  async setN1SkinBitmap(
    source: Buffer | string,
    skinMode: N1SkinMode,
    skinPage: number,
    skinStatus: N1SkinStatus,
    keyIndex: number,
    options?: ImageRenderOptions,
  ): Promise<number> {
    const isSecondScreen = skinMode === N1SkinMode.KEYBOARD && keyIndex >= 16 && keyIndex <= 18
    const fmt = isSecondScreen ? this.secondscreenImageFormat() : this.keyImageFormat()
    return this.setN1SkinWithFormat(source, fmt, skinMode, skinPage, skinStatus, keyIndex, options)
  }

  keyImageFormat(): ImageFormat { return { size: [96, 96], format: 'JPEG', rotation: 0, flip: [false, false] } }
  touchscreenImageFormat(): ImageFormat { return { size: [480, 854], format: 'JPEG', rotation: 0, flip: [false, false] } }
}
