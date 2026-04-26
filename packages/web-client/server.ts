/**
 * server.ts — Konva server-side rendering demo
 *
 * react-konva's <Stage> creates a DOM div internally, so it cannot run in
 * Node.js without a jsdom shim. Konva's Node.js build (konva/lib/index-node)
 * bypasses this by using the 'canvas' npm package for headless rendering.
 *
 * This script mirrors the SpecialKey.tsx animation and writes 60 PNG frames
 * (2 s at 30 fps) to ./frames/.
 *
 * Run: bun server.ts
 */

// canvas-backend patches Konva to use the 'canvas' npm package for headless rendering
import 'konva/canvas-backend'
import Konva from 'konva'
import fs from 'fs'
import path from 'path'

const W = 112
const H = 112

// ── Build scene (mirrors SpecialKey.tsx) ─────────────────────────────────────

const stage = new Konva.Stage({ width: W, height: H })
const layer = new Konva.Layer()
stage.add(layer)

const bg = new Konva.Rect({
  x: 0, y: 0, width: W, height: H,
  fill: '#0a1432',
})

const trail = new Konva.Arc({
  x: 56, y: 56,
  innerRadius: 36, outerRadius: 42,
  angle: 200,
  fill: 'rgba(59,130,246,0.25)',
})

const arc = new Konva.Arc({
  x: 56, y: 56,
  innerRadius: 36, outerRadius: 42,
  angle: 120,
  fill: '#3b82f6',
  shadowBlur: 10,
  shadowColor: '#3b82f6',
  shadowOpacity: 0.8,
})

const label = new Konva.Text({
  text: 'M',
  fontSize: 28,
  fontStyle: 'bold',
  fill: 'white',
  x: 0, y: 0,
  width: W, height: H,
  align: 'center',
  verticalAlign: 'middle',
})

layer.add(bg, trail, arc, label)

// ── Render frames ─────────────────────────────────────────────────────────────

const FRAMES = 60          // 2 seconds at 30 fps
const FPS = 30
const outDir = path.join(import.meta.dir, 'frames')
fs.mkdirSync(outDir, { recursive: true })

for (let i = 0; i < FRAMES; i++) {
  const t = i * (1000 / FPS)  // simulated time in ms

  arc.rotation(t * 0.3 % 360)
  trail.rotation(t * 0.3 % 360 - 30)

  const pulse = (Math.sin(t * 0.002) + 1) / 2
  const r = Math.round(10 + pulse * 20)
  const g = Math.round(20 + pulse * 25)
  const b = Math.round(50 + pulse * 80)
  bg.fill(`rgb(${r},${g},${b})`)

  layer.draw()

  const base64 = stage.toDataURL({ pixelRatio: 1 }).split(',')[1]
  const file = path.join(outDir, `frame-${String(i).padStart(3, '0')}.png`)
  fs.writeFileSync(file, Buffer.from(base64, 'base64'))
}

console.log(`Rendered ${FRAMES} frames → ${outDir}`)
