import { memo } from 'react'
import type { NodeProps } from '@xyflow/react'
import { TriangleAlert } from 'lucide-react'

import { BaseNode, nodeBoxClass } from '@/components/nodes/base-node'
import type { CanvasErrorNode } from '@/types/TCanvasNode'

export const ErrorNode = memo(({ id, data, selected }: NodeProps<CanvasErrorNode>) => {
  const { label, error } = data

  return (
    <BaseNode
      id={id}
      icon={TriangleAlert}
      label={label}
      selected={selected}
      labelClassName="text-red-400"
      className="w-[300px]"
    >
      <div
        className={`rounded-lg border bg-red-950/40 p-3 text-xs leading-relaxed whitespace-pre-wrap text-red-300 ${nodeBoxClass(selected, 'border-red-900/60')}`}
      >
        {error}
      </div>
    </BaseNode>
  )
})

ErrorNode.displayName = 'ErrorNode'