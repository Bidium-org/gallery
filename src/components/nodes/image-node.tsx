import { memo, useCallback } from 'react'
import type { NodeProps } from '@xyflow/react'
import { Image as ImageIcon, Download, Loader2 } from 'lucide-react'

import { BaseNode, nodeBoxClass } from '@/components/nodes/base-node'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { CanvasImageNode } from '@/types/TCanvasNode'

async function downloadImage(imageUrl: string, label: string) {
  try {
    const response = await fetch(imageUrl)
    const blob = await response.blob()
    const extension = blob.type.split('/')[1] ?? 'png'
    const url = URL.createObjectURL(blob)

    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${label}.${extension}`
    anchor.click()

    URL.revokeObjectURL(url)
  } catch {
    window.open(imageUrl, '_blank')
  }
}

export const ImageNode = memo(({ id, data, selected }: NodeProps<CanvasImageNode>) => {
  const { label, imageUrl, status = 'ready', cost, durationMs } = data

  const onDownload = useCallback(() => {
    void downloadImage(imageUrl, label)
  }, [imageUrl, label])

  const boxClass = nodeBoxClass(selected, 'border-neutral-800')

  return (
    <BaseNode
      id={id}
      icon={ImageIcon}
      label={label}
      selected={selected}
      className="group w-[280px]"
    >
      {status === 'generating' ? (
        <div
          className={`flex h-[210px] w-full items-center justify-center rounded-lg border bg-neutral-900 ${boxClass}`}
        >
          <Loader2 className="h-5 w-5 animate-spin text-neutral-500" />
        </div>
      ) : (
        <div className="relative">
          <img
            src={imageUrl}
            alt={label}
            className={`block w-full rounded-lg border ${boxClass}`}
            draggable={false}
          />
          <div className="nodrag absolute top-2 right-2 opacity-0 transition-opacity group-hover:opacity-100">
            <Button
              size="icon"
              variant="secondary"
              aria-label="Download image"
              className="h-7 w-7"
              onClick={onDownload}
            >
              <Download className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
      {selected && (cost !== undefined || durationMs !== undefined) && (
        <div className="mt-1.5 flex justify-end gap-1.5">
          {durationMs !== undefined && (
            <Badge className="border-neutral-700 bg-neutral-800 text-[11px] font-normal text-neutral-200">
              {(durationMs / 1000).toFixed(1)}s
            </Badge>
          )}
          {cost !== undefined && (
            <Badge className="border-neutral-700 bg-neutral-800 text-[11px] font-normal text-neutral-200">
              ${Number(cost.toFixed(4))}
            </Badge>
          )}
        </div>
      )}
    </BaseNode>
  )
})

ImageNode.displayName = 'ImageNode'