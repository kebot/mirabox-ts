import { Children, useLayoutEffect, useRef } from 'react'
import { Layer } from 'react-konva'
import type Konva from 'konva'

export interface CanvasKeyProps {
  onFrame?: (png: Buffer) => void
  children?: React.ReactNode
}

/**
 * Renders children into a Konva Layer and emits PNG frames after React commits.
 */
export function CanvasKey({ onFrame, children }: CanvasKeyProps) {
  const layerRef = useRef<Konva.Layer>(null)
  const lastBase64Ref = useRef<string | null>(null)

  useLayoutEffect(() => {
    if (!onFrame) return

    const layer = layerRef.current
    const stage = layer?.getStage()
    if (!stage) return

    // Ensure immediate rasterization before capture in Node backends
    stage.getLayers().forEach(l => l.draw())

    const base64 = stage.toDataURL({ pixelRatio: 1 }).split(',')[1]
    if (base64 === lastBase64Ref.current) return
    lastBase64Ref.current = base64
    onFrame(Buffer.from(base64, 'base64'))
  })

  const konvaChildren = Children.toArray(children).filter(
    (child) => typeof child !== 'string'
  )

  return <Layer ref={layerRef}>{konvaChildren}</Layer>
}
