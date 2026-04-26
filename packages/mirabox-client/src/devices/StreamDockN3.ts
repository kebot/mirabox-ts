import { StreamDock, ImageRenderOptions, SetKeyImageOptions } from './StreamDock'
import { InputEvent, ButtonKey, EventType, KnobId, Direction, DeviceInfo } from '../types/InputTypes'
import { DeviceType } from '../types/FeatureOption'
import { ImageFormat } from '../imageHelpers/imageHelper'
import { LibUSBHIDAPI } from '../transport/LibUSBHIDAPI'

const IMAGE_KEY_MAP = new Map<ButtonKey, number>([
  [ButtonKey.KEY_1, 1], [ButtonKey.KEY_2, 2], [ButtonKey.KEY_3, 3],
  [ButtonKey.KEY_4, 4], [ButtonKey.KEY_5, 5], [ButtonKey.KEY_6, 6],
  [ButtonKey.KEY_7, 0x25], [ButtonKey.KEY_8, 0x30], [ButtonKey.KEY_9, 0x31],
])
const HW_TO_LOGICAL = new Map([...IMAGE_KEY_MAP.entries()].map(([k, v]) => [v, k]))

const KNOB_ROTATE_MAP = new Map<number, [KnobId, Direction]>([
  [0x90, [KnobId.KNOB_1, Direction.LEFT]],  [0x91, [KnobId.KNOB_1, Direction.RIGHT]],
  [0x60, [KnobId.KNOB_2, Direction.LEFT]],  [0x61, [KnobId.KNOB_2, Direction.RIGHT]],
  [0x50, [KnobId.KNOB_3, Direction.LEFT]],  [0x51, [KnobId.KNOB_3, Direction.RIGHT]],
])
const KNOB_PRESS_MAP = new Map<number, KnobId>([
  [0x33, KnobId.KNOB_1], [0x34, KnobId.KNOB_2], [0x35, KnobId.KNOB_3],
])

export class StreamDockN3 extends StreamDock {
  KEY_COUNT = 18

  constructor(transport: LibUSBHIDAPI, devInfo: DeviceInfo) { super(transport, devInfo) }

  setDevice(): void {
    this.transport.setReportSize(513, 1025, 0)
    this.featureOption.deviceType = DeviceType.DockN3
  }

  getImageKey(logicalKey: ButtonKey): number {
    const hw = IMAGE_KEY_MAP.get(logicalKey)
    if (hw === undefined) throw new Error(`StreamDockN3: unsupported key ${logicalKey}`)
    return hw
  }

  decodeInputEvent(hwCode: number, state: number): InputEvent {
    const normalizedState = state === 0x01 ? 1 : 0
    const key = HW_TO_LOGICAL.get(hwCode)
    if (key !== undefined) return { eventType: EventType.BUTTON, key, state: normalizedState as 0 | 1 }
    const rotate = KNOB_ROTATE_MAP.get(hwCode)
    if (rotate) return { eventType: EventType.KNOB_ROTATE, knobId: rotate[0], direction: rotate[1] }
    const knob = KNOB_PRESS_MAP.get(hwCode)
    if (knob !== undefined) return { eventType: EventType.KNOB_PRESS, knobId: knob, state: normalizedState as 0 | 1 }
    return { eventType: EventType.UNKNOWN }
  }

  async setKeyImage(key: number | ButtonKey, source: Buffer | string, options?: SetKeyImageOptions): Promise<number> {
    const hwKey = this.getImageKey(key as ButtonKey)
    if (hwKey < 1 || hwKey > 9) return -1
    return this.setKeyImageWithFormat(hwKey, source, this.keyImageFormat(), options)
  }

  async setTouchscreenImage(source: Buffer | string, options?: ImageRenderOptions): Promise<number> {
    return this.setTouchscreenImageWithFormat(source, this.touchscreenImageFormat(), options)
  }

  setBrightness(percent: number): void { this.transport.setKeyBrightness(percent) }

  keyImageFormat(): ImageFormat { return { size: [64, 64], format: 'JPEG', rotation: -90, flip: [false, false] } }
  touchscreenImageFormat(): ImageFormat { return { size: [320, 240], format: 'JPEG', rotation: -90, flip: [false, false] } }
}
