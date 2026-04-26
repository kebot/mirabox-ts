import sharp from 'sharp'

export interface GifFrame {
  image: Buffer
  delayMs: number
}

const MIN_DELAY_MS = 33

export async function loadGifFramesFromUrl(url: string): Promise<GifFrame[]> {
  const startTotal = performance.now()

  const fetchStart = performance.now()
  const response = await fetch(url)
  const fetchMs = performance.now() - fetchStart
  console.log(`[timing] fetch gif: ${fetchMs.toFixed(2)}ms`)
  if (!response.ok) {
    throw new Error(`Failed to fetch GIF: ${response.status} ${response.statusText}`)
  }

  const readBodyStart = performance.now()
  const gifBuffer = Buffer.from(await response.arrayBuffer())
  const readBodyMs = performance.now() - readBodyStart
  console.log(`[timing] read gif body: ${readBodyMs.toFixed(2)}ms (${gifBuffer.length} bytes)`)

  const metadataStart = performance.now()
  const metadata = await sharp(gifBuffer, { animated: true }).metadata()
  const metadataMs = performance.now() - metadataStart
  console.log(`[timing] probe gif metadata: ${metadataMs.toFixed(2)}ms`)

  const pages = metadata.pages ?? 1
  const delays = metadata.delay ?? []
  const frames: GifFrame[] = []

  const decodeStart = performance.now()
  for (let i = 0; i < pages; i++) {
    const oneFrameStart = performance.now()
    const frame = await sharp(gifBuffer, { animated: true, page: i, pages: 1 })
      .png()
      .toBuffer()

    const delayMs = normalizeDelay(delays[i] ?? delays[0] ?? 100)
    frames.push({ image: frame, delayMs })
    console.log(`[timing] decode frame ${i + 1}/${pages}: ${(performance.now() - oneFrameStart).toFixed(2)}ms | size=${frame.length} | delay=${delayMs}ms`)
  }
  const decodeMs = performance.now() - decodeStart
  console.log(`[timing] decode all frames: ${decodeMs.toFixed(2)}ms`)

  if (frames.length === 0) {
    throw new Error('GIF decode produced zero frames')
  }

  console.log(`[timing] loadGifFramesFromUrl total: ${(performance.now() - startTotal).toFixed(2)}ms`)
  return frames
}

function normalizeDelay(delayMs: number): number {
  if (!Number.isFinite(delayMs) || delayMs <= 0) return 100
  return Math.max(MIN_DELAY_MS, Math.round(delayMs))
}
