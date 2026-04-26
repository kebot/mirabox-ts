/**
 * StreamDock input event type system
 */

export const enum EventType {
  BUTTON = 'button',
  TOUCH = 'touch',
  KNOB_ROTATE = 'knob_rotate',
  KNOB_PRESS = 'knob_press',
  SWIPE = 'swipe',
  UNKNOWN = 'unknown',
}

export const enum ButtonKey {
  KEY_1 = 1,
  KEY_2 = 2,
  KEY_3 = 3,
  KEY_4 = 4,
  KEY_5 = 5,
  KEY_6 = 6,
  KEY_7 = 7,
  KEY_8 = 8,
  KEY_9 = 9,
  KEY_10 = 10,
  KEY_11 = 11,
  KEY_12 = 12,
  KEY_13 = 13,
  KEY_14 = 14,
  KEY_15 = 15,
  KEY_16 = 16,
  KEY_17 = 17,
  KEY_18 = 18,
  KEY_19 = 19,
  KEY_20 = 20,
  KEY_21 = 21,
  KEY_22 = 22,
  KEY_23 = 23,
  KEY_24 = 24,
  KEY_25 = 25,
  KEY_26 = 26,
  KEY_27 = 27,
  KEY_28 = 28,
  KEY_29 = 29,
  KEY_30 = 30,
  KEY_31 = 31,
  KEY_32 = 32,
}

export const enum TouchKey {
  TOUCH_1 = 'touch_1',
  TOUCH_2 = 'touch_2',
  TOUCH_3 = 'touch_3',
  TOUCH_4 = 'touch_4',
}

export const enum KnobId {
  KNOB_1 = 'knob_1',
  KNOB_2 = 'knob_2',
  KNOB_3 = 'knob_3',
  KNOB_4 = 'knob_4',
}

export const enum Direction {
  LEFT = 'left',
  RIGHT = 'right',
}

export interface InputEvent {
  eventType: EventType
  key?: ButtonKey
  touchKey?: TouchKey
  knobId?: KnobId
  direction?: Direction
  state?: 0 | 1
}

export interface DeviceInfo {
  path: string
  vendor_id: number
  product_id: number
  serial_number: string
  manufacturer_string: string
  product_string: string
  release_number: number
  usage_page: number
  usage: number
  interface_number: number
}
