import { StreamDock, ImageRenderOptions, SetKeyImageOptions } from './StreamDock'
import { InputEvent, ButtonKey, EventType, KnobId, Direction, DeviceInfo } from '../types/InputTypes'
import { DeviceType } from '../types/FeatureOption'
import { ImageFormat } from '../imageHelpers/imageHelper'
import { LibUSBHIDAPI } from '../transport/LibUSBHIDAPI'

const IMAGE_KEY_MAP = new Map<ButtonKey, number>([
  [ButtonKey.KEY_1, 0x05], [ButtonKey.KEY_2, 0x03], [ButtonKey.KEY_3, 0x01],
  [ButtonKey.KEY_4, 0x06], [ButtonKey.KEY_5, 0x04], [ButtonKey.KEY_6, 0x02],
])
const HW_TO_LOGICAL = new Map([...IMAGE_KEY_MAP.entries()].map(([k, v]) => [v, k]))

const KNOB_PRESS_MAP = new Map<number, KnobId>([
  [0x25, KnobId.KNOB_1], [0x30, KnobId.KNOB_2], [0x31, KnobId.KNOB_3],
])
const KNOB_ROTATE_MAP = new Map<number, [KnobId, Direction]>([
  [0x50, [KnobId.KNOB_1, Direction.LEFT]],  [0x51, [KnobId.KNOB_1, Direction.RIGHT]],
  [0x60, [KnobId.KNOB_2, Direction.LEFT]],  [0x61, [KnobId.KNOB_2, Direction.RIGHT]],
  [0x90, [KnobId.KNOB_3, Direction.LEFT]],  [0x91, [KnobId.KNOB_3, Direction.RIGHT]],
])

export class K1Pro extends StreamDock {
  KEY_COUNT = 6

  constructor(transport: LibUSBHIDAPI, devInfo: DeviceInfo) { super(transport, devInfo) }

  setDevice(): void {
    this.transport.setReportSize(513, 1025, 0)
    this.transport.setReportId(0x04)
    this.featureOption.deviceType = DeviceType.K1Pro
  }

  getImageKey(logicalKey: ButtonKey): number {
    const hw = IMAGE_KEY_MAP.get(logicalKey)
    if (hw === undefined) throw new Error(`K1Pro: unsupported key ${logicalKey}`)
    return hw
  }

  decodeInputEvent(hwCode: number, state: number): InputEvent {
    const normalizedState = state === 0x01 ? 1 : 0
    const key = HW_TO_LOGICAL.get(hwCode)
    if (key !== undefined) return { eventType: EventType.BUTTON, key, state: normalizedState as 0 | 1 }
    const knob = KNOB_PRESS_MAP.get(hwCode)
    if (knob !== undefined) return { eventType: EventType.KNOB_PRESS, knobId: knob, state: normalizedState as 0 | 1 }
    const rotate = KNOB_ROTATE_MAP.get(hwCode)
    if (rotate) return { eventType: EventType.KNOB_ROTATE, knobId: rotate[0], direction: rotate[1] }
    return { eventType: EventType.UNKNOWN }
  }

  protected supportsAnimatedTouchscreenImage(): boolean { return false }

  async setKeyImage(key: number | ButtonKey, source: Buffer | string, options?: SetKeyImageOptions): Promise<number> {
    return this.setKeyImageWithFormat(this.getImageKey(key as ButtonKey), source, this.keyImageFormat(), options)
  }

  // K1Pro has no touchscreen
  async setTouchscreenImage(_source: Buffer | string, _options?: ImageRenderOptions): Promise<number> { return 0 }

  setBrightness(percent: number): void { this.transport.setKeyBrightness(percent) }

  // Keyboard-specific controls
  setKeyboardBacklightBrightness(brightness: number): void {
    this.transport.setKeyboardBacklightBrightness(brightness)
  }

  setKeyboardLightingEffects(effect: number): void {
    if (effect === 0) this.setKeyboardLightingSpeed(0)
    this.transport.setKeyboardLightingEffects(effect)
  }

  setKeyboardLightingSpeed(speed: number): void {
    this.transport.setKeyboardLightingSpeed(speed)
  }

  setKeyboardRgbBacklight(red: number, green: number, blue: number): void {
    this.transport.setKeyboardRgbBacklight(red, green, blue)
  }

  keyboardOsModeSwitch(osMode: number): void {
    this.transport.keyboardOsModeSwitch(osMode)
  }

  keyImageFormat(): ImageFormat { return { size: [64, 64], format: 'JPEG', rotation: -90, flip: [false, false] } }
  touchscreenImageFormat(): ImageFormat { return { size: [800, 480], format: 'JPEG', rotation: 180, flip: [false, false] } }
}
