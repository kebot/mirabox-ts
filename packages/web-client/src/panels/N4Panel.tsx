import { useEffect, useRef, useState } from 'react'
import { useN4State } from '@/hooks/useN4State'
import type { InputEvent } from '@/hooks/useStreamDock'
import { N4Device } from '@/components/N4Device'
import CanvasKey from '@/components/CanvasKey'
import { Layer, Rect, Text } from 'react-konva'
import { SpecialKey } from '@/panels/SpecialKey'

interface Props {
  devicePath: string
  events: InputEvent[]
}

function makeKey(devicePath: string, keyIndex: number, label: string, w: number, h: number, fill: string, textColor: string) {
  return (
    <CanvasKey width={w} height={h} devicePath={devicePath} keyIndex={keyIndex}>
      <Layer>
        <Rect x={0} y={0} width={w} height={h} fill={fill} />
        <Text text={label} fontSize={28} fill={textColor} width={w} height={h} align="center" verticalAlign="middle" />
      </Layer>
    </CanvasKey>
  )
}


export function N4Panel({ devicePath, events }: Props) {
  const n4State = useN4State(events)
  const [live, setLive] = useState(false)
  const lastProcessed = useRef(-1)

  useEffect(() => {
    const ev = events[0]
    if (!ev || ev.id === lastProcessed.current) return
    lastProcessed.current = ev.id
    if (ev.type === 'BUTTON') {
      const m = ev.detail.match(/key=(\d+)\s+(\S+)/)
      if (m && parseInt(m[1]) === 11 && m[2] === 'keyDown') {
        setLive(prev => !prev)
      }
    }
  }, [events])

  const key = (idx: number, label: string) => makeKey(devicePath, idx, label, 112, 112, '#1e293b', 'white')
  const touch = (idx: number, label: string) => makeKey(devicePath, idx, label, 172, 112, '#0a1628', '#67e8f9')

  return (
    <N4Device
      {...n4State}
      key1={<SpecialKey live={live} devicePath={devicePath} keyIndex={1} />}
      key2={key(2, '12')}
      key3={key(3, '13')}
      key4={key(4, '14')}
      key5={key(5, '15')}
      key6={key(6, '6')}
      key7={key(7, '7')}
      key8={key(8, '8')}
      key9={key(9, '9')}
      key10={key(10, '10')}
      touch1={touch(11, 'T1')}
      touch2={touch(12, 'T2')}
      touch3={touch(13, 'T3')}
      touch4={touch(14, 'T4')}
    />
  )
}
