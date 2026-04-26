import { DeviceManager, toNativeFormat } from 'mirabox-client'
import type { StreamDock, ImageFormat } from 'mirabox-client'
import { loadGifFramesFromUrl } from './gifFrames'
import { startPlayback } from './scheduler'

const GIF_URL = 'https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExNHcydjB4dW9ncnhpOHc2MG5qMDU3Nnc1emMyMXNjeWI0b3Q2NHR3YyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/GJACwlJbtiWrYeWoqM/giphy.gif'

async function main() {
  const { key, allKeys, timeslice, fps } = parseArgs(process.argv.slice(2))

  const manager = new DeviceManager()
  const enumerateStart = performance.now()
  const devices = await manager.enumerate()
  console.log(`[timing] enumerate devices: ${(performance.now() - enumerateStart).toFixed(2)}ms`)

  if (devices.length === 0) {
    console.error('No StreamDock devices found. Plug one in and try again.')
    process.exit(1)
  }

  const device = devices[0]

  const openStart = performance.now()
  await device.open()
  console.log(`[timing] device.open: ${(performance.now() - openStart).toFixed(2)}ms`)

  const initStart = performance.now()
  await device.init()
  console.log(`[timing] device.init: ${(performance.now() - initStart).toFixed(2)}ms`)

  console.log(`Connected: ${device.path}`)
  console.log(`Loading GIF: ${GIF_URL}`)
  const frames = await loadGifFramesFromUrl(GIF_URL)
  console.log(`Decoded ${frames.length} frames`)

  const resolveKeysStart = performance.now()
  const targetKeys = resolveTargetKeys(device, key, allKeys)
  console.log(`[timing] resolve target keys: ${(performance.now() - resolveKeysStart).toFixed(2)}ms`)
  console.log(`Rendering to keys: ${targetKeys.join(', ')}`)
  if (timeslice > 1) console.log(`Time-slicing enabled: ${timeslice} groups`)
  if (fps !== null) console.log(`FPS override: ${fps} (${(1000 / fps).toFixed(2)}ms/frame)`)

  const preEncodeStart = performance.now()
  const targetDelayMs = fps !== null ? 1000 / fps : null
  const preEncodedFrames = await preEncodeFramesForDevice(device, targetKeys, frames, targetDelayMs)
  console.log(`[timing] pre-encode native frames: ${(performance.now() - preEncodeStart).toFixed(2)}ms`)

  let fpsWindowStart = performance.now()
  let fpsWindowFrames = 0
  let phase = 0

  const playback = startPlayback(preEncodedFrames, {
    debugTiming: true,
    onFrame: async (frame, frameIndex) => {
      const tickStart = performance.now()
      const imageSize = frame.image.length

      // Time-slice: only update keys in the current phase group.
      const sliceKeys = targetKeys.filter((_, i) => i % timeslice === phase)
      phase = (phase + 1) % timeslice

      const writeStart = performance.now()
      const batch = sliceKeys.map((k) => ({ key: k, source: frame.image, options: { alreadyNative: true } }))

      device.setKeyImagesBatch(batch, { refresh: false })

      const writeMs = performance.now() - writeStart

      const elapsedMs = performance.now() - tickStart
      const instantFps = 1000 / Math.max(elapsedMs, 0.000001)

      console.log(`[image] frame=${frameIndex} bytes=${imageSize} keys=${sliceKeys.length} phase=${phase}`)

      fpsWindowFrames += 1
      const now = performance.now()
      const windowMs = now - fpsWindowStart
      if (windowMs >= 1000) {
        const avgFps = (fpsWindowFrames * 1000) / windowMs
        console.log(
          `[fps] avg=${avgFps.toFixed(2)} | instant=${instantFps.toFixed(2)} | frame=${frameIndex} | write=${writeMs.toFixed(2)}ms`,
        )
        fpsWindowFrames = 0
        fpsWindowStart = now
      }
    },
  })

  const shutdown = async () => {
    playback.stop()
    await playback.done.catch(() => undefined)
    await device.close()
    process.exit(0)
  }

  process.on('SIGINT', () => {
    void shutdown()
  })
  process.on('SIGTERM', () => {
    void shutdown()
  })

  await playback.done
}

function resolveTargetKeys(device: StreamDock, key: number, allKeys: boolean): number[] {
  if (allKeys) {
    return Array.from({ length: device.KEY_COUNT }, (_, i) => i + 1)
  }

  if (key < 1 || key > device.KEY_COUNT) {
    throw new Error(`key must be between 1 and ${device.KEY_COUNT}, got ${key}`)
  }

  return [key]
}

function parseArgs(args: string[]): { key: number; allKeys: boolean; timeslice: number; fps: number | null } {
  let key = 1
  let allKeys = false
  let timeslice = 1
  let fps: number | null = null

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--all-keys') {
      allKeys = true
      continue
    }
    if (arg === '--key') {
      const value = args[i + 1]
      if (!value) throw new Error('--key requires a numeric value')
      key = Number(value)
      if (!Number.isInteger(key)) throw new Error('--key must be an integer')
      i += 1
      continue
    }
    if (arg === '--timeslice') {
      const value = args[i + 1]
      if (!value) throw new Error('--timeslice requires a numeric value')
      timeslice = Number(value)
      if (!Number.isInteger(timeslice) || timeslice < 1) throw new Error('--timeslice must be a positive integer')
      i += 1
      continue
    }
    if (arg === '--fps') {
      const value = args[i + 1]
      if (!value) throw new Error('--fps requires a numeric value')
      fps = Number(value)
      if (!Number.isFinite(fps) || fps <= 0) throw new Error('--fps must be a positive number')
      i += 1
      continue
    }
  }

  return { key, allKeys, timeslice, fps }
}

async function preEncodeFramesForDevice(
  device: StreamDock,
  targetKeys: number[],
  frames: Array<{ image: Buffer; delayMs: number }>,
  targetDelayMs: number | null = null,
): Promise<Array<{ image: Buffer; delayMs: number }>> {
  if (targetKeys.length === 0) return frames

  const sampleKey = targetKeys[0]
  const format = resolveKeyFormat(device, sampleKey)

  const out: Array<{ image: Buffer; delayMs: number }> = []
  for (let i = 0; i < frames.length; i++) {
    const start = performance.now()
    const encoded = await toNativeFormat(frames[i].image, format)
    const delayMs = targetDelayMs ?? frames[i].delayMs
    out.push({ image: encoded, delayMs })
    console.log(`[timing] pre-encode frame ${i + 1}/${frames.length}: ${(performance.now() - start).toFixed(2)}ms | bytes=${encoded.length} | delay=${delayMs}ms`)
  }
  return out
}

function resolveKeyFormat(device: StreamDock, key: number): ImageFormat {
  const maybeSecondScreen = (device as unknown as { secondscreenImageFormat?: () => ImageFormat }).secondscreenImageFormat
  if (typeof maybeSecondScreen === 'function' && key >= 11 && key <= 14) {
    return maybeSecondScreen.call(device)
  }
  return device.keyImageFormat()
}

await main()
