import React, { useState, useEffect, useCallback } from 'react'
import { Rect, Text } from 'react-konva'
import { TouchKey, Knob } from 'react-mirabox'
import { exec, execSync } from 'child_process'
import type { Direction } from 'mirabox-client'

// ── macOS volume helpers ─────────────────────────────────────────────────────

function readVolume(): number {
  try {
    return parseInt(
      execSync('osascript -e "output volume of (get volume settings)"', { stdio: 'pipe' }).toString()
    )
  } catch { return 50 }
}

function readMuted(): boolean {
  try {
    return execSync('osascript -e "output muted of (get volume settings)"', { stdio: 'pipe' })
      .toString().trim() === 'true'
  } catch { return false }
}

// Fire-and-forget — don't block the React/USB event loop
function applyVolume(vol: number) {
  exec(`osascript -e "set volume output volume ${vol}"`)
}

function applyMuted(muted: boolean) {
  exec(`osascript -e "set volume ${muted ? 'with output muted' : 'without output muted'}"`)
}

// ── Component ────────────────────────────────────────────────────────────────

export interface VolumeControlProps {
  /** TouchKey index used for the display (default: 1) */
  touchKeyIndex?: number
  /** Knob index used for adjustment (default: 1) */
  knobIndex?: number
  /** Volume step per knob tick (default: 5) */
  step?: number
}

export function VolumeControl({ touchKeyIndex = 1, knobIndex = 1, step = 5 }: VolumeControlProps) {
  const [volume, setVolume] = useState(() => readVolume())
  const [muted, setMuted] = useState(() => readMuted())

  // Sync state from system every second in case external apps change volume
  useEffect(() => {
    const id = setInterval(() => {
      setVolume(readVolume())
      setMuted(readMuted())
    }, 1000)
    return () => clearInterval(id)
  }, [])

  const handleRotate = useCallback((dir: Direction) => {
    const delta = dir === 'right' ? step : -step
    const next = Math.max(0, Math.min(100, volume + delta))
    applyVolume(next)
    setVolume(next)
    // Unmute on volume-up so the change is audible
    if (muted && delta > 0) {
      applyMuted(false)
      setMuted(false)
    }
  }, [volume, muted, step])

  const handleClick = useCallback(() => {
    const next = !muted
    applyMuted(next)
    setMuted(next)
  }, [muted])

  const barWidth = Math.round(156 * volume / 100)
  const accent = muted ? '#475569' : '#3b82f6'

  return (
    <>
      {/* TouchKey displays current volume and toggles mute on click */}
      <TouchKey index={touchKeyIndex} onClick={handleClick}>
        <Rect x={0} y={0} width={176} height={112} fill="#0f172a" />
        {/* Label */}
        <Text text="VOLUME" fill="#475569" fontSize={10} fontStyle="bold"
              x={0} y={14} width={176} align="center" letterSpacing={3} />
        {/* Value */}
        <Text
          text={muted ? 'MUTED' : `${volume}%`}
          fill={muted ? '#64748b' : 'white'}
          fontSize={28} fontStyle="bold"
          x={0} y={34} width={176} align="center"
        />
        {/* Progress bar track */}
        <Rect x={10} y={78} width={156} height={8} fill="#1e293b" cornerRadius={4} />
        {/* Progress bar fill */}
        <Rect x={10} y={78} width={barWidth} height={8} fill={accent} cornerRadius={4} />
      </TouchKey>

      {/* Knob adjusts volume; click toggles mute */}
      <Knob index={knobIndex} onRotate={handleRotate} onClick={handleClick} />
    </>
  )
}
