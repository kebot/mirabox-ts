import { useEffect, useRef } from 'react'
import { Stage } from 'react-konva'
import type Konva from 'konva'
import { apiClient } from '@/api/client'

interface Props {
  width?: number
  height?: number
  devicePath?: string
  keyIndex?: number
  children?: React.ReactNode
}

function CanvasKey({
  width = 112,
  height = 112,
  devicePath,
  keyIndex,
  children
}: Props) {
  const stageRef = useRef<Konva.Stage>(null)
  const lastBase64Ref = useRef<string | null>(null)

  useEffect(() => {
    console.log('useEffect', devicePath, keyIndex)

    const stage = stageRef.current
    if (!stage || !devicePath || keyIndex == null) return

    const sendIfChanged = () => {
      const base64 = stage.toDataURL({ pixelRatio: 1 }).split(',')[1]
      if (base64 === lastBase64Ref.current) return
      lastBase64Ref.current = base64
      apiClient.POST('/devices/{path}/key-image-data', {
        params: { path: { path: devicePath } },
        body: { keyIndex, imgData: base64 },
      })
    }

    // drawend fires on Layer (not Stage) — attach to each layer directly
    const layers = stage.getLayers()
    layers.forEach(layer => layer.on('drawend', sendIfChanged))
    // drag events bubble to Stage
    stage.on('dragmove dragend', sendIfChanged)
    sendIfChanged() // initial paint

    return () => {
      layers.forEach(layer => layer.off('drawend', sendIfChanged))
      stage.off('dragmove dragend', sendIfChanged)
    }
  })

  return (
    <Stage ref={stageRef} width={width} height={height}>
      {children}
    </Stage>
  )
}

export default CanvasKey
