import type { GifFrame } from './gifFrames'

export interface PlaybackController {
  stop: () => void
  done: Promise<void>
}

interface PlaybackOptions {
  onFrame: (frame: GifFrame, frameIndex: number) => Promise<void>
  debugTiming?: boolean
}

export function startPlayback(frames: GifFrame[], options: PlaybackOptions): PlaybackController {
  let stopped = false

  const done = (async () => {
    let frameIndex = 0
    let nextDue = Date.now()

    while (!stopped) {
      const loopStart = performance.now()
      const frame = frames[frameIndex]

      const onFrameStart = performance.now()
      await options.onFrame(frame, frameIndex)
      const onFrameMs = performance.now() - onFrameStart

      nextDue += frame.delayMs
      let nextFrameIndex = (frameIndex + 1) % frames.length

      const now = Date.now()
      let sleepMs = 0
      let skipped = 0

      if (now < nextDue) {
        sleepMs = nextDue - now
        await sleep(sleepMs)
      } else {
        while (now > nextDue && !stopped) {
          nextDue += frames[nextFrameIndex].delayMs
          nextFrameIndex = (nextFrameIndex + 1) % frames.length
          skipped += 1
        }
      }

      if (options.debugTiming) {
        console.log(
          `[timing] scheduler frame=${frameIndex} | targetDelay=${frame.delayMs}ms | onFrame=${onFrameMs.toFixed(2)}ms | sleep=${sleepMs.toFixed(2)}ms | skipped=${skipped} | loopTotal=${(performance.now() - loopStart).toFixed(2)}ms`,
        )
      }

      frameIndex = nextFrameIndex
    }
  })()

  return {
    stop: () => {
      stopped = true
    },
    done,
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
