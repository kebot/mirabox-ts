import { useCallback, useEffect, useRef, useState } from 'react'
export { apiClient } from '@/api/client'

export interface DeviceInfo {
  path: string
  vendorID: number
  productID: number
  serialNumber: string
  firmwareVersion: string
  product: string
  type: string
}

export type InputEventType = 'BUTTON' | 'TOUCH' | 'KNOB_ROT' | 'KNOB_BTN' | 'SWIPE'

export interface InputEvent {
  id: number
  timestamp: string
  path: string
  type: InputEventType
  detail: string
}

export type WsStatus = 'connecting' | 'connected' | 'disconnected'

let eventCounter = 0

function parseInputEvent(path: string, payload: Record<string, unknown>): InputEvent | null {
  const now = new Date()
  const ts =
    now.toTimeString().slice(0, 8) +
    '.' +
    String(now.getMilliseconds()).padStart(3, '0')

  if ('keyId' in payload) {
    return {
      id: ++eventCounter,
      timestamp: ts,
      path,
      type: 'BUTTON',
      detail: `key=${payload.keyId} ${payload.keyUpOrKeyDown}`,
    }
  }
  if ('touchKeyId' in payload) {
    return {
      id: ++eventCounter,
      timestamp: ts,
      path,
      type: 'TOUCH',
      detail: `key=${payload.touchKeyId} ${payload.keyUpOrKeyDown}`,
    }
  }
  if ('knobId' in payload && 'direction' in payload) {
    return {
      id: ++eventCounter,
      timestamp: ts,
      path,
      type: 'KNOB_ROT',
      detail: `knob=${payload.knobId} ${payload.direction}`,
    }
  }
  if ('knobId' in payload && 'state' in payload) {
    return {
      id: ++eventCounter,
      timestamp: ts,
      path,
      type: 'KNOB_BTN',
      detail: `knob=${payload.knobId} ${payload.state}`,
    }
  }
  if ('direction' in payload) {
    return {
      id: ++eventCounter,
      timestamp: ts,
      path,
      type: 'SWIPE',
      detail: `dir=${payload.direction}`,
    }
  }
  return null
}

const MAX_EVENTS = 200

export function useStreamDock(wsUrl = '/ws') {
  const [status, setStatus] = useState<WsStatus>('connecting')
  const [devices, setDevices] = useState<Record<string, DeviceInfo>>({})
  const [events, setEvents] = useState<InputEvent[]>([])
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    let ws: WebSocket
    let cancelled = false

    function connect() {
      ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        if (cancelled) return
        setStatus('connected')
        ws.send(JSON.stringify({ event: 'read' }))
      }

      ws.onclose = () => {
        if (cancelled) return
        setStatus('disconnected')
        // reconnect after 2s
        setTimeout(connect, 2000)
      }

      ws.onerror = () => {
        // onclose fires after onerror, let it handle reconnect
      }

      ws.onmessage = (e) => {
        if (cancelled) return
        let msg: Record<string, unknown>
        try {
          msg = JSON.parse(e.data as string)
        } catch {
          return
        }

        const event = msg.event as string
        const path = (msg.path as string) ?? ''

        if (event === 'deviceDidConnect') {
          const info = msg.payload as DeviceInfo
          setDevices((prev) => ({ ...prev, [path]: info }))
        } else if (event === 'deviceDidDisconnect') {
          setDevices((prev) => {
            const next = { ...prev }
            delete next[path]
            return next
          })
        } else if (event === 'read') {
          const parsed = parseInputEvent(path, msg.payload as Record<string, unknown>)
          if (parsed) {
            setEvents((prev) => [parsed, ...prev].slice(0, MAX_EVENTS))
          }
        } else if (event === 'error') {
          console.error('StreamDock error:', msg.payload)
        }
      }
    }

    connect()

    return () => {
      cancelled = true
      ws?.close()
    }
  }, [wsUrl])

  const sendCommand = useCallback(
    (path: string, event: string, payload: Record<string, unknown> = {}) => {
      const ws = wsRef.current
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ event, path, payload }))
      }
    },
    [],
  )

  const clearEvents = useCallback(() => setEvents([]), [])

  return { status, devices, events, sendCommand, clearEvents }
}
