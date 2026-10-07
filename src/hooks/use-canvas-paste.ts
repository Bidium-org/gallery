import { useEffect, useRef } from 'react'
import { useReactFlow } from '@xyflow/react'

import { isEditableTarget } from '@/hooks/use-canvas-shortcuts'
import { uploadImages } from '@/lib/upload-images'
import { useCanvasStore } from '@/stores/canvas-store'
import { settingsStore } from '@/stores/settings-store'

export function useCanvasPaste() {
  const addDroppedImages = useCanvasStore((state) => state.addDroppedImages)
  const pasteClipboard = useCanvasStore((state) => state.pasteClipboard)
  const { screenToFlowPosition } = useReactFlow()
  const mousePositionRef = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    const onMouseMove = (event: MouseEvent) => {
      mousePositionRef.current = { x: event.clientX, y: event.clientY }
    }

    const viewportCenter = () =>
      screenToFlowPosition({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      })

    const onPaste = (event: ClipboardEvent) => {
      if (settingsStore.getState().settingsDialogOpen) return
      if (isEditableTarget(event.target)) return

      const files = Array.from(event.clipboardData?.files ?? []).filter((file) =>
        file.type.startsWith('image/'),
      )

      if (files.length === 0) {
        pasteClipboard()
        return
      }

      event.preventDefault()
      const mouse = mousePositionRef.current
      const position = mouse ? screenToFlowPosition(mouse) : viewportCenter()

      uploadImages(files)
        .then((uploaded) => addDroppedImages(uploaded, position))
        .catch((error) => console.error('image_upload_failed', error))
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('paste', onPaste)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('paste', onPaste)
    }
  }, [screenToFlowPosition, addDroppedImages, pasteClipboard])
}