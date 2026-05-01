import React, { useState, useEffect } from 'react'
import { Rect, Text, Circle } from 'react-konva'
import { Key, TouchKey } from 'react-mirabox'
import { readFileSync, existsSync, readdirSync } from 'fs'
import { join } from 'path'

const STATUS_FILE = `/tmp/claude-status-${process.env.USER}.json`
const SESSIONS_DIR = join(process.env.HOME ?? '~', '.claude', 'sessions')

interface ClaudeStatus {
  model: { display_name: string }
  cost: { total_cost_usd: number }
  context_window: { used_percentage: number }
}

interface SessionFile {
  status: 'busy' | 'idle' | string
  waitingFor?: string
  updatedAt: number
}

function readStatus(): ClaudeStatus | null {
  try {
    if (!existsSync(STATUS_FILE)) return null
    return JSON.parse(readFileSync(STATUS_FILE, 'utf8')) as ClaudeStatus
  } catch {
    return null
  }
}

function readSessionInfo(): { status: 'busy' | 'idle' | null; waitingFor: string | null } {
  try {
    if (!existsSync(SESSIONS_DIR)) return { status: null, waitingFor: null }
    const files = readdirSync(SESSIONS_DIR).filter((f) => f.endsWith('.json'))
    if (files.length === 0) return { status: null, waitingFor: null }

    let latest: SessionFile | null = null
    for (const file of files) {
      try {
        const data = JSON.parse(readFileSync(join(SESSIONS_DIR, file), 'utf8')) as SessionFile
        if (!latest || data.updatedAt > latest.updatedAt) latest = data
      } catch {
        // skip unreadable files
      }
    }
    return {
      status: (latest?.status as 'busy' | 'idle') ?? null,
      waitingFor: latest?.waitingFor ?? null,
    }
  } catch {
    return { status: null, waitingFor: null }
  }
}

export interface ClaudeStatusWidgetProps {
  /** Use a regular key button (default) or touch key */
  type?: 'key' | 'touch'
  /** Key/touch index (default: 1) */
  index?: number
  /** Poll interval in ms (default: 1000) */
  pollMs?: number
}

export function ClaudeStatusWidget({ type = 'key', index = 1, pollMs = 1000 }: ClaudeStatusWidgetProps) {
  const [status, setStatus] = useState<ClaudeStatus | null>(readStatus)
  const [session, setSession] = useState(readSessionInfo)

  useEffect(() => {
    const id = setInterval(() => {
      setStatus(readStatus())
      setSession(readSessionInfo())
    }, pollMs)
    return () => clearInterval(id)
  }, [pollMs])

  const w = type === 'touch' ? 176 : 112
  const h = 112

  const model = status?.model.display_name ?? '—'
  const cost = status ? `$${status.cost.total_cost_usd.toFixed(2)}` : '—'
  const ctx = status ? Math.round(status.context_window.used_percentage) : 0
  const barW = Math.round((w - 12) * ctx / 100)

  const isBusy = session.status === 'busy'
  const stateLabel = session.status === null ? '—' : isBusy ? 'THINKING' : 'WAITING'
  const stateColor = isBusy ? '#f59e0b' : '#22c55e'
  const waitingFor = session.waitingFor ?? null

  const content = (
    <>
      <Rect x={0} y={0} width={w} height={h} fill="#0f172a" />
      {/* status dot */}
      <Circle x={w / 2} y={13} radius={5} fill={stateColor} />
      <Text
        text={model}
        fill="white" fontSize={16} fontStyle="bold"
        x={0} y={24} width={w} align="center"
      />
      <Text
        text={stateLabel}
        fill={stateColor} fontSize={9} fontStyle="bold"
        x={0} y={46} width={w} align="center" letterSpacing={1}
      />
      {waitingFor ? (
        <Text
          text={waitingFor}
          fill="#64748b" fontSize={8}
          x={4} y={58} width={w - 8} align="center"
        />
      ) : null}
      <Text
        text={cost}
        fill="#94a3b8" fontSize={12}
        x={0} y={waitingFor ? 70 : 62} width={w} align="center"
      />
      {/* context bar */}
      <Rect x={6} y={88} width={w - 12} height={5} fill="#1e293b" cornerRadius={2} />
      <Rect x={6} y={88} width={barW} height={5} fill="#7c3aed" cornerRadius={2} />
      <Text
        text={`ctx ${ctx}%`}
        fill="#475569" fontSize={9}
        x={0} y={98} width={w} align="center"
      />
    </>
  )

  return type === 'touch'
    ? <TouchKey index={index}>{content}</TouchKey>
    : <Key index={index}>{content}</Key>
}
