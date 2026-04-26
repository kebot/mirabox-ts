import { DeviceManager } from './DeviceManager'
import { StreamDock } from './devices/StreamDock'
import { StreamDockN4Pro } from './devices/StreamDockN4Pro'
import { StreamDockXL } from './devices/StreamDockXL'
import { StreamDockM3 } from './devices/StreamDockM3'
import { StreamDockN1, N1DeviceMode } from './devices/StreamDockN1'
import { K1Pro } from './devices/K1Pro'
import { InputEvent, EventType } from './types/InputTypes'

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function keyCallback(device: StreamDock, event: InputEvent): void {
  try {
    switch (event.eventType) {
      case EventType.BUTTON: {
        const action = event.state === 1 ? 'pressed' : 'released'
        console.log(`Key ${event.key} ${action}`)
        break
      }
      case EventType.KNOB_ROTATE:
        console.log(`Knob ${event.knobId} rotated ${event.direction}`)
        break
      case EventType.KNOB_PRESS: {
        const action = event.state === 1 ? 'pressed' : 'released'
        console.log(`Knob ${event.knobId} ${action}`)
        break
      }
      case EventType.TOUCH: {
        const action = event.state === 1 ? 'pressed' : 'released'
        console.log(`Touch ${event.touchKey} ${action}`)
        break
      }
      case EventType.SWIPE:
        console.log(`Swipe gesture: ${event.direction}`)
        break
    }
  } catch (err) {
    console.error('Key callback error:', err)
  }
}

async function main(): Promise<void> {
  await sleep(500)

  const manager = new DeviceManager()
  const devices = await manager.enumerate()

  if (devices.length === 0) {
    console.log('No Stream Dock device found')
    return
  }

  // Hotplug listener
  manager.startHotplug(
    (device) => {
      void (async () => {
        console.log(`[add] path: ${device.path}`)
        await device.open()
        await device.init()
        device.on('input', keyCallback)
      })()
    },
    (path) => {
      console.log(`[remove] path: ${path}`)
    },
  )

  console.log(`Found ${devices.length} Stream Dock(s).\n`)

  for (const device of devices) {
    try {
      await device.open()
      await device.init()
    } catch (err) {
      console.error(`Failed to open device: ${err}`)
      throw err
    }

    console.log(
      `path: ${device.path}\nfirmware_version: ${device.firmwareVersion}\nserial_number: ${device.serialNumber}`,
    )

    device.refresh()
    await sleep(2000)

    // Device-specific setup
    if (device instanceof StreamDockN4Pro) {
      device.setLedBrightness(100)
      device.setLedColor(0, 0, 255)
      await device.setFrameBackground('../img/backgroud_test2.png')
      await sleep(2000)
    } else if (device instanceof StreamDockXL) {
      await device.setFrameBackground('../img/backgroud_test2.png')
      await sleep(2000)
    } else if (device instanceof K1Pro) {
      device.setKeyboardBacklightBrightness(6)
      device.setKeyboardLightingSpeed(3)
      device.setKeyboardLightingEffects(0) // static
      device.setKeyboardRgbBacklight(255, 0, 0)
      device.keyboardOsModeSwitch(0) // windows mode
    } else if (device instanceof StreamDockN1) {
      device.switchMode(N1DeviceMode.KEYBOARD)
      for (let page = 1; page <= 5; page++) {
        device.changePage(page)
        await sleep(1000)
      }
      device.switchMode(N1DeviceMode.CALCULATOR)
      for (let page = 1; page <= 5; page++) {
        device.changePage(page)
        await sleep(1000)
      }
      device.switchMode(N1DeviceMode.DOCK)
      device.refresh()
    }

    if (device instanceof StreamDockM3) {
      await device.setFrameBackground('../img/backgroud_test2.png')
      await sleep(2000)
    }

    // Set key images
    for (let i = 1; i <= 18; i++) {
      try {
        await device.setKeyImage(i, '../img/button_test.jpg')
        device.refresh()
      } catch {
        // key out of range for this device — skip
      }
    }

    device.on('input', keyCallback)
  }

  console.log('Program is running, press Ctrl+C to exit...')

  await new Promise<void>((resolve) => {
    process.on('SIGINT', resolve)
    process.on('SIGTERM', resolve)
  })

  console.log('\nShutting down devices...')
  manager.stopHotplug()

  for (const device of [...devices].reverse()) {
    try {
      device.removeAllListeners('input')
      await sleep(100)
      await device.close()
      console.log(`Device ${device.path} closed`)
    } catch (err) {
      console.error(`Error closing device: ${err}`)
    }
  }

  await sleep(200)
  console.log('Program exited')
}

main().catch((err) => {
  console.error('Uncaught exception:', err)
  process.exit(1)
})
