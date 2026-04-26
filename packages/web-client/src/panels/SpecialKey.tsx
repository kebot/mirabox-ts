import { useEffect, useRef, useState } from 'react'
import { Layer, Rect, Text, Arc } from 'react-konva'
import CanvasKey from '@/components/CanvasKey'

interface Props {
  devicePath: string
  keyIndex: number
  live?: boolean
}

export function SpecialKey({ live, devicePath, keyIndex }: Props) {
  const [rotation, setRotation] = useState(0)
  const [pulse, setPulse] = useState(0)
  const rafRef = useRef<number>(0)
  const startRef = useRef<number | null>(null)

  useEffect(() => {
    if (!live) return () => cancelAnimationFrame(rafRef.current)

    const tick = (now: number) => {
      if (startRef.current === null) startRef.current = now
      const t = now - startRef.current

      setRotation(t * 0.3 % 360)
      setPulse((Math.sin(t * 0.002) + 1) / 2)

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [live])

  const r = Math.round(10 + pulse * 20)
  const g = Math.round(20 + pulse * 25)
  const b = Math.round(50 + pulse * 80)

  return (
    <CanvasKey width={112} height={112} devicePath={devicePath} keyIndex={keyIndex}>
      <Layer>
        {/* Pulsing background */}
        <Rect x={0} y={0} width={112} height={112} fill={`rgb(${r},${g},${b})`} />

        {/* Trailing arc */}
        <Arc
          x={56} y={56}
          innerRadius={36} outerRadius={42}
          angle={200}
          fill="rgba(59,130,246,0.25)"
          rotation={rotation - 30}
        />

        {/* Main spinning arc */}
        <Arc
          x={56} y={56}
          innerRadius={36} outerRadius={42}
          angle={120}
          fill="#3b82f6"
          rotation={rotation}
          shadowBlur={10}
          shadowColor="#3b82f6"
          shadowOpacity={0.8}
        />

        {/* Label */}
        <Text
          text="M"
          fontSize={28}
          fontStyle="bold"
          fill="white"
          width={112} height={112}
          align="center" verticalAlign="middle"
          shadowBlur={6}
          shadowColor="rgba(255,255,255,0.4)"
        />

        {/* Draggable red block */}
        <Rect
          x={4} y={50}
          width={24} height={24}
          fill="#ef4444"
          cornerRadius={4}
          shadowBlur={8}
          shadowColor="#ef4444"
          shadowOpacity={0.7}
          draggable
        />
      </Layer>
    </CanvasKey>
  )
}
