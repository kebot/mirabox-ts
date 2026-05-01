import React, { useState, useCallback } from 'react'
import { Rect, Text } from 'react-konva'
import { Key, Knob } from 'react-mirabox'
import { exec as _exec, execSync as _execSync } from 'child_process'

function exec(cmd: string) {
  console.log('[m1ddc]', cmd)
  return _exec(cmd)
}

function execSync(cmd: string, opts?: Parameters<typeof _execSync>[1]) {
  console.log('[m1ddc]', cmd)
  return _execSync(cmd, opts as never)
}
import type { Direction } from 'mirabox-client'

// ── m1ddc helpers ─────────────────────────────────────────────────────────────
// Requires: brew install m1ddc  (https://github.com/waydabber/m1ddc)

function listDisplays(): number[] {
  try {
    const out = execSync('m1ddc display list', { stdio: 'pipe' }).toString()
    console.log('[m1ddc] display list output:', out)
    // Try matching leading number ("1:" or "1 ") or "display N" anywhere in line
    const nums = [...out.matchAll(/^\[(\d+)\]/gm)].map((m) => parseInt(m[1]))
    const unique = [...new Set(nums)]
    console.log('[m1ddc] resolved displays:', unique)
    return unique.length > 0 ? unique : [1]
  } catch { return [1] }
}

function resolveDisplays(display: number | 'all'): number[] {
  return display === 'all' ? listDisplays() : [display]
}

function readLuminance(display: number | 'all'): number {
  // Read from the first resolved display as representative value
  const d = display === 'all' ? 1 : display
  try {
    const out = execSync(`m1ddc display ${d} get luminance`, { stdio: 'pipe' }).toString().trim()
    const n = parseInt(out)
    return isNaN(n) ? 50 : Math.max(0, Math.min(100, n))
  } catch { return 50 }
}


function applyAbsolute(value: number, display: number | 'all'): void {
  for (const d of resolveDisplays(display)) {
    exec(`m1ddc display ${d} set luminance ${value}`)
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export interface ScreenBrightnessProps {
  /** Knob index used for adjustment */
  knob: number
  /** Key index used for the display */
  keyIndex: number
  /** Which display to control: 1-indexed display number or 'all' (default: 'all') */
  display?: number | 'all'
  /** Luminance step per knob tick (default: 5) */
  step?: number
}

export function ScreenBrightness({ knob, keyIndex, display = 'all', step = 5 }: ScreenBrightnessProps) {
  const [luminance, setLuminance] = useState(() => readLuminance(display))

  const handleRotate = useCallback((dir: Direction) => {
    const delta = dir === 'right' ? step : -step
    setLuminance((prev) => {
      const next = Math.max(0, Math.min(100, prev + delta))
      applyAbsolute(next, display)
      return next
    })
  }, [display, step])

  // Click resets to full brightness
  const handleClick = useCallback(() => {
    applyAbsolute(100, display)
    setLuminance(100)
  }, [display])

  const barWidth = Math.round(96 * luminance / 100)
  const accent = luminance < 20 ? '#475569' : luminance < 60 ? '#f59e0b' : '#fbbf24'
  const displayLabel = display === 'all' ? 'ALL' : `DSP ${display}`

  return (
    <>
      <Key index={keyIndex} onClick={handleClick}>
        <Rect x={0} y={0} width={112} height={112} fill="#0f172a" />
        <Rect x={0} y={0} width={112} height={3} fill={accent} />
        <Text text="BRIGHTNESS" fill="#475569" fontSize={8} fontStyle="bold"
          x={0} y={11} width={112} align="center" letterSpacing={2} />
        <Text text={`${luminance}%`} fill="white" fontSize={28} fontStyle="bold"
          x={0} y={30} width={112} align="center" />
        <Text text={displayLabel} fill="#334155" fontSize={9}
          x={0} y={64} width={112} align="center" letterSpacing={1} />
        {/* Bar track */}
        <Rect x={8} y={80} width={96} height={6} fill="#1e293b" cornerRadius={3} />
        {/* Bar fill */}
        <Rect x={8} y={80} width={barWidth} height={6} fill={accent} cornerRadius={3} />
        <Text text="click → full" fill="#1e293b" fontSize={8}
          x={0} y={95} width={112} align="center" />
      </Key>

      <Knob index={knob} onRotate={handleRotate} onClick={handleClick} />
    </>
  )
}
