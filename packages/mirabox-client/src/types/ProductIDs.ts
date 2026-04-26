import { StreamDock } from '../devices/StreamDock'
import { StreamDock293 } from '../devices/StreamDock293'
import { StreamDock293V3 } from '../devices/StreamDock293V3'
import { StreamDock293s } from '../devices/StreamDock293s'
import { StreamDock293sV3 } from '../devices/StreamDock293sV3'
import { StreamDockN3 } from '../devices/StreamDockN3'
import { StreamDockN4 } from '../devices/StreamDockN4'
import { StreamDockN4Pro } from '../devices/StreamDockN4Pro'
import { StreamDockN1 } from '../devices/StreamDockN1'
import { StreamDockXL } from '../devices/StreamDockXL'
import { StreamDockM18 } from '../devices/StreamDockM18'
import { StreamDockM3 } from '../devices/StreamDockM3'
import { K1Pro } from '../devices/K1Pro'
import { LibUSBHIDAPI } from '../transport/LibUSBHIDAPI'
import { DeviceInfo } from './InputTypes'

export type DeviceConstructor = new (transport: LibUSBHIDAPI, devInfo: DeviceInfo) => StreamDock

export const USB_VID = {
  V293: 0x5500,
  V293V3: 0x6603,
  V293s: 0x5548,
  VN3: 0x6603,
  VN3V2: 0xEEEF,
  VN3V25: 0x1500,
  VN3E: 0x6602,
  VN4: 0x6602,
  VN4EN: 0x6603,
  VN1EN: 0x6603,
  VN1: 0x6603,
  VN4PRO: 0x5548,
  VXL: 0x5548,
  VM18: 0x6603,
  VM3: 0x5548,
  VK1PRO: 0x6603,
}

export const USB_PID = {
  STREAMDOCK_293: 0x1001,
  STREAMDOCK_293V3: 0x1005,
  STREAMDOCK_293V3EN: 0x1006,
  STREAMDOCK_293V25: 0x1010,
  STREAMDOCK_293s: 0x6670,
  STREAMDOCK_293sV3: 0x1014,
  STREAMDOCK_N3: 0x1002,
  STREAMDOCK_N3EN: 0x1003,
  STREAMDOCK_N3V2: 0x2929,
  STREAMDOCK_N3V25: 0x3001,
  STREAMDOCK_N4: 0x1001,
  STREAMDOCK_N4EN: 0x1007,
  STREAMDOCK_N1EN: 0x1000,
  STREAMDOCK_N1: 0x1011,
  STREAMDOCK_N4PRO: 0x1008,
  STREAMDOCK_N4PROEN: 0x1021,
  STREAMDOCK_VSD_N4PRO: 0x1023,
  STREAMDOCK_XL: 0x1028,
  STREAMDOCK_XLEN: 0x1031,
  STREAMDOCK_M18: 0x1009,
  STREAMDOCK_M18EN: 0x1012,
  STREAMDOCK_M3: 0x1020,
  K1_PRO: 0x1015,
  K1_PROEU: 0x1019,
}

export const PRODUCT_REGISTRY: [number, number, DeviceConstructor][] = [
  // 293 series
  [USB_VID.V293,    USB_PID.STREAMDOCK_293,     StreamDock293],
  [USB_VID.V293V3,  USB_PID.STREAMDOCK_293V3,   StreamDock293V3],
  [USB_VID.V293V3,  USB_PID.STREAMDOCK_293V3EN,  StreamDock293V3],
  [USB_VID.V293V3,  USB_PID.STREAMDOCK_293V25,  StreamDock293V3],
  [USB_VID.V293s,   USB_PID.STREAMDOCK_293s,    StreamDock293s],
  [USB_VID.V293s,   USB_PID.STREAMDOCK_293sV3,  StreamDock293sV3],
  // N3
  [USB_VID.VN3,     USB_PID.STREAMDOCK_N3,      StreamDockN3],
  [USB_VID.VN3,     USB_PID.STREAMDOCK_N3EN,    StreamDockN3],
  [USB_VID.VN3E,    USB_PID.STREAMDOCK_N3,      StreamDockN3],
  [USB_VID.VN3E,    USB_PID.STREAMDOCK_N3EN,    StreamDockN3],
  [USB_VID.VN3E,    USB_PID.STREAMDOCK_N3V2,    StreamDockN3],
  [USB_VID.VN3V25,  USB_PID.STREAMDOCK_N3V25,   StreamDockN3],
  // N4
  [USB_VID.VN4,     USB_PID.STREAMDOCK_N4,      StreamDockN4],
  [USB_VID.VN4EN,   USB_PID.STREAMDOCK_N4EN,    StreamDockN4],
  // N1
  [USB_VID.VN1,     USB_PID.STREAMDOCK_N1,      StreamDockN1],
  [USB_VID.VN1EN,   USB_PID.STREAMDOCK_N1EN,    StreamDockN1],
  // N4Pro
  [USB_VID.VN4PRO,  USB_PID.STREAMDOCK_N4PRO,   StreamDockN4Pro],
  [USB_VID.VN4PRO,  USB_PID.STREAMDOCK_N4PROEN, StreamDockN4Pro],
  [USB_VID.VN4PRO,  USB_PID.STREAMDOCK_VSD_N4PRO, StreamDockN4Pro],
  // XL
  [USB_VID.VXL,     USB_PID.STREAMDOCK_XL,      StreamDockXL],
  [USB_VID.VXL,     USB_PID.STREAMDOCK_XLEN,    StreamDockXL],
  // M18
  [USB_VID.VM18,    USB_PID.STREAMDOCK_M18,     StreamDockM18],
  [USB_VID.VM18,    USB_PID.STREAMDOCK_M18EN,   StreamDockM18],
  // M3
  [USB_VID.VM3,     USB_PID.STREAMDOCK_M3,      StreamDockM3],
  // K1Pro
  [USB_VID.VK1PRO,  USB_PID.K1_PRO,             K1Pro],
  [USB_VID.VK1PRO,  USB_PID.K1_PROEU,           K1Pro],
]
