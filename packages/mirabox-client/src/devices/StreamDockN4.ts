import { StreamDock, ImageRenderOptions, SetKeyImageOptions } from './StreamDock'
import { InputEvent, ButtonKey, EventType, KnobId, Direction, TouchKey, DeviceInfo } from '../types/InputTypes'
import { DeviceType } from '../types/FeatureOption'
import { ImageFormat } from '../imageHelpers/imageHelper'
import { LibUSBHIDAPI } from '../transport/LibUSBHIDAPI'

const IMAGE_KEY_MAP = new Map<ButtonKey, number>([
  // row1
  [ButtonKey.KEY_1, 10], [ButtonKey.KEY_2, 11], [ButtonKey.KEY_3, 12], [ButtonKey.KEY_4, 13], [ButtonKey.KEY_5, 14],
  // row2
  [ButtonKey.KEY_6, 5], [ButtonKey.KEY_7, 6], [ButtonKey.KEY_8, 7],  [ButtonKey.KEY_9, 8],  [ButtonKey.KEY_10, 9],
  // touch keys
  [ButtonKey.KEY_11, 0],  [ButtonKey.KEY_12, 1], [ButtonKey.KEY_13, 2], [ButtonKey.KEY_14, 3],
])

export class StreamDockN4 extends StreamDock {
  KEY_COUNT = 14

  constructor(transport: LibUSBHIDAPI, devInfo: DeviceInfo) { super(transport, devInfo) }

  setDevice(): void {
    this.transport.setReportSize(513, 1025, 0)
    this.featureOption.deviceType = DeviceType.DockN4
  }

  getImageKey(logicalKey: ButtonKey): number {
    const hw = IMAGE_KEY_MAP.get(logicalKey)
    if (hw === undefined) throw new Error(`StreamDockN4: unsupported key ${logicalKey}`)
    return hw
  }

  decodeInputEvent(hwCode: number, state: 0 | 1): InputEvent {
    switch (hwCode) {
      // physical keys
      case 0x01:
        return { eventType: EventType.BUTTON, key: ButtonKey.KEY_1, state }
      case 0x02:
        return { eventType: EventType.BUTTON, key: ButtonKey.KEY_2, state }
      case 0x03:
        return { eventType: EventType.BUTTON, key: ButtonKey.KEY_3, state }
      case 0x04:
        return { eventType: EventType.BUTTON, key: ButtonKey.KEY_4, state }
      case 0x05:
        return { eventType: EventType.BUTTON, key: ButtonKey.KEY_5, state }
      case 0x06:
        return { eventType: EventType.BUTTON, key: ButtonKey.KEY_6, state }
      case 0x07:
        return { eventType: EventType.BUTTON, key: ButtonKey.KEY_7, state }
      case 0x08:
        return { eventType: EventType.BUTTON, key: ButtonKey.KEY_8, state }
      case 0x09:
        return { eventType: EventType.BUTTON, key: ButtonKey.KEY_9, state }
      case 0x0A:
        return { eventType: EventType.BUTTON, key: ButtonKey.KEY_10, state }

      // touch keys
      case 0x40:
        return { eventType: EventType.TOUCH, touchKey: TouchKey.TOUCH_1, state }
      case 0x41:
        return { eventType: EventType.TOUCH, touchKey: TouchKey.TOUCH_2, state }
      case 0x42:
        return { eventType: EventType.TOUCH, touchKey: TouchKey.TOUCH_3, state }
      case 0x43:
        return { eventType: EventType.TOUCH, touchKey: TouchKey.TOUCH_4, state }

      // touch screen swipe
      case 0x38:
        return { eventType: EventType.SWIPE, direction: Direction.RIGHT }
      case 0x39:
        return { eventType: EventType.SWIPE, direction: Direction.LEFT }

      // knob press
      case 0x37:
        return { eventType: EventType.KNOB_PRESS, knobId: KnobId.KNOB_1, state }
      case 0x35:
        return { eventType: EventType.KNOB_PRESS, knobId: KnobId.KNOB_2, state }
      case 0x33:
        return { eventType: EventType.KNOB_PRESS, knobId: KnobId.KNOB_3, state }
      case 0x36:
        return { eventType: EventType.KNOB_PRESS, knobId: KnobId.KNOB_4, state }

      // knob rotation
      case 0xA0:
        return { eventType: EventType.KNOB_ROTATE, knobId: KnobId.KNOB_1, direction: Direction.LEFT }
      case 0xA1:
        return { eventType: EventType.KNOB_ROTATE, knobId: KnobId.KNOB_1, direction: Direction.RIGHT }
      case 0x50:
        return { eventType: EventType.KNOB_ROTATE, knobId: KnobId.KNOB_2, direction: Direction.LEFT }
      case 0x51:
        return { eventType: EventType.KNOB_ROTATE, knobId: KnobId.KNOB_2, direction: Direction.RIGHT }
      case 0x90:
        return { eventType: EventType.KNOB_ROTATE, knobId: KnobId.KNOB_3, direction: Direction.LEFT }
      case 0x91:
        return { eventType: EventType.KNOB_ROTATE, knobId: KnobId.KNOB_3, direction: Direction.RIGHT }
      case 0x70:
        return { eventType: EventType.KNOB_ROTATE, knobId: KnobId.KNOB_4, direction: Direction.LEFT }
      case 0x71:
        return { eventType: EventType.KNOB_ROTATE, knobId: KnobId.KNOB_4, direction: Direction.RIGHT }

      // unknown event
      default:
        return { eventType: EventType.UNKNOWN }
    }
  }

  secondscreenImageFormat(): ImageFormat { return { size: [176, 112], format: 'JPEG', rotation: 180, flip: [false, false] } }

  async setKeyImage(key: number | ButtonKey, source: Buffer | string, options?: SetKeyImageOptions): Promise<number> {
    const logicalKey = key as ButtonKey
    const hwKey = this.getImageKey(logicalKey)
    const isSecondScreen = logicalKey >= ButtonKey.KEY_11 && logicalKey <= ButtonKey.KEY_14
    const fmt = isSecondScreen ? this.secondscreenImageFormat() : this.keyImageFormat()
    return this.setKeyImageWithFormat(hwKey, source, fmt, options)
  }

  async setTouchscreenImage(source: Buffer | string, options?: ImageRenderOptions): Promise<number> {
    return this.setTouchscreenImageWithFormat(source, this.touchscreenImageFormat(), options)
  }

  setBrightness(percent: number): void { this.transport.setKeyBrightness(percent) }

  keyImageFormat(): ImageFormat { return { size: [112, 112], format: 'JPEG', rotation: 180, flip: [false, false] } }
  touchscreenImageFormat(): ImageFormat { return { size: [800, 480], format: 'JPEG', rotation: 180, flip: [false, false] } }
}
