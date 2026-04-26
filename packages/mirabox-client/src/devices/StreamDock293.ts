import { StreamDock, ImageRenderOptions, SetKeyImageOptions } from './StreamDock'
import { InputEvent, ButtonKey, EventType } from '../types/InputTypes'
import { DeviceType } from '../types/FeatureOption'
import { ImageFormat } from '../imageHelpers/imageHelper'
import { LibUSBHIDAPI } from '../transport/LibUSBHIDAPI'
import { DeviceInfo } from '../types/InputTypes'

const IMAGE_KEY_MAP = new Map<ButtonKey, number>([
  [ButtonKey.KEY_1, 11], [ButtonKey.KEY_2, 12], [ButtonKey.KEY_3, 13],
  [ButtonKey.KEY_4, 14], [ButtonKey.KEY_5, 15], [ButtonKey.KEY_6, 6],
  [ButtonKey.KEY_7, 7],  [ButtonKey.KEY_8, 8],  [ButtonKey.KEY_9, 9],
  [ButtonKey.KEY_10, 10],[ButtonKey.KEY_11, 1],  [ButtonKey.KEY_12, 2],
  [ButtonKey.KEY_13, 3], [ButtonKey.KEY_14, 4],  [ButtonKey.KEY_15, 5],
])
const HW_TO_LOGICAL = new Map([...IMAGE_KEY_MAP.entries()].map(([k, v]) => [v, k]))

export class StreamDock293 extends StreamDock {
  KEY_COUNT = 15

  constructor(transport: LibUSBHIDAPI, devInfo: DeviceInfo) { super(transport, devInfo) }

  setDevice(): void {
    this.transport.setReportSize(513, 513, 0)
    this.featureOption.deviceType = DeviceType.Dock293
  }

  getImageKey(logicalKey: ButtonKey): number {
    const hw = IMAGE_KEY_MAP.get(logicalKey)
    if (hw === undefined) throw new Error(`StreamDock293: unsupported key ${logicalKey}`)
    return hw
  }

  decodeInputEvent(hwCode: number, state: number): InputEvent {
    const normalizedState = state === 0x01 ? 1 : 0
    const key = HW_TO_LOGICAL.get(hwCode)
    if (key !== undefined) return { eventType: EventType.BUTTON, key, state: normalizedState as 0 | 1 }
    return { eventType: EventType.UNKNOWN }
  }

  protected supportsAnimatedTouchscreenImage(): boolean { return false }

  async setKeyImage(key: number | ButtonKey, source: Buffer | string, options?: SetKeyImageOptions): Promise<number> {
    const logicalKey = key as ButtonKey
    const hwKey = this.getImageKey(logicalKey)
    return this.setKeyImageWithFormat(hwKey, source, this.keyImageFormat(), options)
  }

  async setTouchscreenImage(source: Buffer | string, options?: ImageRenderOptions): Promise<number> {
    return this.setTouchscreenImageWithFormat(source, this.touchscreenImageFormat(), options)
  }

  setBrightness(percent: number): void { this.transport.setKeyBrightness(percent) }

  keyImageFormat(): ImageFormat { return { size: [100, 100], format: 'JPEG', rotation: 180, flip: [false, false] } }
  touchscreenImageFormat(): ImageFormat { return { size: [800, 480], format: 'JPEG', rotation: 180, flip: [false, false] } }
}
