import sharp from 'sharp'
import fs from 'fs'

export interface ImageFormat {
  size: [number, number]
  format: 'JPEG'
  rotation: 0 | 90 | -90 | 180
  flip: [boolean, boolean]
}

export interface ImageInputOptions {
  animate?: boolean
  maxFrames?: number
  minFrameDelayMs?: number
}

export interface NativeImageFrames {
  frames: Buffer[]
  delaysMs: number[]
  isAnimatedSource: boolean
}

function targetSize(fmt: ImageFormat): [number, number] {
  return (fmt.rotation === 90 || fmt.rotation === -90)
    ? [fmt.size[1], fmt.size[0]]
    : [fmt.size[0], fmt.size[1]]
}

async function processToJpeg(input: Buffer, fmt: ImageFormat): Promise<Buffer> {
  const [targetW, targetH] = targetSize(fmt)

  let pipeline = sharp(input)

  if (fmt.rotation !== 0) {
    pipeline = pipeline.rotate(fmt.rotation)
  }

  pipeline = pipeline.resize(targetW, targetH, { fit: 'fill' })

  if (fmt.flip[0]) pipeline = pipeline.flop()  // FLIP_LEFT_RIGHT
  if (fmt.flip[1]) pipeline = pipeline.flip()  // FLIP_TOP_BOTTOM

  return pipeline.jpeg().toBuffer()
}

/**
 * Process an image to the device-native JPEG format.
 * Matches the Python PILHelper._to_native_format() behaviour exactly:
 *   1. Rotate (with canvas expansion for ±90°)
 *   2. Resize to target size
 *   3. Flip horizontally and/or vertically
 *   4. Convert to RGB JPEG
 */
export async function toNativeFormat(input: Buffer | string, fmt: ImageFormat): Promise<Buffer> {
  const src = typeof input === 'string' ? await fs.promises.readFile(input) : input
  return processToJpeg(src, fmt)
}

export async function toNativeFrames(input: Buffer | string, fmt: ImageFormat, options?: ImageInputOptions): Promise<NativeImageFrames> {
  const src = typeof input === 'string' ? await fs.promises.readFile(input) : input
  const animate = options?.animate ?? true
  const maxFrames = Math.max(1, options?.maxFrames ?? 120)
  const minFrameDelayMs = Math.max(0, options?.minFrameDelayMs ?? 16)

  const metadata = await sharp(src, { animated: true }).metadata()
  const pages = metadata.pages ?? 1
  const isAnimatedGif = metadata.format === 'gif' && pages > 1

  if (!isAnimatedGif || !animate) {
    const frame = await processToJpeg(src, fmt)
    return {
      frames: [frame],
      delaysMs: [0],
      isAnimatedSource: isAnimatedGif,
    }
  }

  const frameCount = Math.min(pages, maxFrames)
  const frames: Buffer[] = []
  const delaysMs: number[] = []

  for (let page = 0; page < frameCount; page += 1) {
    const frameInput = await sharp(src, { animated: true, page, pages: 1 }).toBuffer()
    frames.push(await processToJpeg(frameInput, fmt))

    const delay = metadata.delay?.[page] ?? metadata.delay?.[0] ?? 100
    delaysMs.push(Math.max(minFrameDelayMs, delay))
  }

  return {
    frames,
    delaysMs,
    isAnimatedSource: true,
  }
}
