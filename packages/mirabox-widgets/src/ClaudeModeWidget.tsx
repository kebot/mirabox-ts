import React, { useState, useEffect, useCallback } from 'react'
import { Rect, Text } from 'react-konva'
import { Key } from 'react-mirabox'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'

const SETTINGS_FILE = join(process.env.HOME ?? '~', '.claude', 'settings.json')
const STATE_FILE = `/tmp/claude-mode-${process.env.USER}.json`

type Mode = 'default' | 'acceptEdits' | 'plan' | 'auto'

const MODES: Mode[] = ['default', 'acceptEdits', 'plan', 'auto']

const MODE_LABELS: Record<Mode, string> = {
  default:     'DEFAULT',
  acceptEdits: 'EDITS',
  plan:        'PLAN',
  auto:        'AUTO',
}

const MODE_COLORS: Record<Mode, string> = {
  default:     '#64748b',
  acceptEdits: '#3b82f6',
  plan:        '#a855f7',
  auto:        '#22c55e',
}

const MODE_ICONS: Record<Mode, string> = {
  default:     '◎',
  acceptEdits: '✎',
  plan:        '☰',
  auto:        '⚡',
}

function readMode(): Mode {
  // Widget's own state file is authoritative — avoids settings.json round-trip issues
  try {
    if (existsSync(STATE_FILE)) {
      const { mode } = JSON.parse(readFileSync(STATE_FILE, 'utf8'))
      if (MODES.includes(mode)) return mode as Mode
    }
  } catch {}

  // Fall back to settings.json on first run
  try {
    if (existsSync(SETTINGS_FILE)) {
      const settings = JSON.parse(readFileSync(SETTINGS_FILE, 'utf8'))
      const mode = settings?.permissions?.defaultMode as Mode
      if (MODES.includes(mode)) return mode
    }
  } catch {}

  return 'default'
}

function writeMode(mode: Mode): void {
  // Write widget state
  try {
    writeFileSync(STATE_FILE, JSON.stringify({ mode }))
  } catch (e) {
    console.error('ClaudeModeWidget: failed to write state file', e)
  }

  // Apply to Claude Code settings so the change takes effect in-session
  try {
    let settings: Record<string, unknown> = {}
    if (existsSync(SETTINGS_FILE)) {
      settings = JSON.parse(readFileSync(SETTINGS_FILE, 'utf8'))
    }
    if (!settings.permissions || typeof settings.permissions !== 'object') {
      settings.permissions = {}
    }
    ;(settings.permissions as Record<string, unknown>).defaultMode = mode
    writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2) + '\n')
  } catch (e) {
    console.error('ClaudeModeWidget: failed to write settings', e)
  }
}

export interface ClaudeModeWidgetProps {
  /** Button key index (default: 1) */
  index?: number
  /** Poll interval in ms (default: 1000) */
  pollMs?: number
}

export function ClaudeModeWidget({ index = 1, pollMs = 1000 }: ClaudeModeWidgetProps) {
  const [mode, setMode] = useState<Mode>(readMode)

  useEffect(() => {
    const id = setInterval(() => setMode(readMode()), pollMs)
    return () => clearInterval(id)
  }, [pollMs])

  const handleClick = useCallback(() => {
    const next = MODES[(MODES.indexOf(mode) + 1) % MODES.length]
    writeMode(next)
    setMode(next)
  }, [mode])

  const color = MODE_COLORS[mode]
  const label = MODE_LABELS[mode]
  const icon = MODE_ICONS[mode]

  return (
    <Key index={index} onClick={handleClick}>
      <Rect x={0} y={0} width={112} height={112} fill="#0f172a" />
      <Rect x={0} y={0} width={112} height={4} fill={color} />
      <Text
        text="MODE"
        fill="#475569" fontSize={9} fontStyle="bold"
        x={0} y={14} width={112} align="center" letterSpacing={2}
      />
      <Text
        text={icon}
        fill={color} fontSize={28}
        x={0} y={30} width={112} align="center"
      />
      <Text
        text={label}
        fill={color} fontSize={14} fontStyle="bold"
        x={0} y={66} width={112} align="center" letterSpacing={1}
      />
      <Text
        text="click to cycle"
        fill="#334155" fontSize={8}
        x={0} y={90} width={112} align="center"
      />
    </Key>
  )
}
