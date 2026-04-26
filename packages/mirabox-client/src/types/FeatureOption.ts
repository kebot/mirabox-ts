export const enum DeviceType {
  Universal = 0,
  Dock293 = 1,
  Dock293V3 = 2,
  Dock293s = 3,
  Dock293sV3 = 4,
  DockM3 = 5,
  DockM18 = 6,
  DockN1 = 7,
  DockN3 = 8,
  DockN4 = 9,
  DockN4Pro = 10,
  DockXL = 11,
  K1Pro = 12,
}

export class FeatureOption {
  hasRGBLed = false
  ledCounts = 0
  supportConfig = false
  supportBackgroundImage = true
  deviceType = DeviceType.Universal
}
