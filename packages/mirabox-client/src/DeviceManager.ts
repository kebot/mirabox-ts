import { LibUSBHIDAPI } from './transport/LibUSBHIDAPI'
import { PRODUCT_REGISTRY } from './types/ProductIDs'
import { StreamDock } from './devices/StreamDock'

export class DeviceManager {
  private devices: StreamDock[] = []
  private hotplugTimer?: ReturnType<typeof setInterval>

  async enumerate(): Promise<StreamDock[]> {
    this.devices = []
    for (const [vid, pid, DeviceClass] of PRODUCT_REGISTRY) {
      const found = await LibUSBHIDAPI.enumerateDevicesAsync(vid, pid)
      for (const devInfo of found) {
        const transport = new LibUSBHIDAPI(devInfo)
        this.devices.push(new DeviceClass(transport, devInfo))
      }
    }
    return this.devices
  }

  startHotplug(
    onAdd: (device: StreamDock) => void,
    onRemove: (path: string) => void,
  ): void {
    let knownPaths = new Set(this.devices.map((d) => d.path))

    this.hotplugTimer = setInterval(() => {
      void (async () => {
        const currentPaths = new Set<string>()
        const newDevices: StreamDock[] = []

        for (const [vid, pid, DeviceClass] of PRODUCT_REGISTRY) {
          const found = await LibUSBHIDAPI.enumerateDevicesAsync(vid, pid)
          for (const devInfo of found) {
            currentPaths.add(devInfo.path)
            if (!knownPaths.has(devInfo.path)) {
              const transport = new LibUSBHIDAPI(devInfo)
              const device = new DeviceClass(transport, devInfo)
              this.devices.push(device)
              newDevices.push(device)
            }
          }
        }

        for (const device of newDevices) {
          onAdd(device)
        }

        for (const path of knownPaths) {
          if (!currentPaths.has(path)) {
            this.devices = this.devices.filter((d) => d.path !== path)
            onRemove(path)
          }
        }

        knownPaths = currentPaths
      })()
    }, 2000)

    if (this.hotplugTimer.unref) this.hotplugTimer.unref()
  }

  stopHotplug(): void {
    if (this.hotplugTimer) {
      clearInterval(this.hotplugTimer)
      this.hotplugTimer = undefined
    }
  }

  getDevices(): StreamDock[] {
    return this.devices
  }
}
