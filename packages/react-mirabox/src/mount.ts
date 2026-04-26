// skia-backend patches Konva to use skia-canvas for headless rendering
import 'konva/skia-backend'
import Konva from 'konva'
import { KonvaRenderer } from 'react-konva'
import type { ReactNode } from 'react'

export interface MountHandle {
  unmount: () => void
  stage: Konva.Stage
  /** react-reconciler fiber — use KonvaRenderer.updateContainer to re-render without recreating the stage */
  fiber: ReturnType<typeof KonvaRenderer.createContainer>
}

export interface MountOptions {
  width?: number
  height?: number
}

/**
 * Mount a React tree containing <CanvasKey> in a headless Node.js environment.
 *
 * Uses react-konva's built-in KonvaRenderer (react-reconciler) directly —
 * no jsdom or react-dom required. Konva renders to an in-memory canvas via
 * skia-canvas (patched by konva/skia-backend).
 *
 * @example
 * ```ts
 * import { Layer, Rect } from 'react-konva'
 * import { CanvasKey, mountCanvasKey } from 'react-mirabox'
 *
 * const { unmount } = mountCanvasKey(
 *   <CanvasKey>
 *     <Layer>
 *       <Rect x={0} y={0} width={112} height={112} fill="#0a1432" />
 *     </Layer>
 *   </CanvasKey>,
 *   { width: 112, height: 112, onFrame: buf => device.setKeyImage(3, buf) }
 * )
 *
 * // Later, to clean up:
 * unmount()
 * ```
 */
export function mountCanvasKey(
  jsx: ReactNode,
  options: MountOptions = {}
): MountHandle {
  const { width = 112, height = 112 } = options

  const stage = new Konva.Stage({ width, height })

  // Drive the React tree directly through KonvaRenderer — no DOM needed
  // 1 == ConcurrentRoot (react-reconciler constant used by react-konva)
  const fiber = KonvaRenderer.createContainer(
    stage,
    1,
    null,
    false,
    null,
    '',
    console.error,
    console.error,
    console.error,
    () => {}
  )

  KonvaRenderer.updateContainer(jsx, fiber, null, () => {})

  return {
    stage,
    fiber,
    unmount: () => {
      KonvaRenderer.flushSyncFromReconciler(() => {
        KonvaRenderer.updateContainer(null, fiber, null, () => {})
      })
      stage.destroy()
    },
  }
}
