import { useCallback, type ReactNode } from 'react'
import { Handle, Position } from '@xyflow/react'
import type { LucideIcon } from 'lucide-react'

import { NodeLabel } from '@/components/nodes/node-label'
import { NodeShortcuts } from '@/components/nodes/node-shortcuts'
import type { Shortcut } from '@/lib/shortcuts'
import { useCanvasStore } from '@/stores/canvas-store'
import { useSettingsStore } from '@/stores/settings-store'

const HANDLE_BASE_CLASS = '!h-3 !w-3 transition-colors'

export function nodeBoxClass(
  selected: boolean | undefined,
  defaultClass: string,
): string {
  return selected ? 'border-sky-500 ring-2 ring-sky-500/40' : defaultClass
}

export function BaseNode({
  id,
  icon,
  label,
  selected,
  labelClassName,
  className,
  headerActions,
  hintShortcuts,
  children,
}: {
  id: string
  icon: LucideIcon
  label: string
  selected?: boolean
  labelClassName?: string
  className?: string
  headerActions?: ReactNode
  hintShortcuts?: Shortcut[]
  children: ReactNode
}) {
  const renameNode = useCanvasStore((state) => state.renameNode)
  const nodeHints = useSettingsStore(
    (state) => state.resolvedShortcuts.nodeHints,
  )
  const hints = hintShortcuts ?? nodeHints

  const rename = useCallback(
    (nextLabel: string) => renameNode(id, nextLabel),
    [id, renameNode],
  )

  const handleClass = selected
    ? `${HANDLE_BASE_CLASS} !bg-sky-400`
    : `${HANDLE_BASE_CLASS} !bg-neutral-500 hover:!bg-sky-400`

  return (
    <div className={className}>
      <Handle type="target" position={Position.Left} className={handleClass} />
      <div className="mb-1 flex items-center justify-between gap-2">
        <NodeLabel
          icon={icon}
          label={label}
          onRename={rename}
          selected={selected}
          className={labelClassName}
        />
        {headerActions}
      </div>
      {children}
      {selected && <NodeShortcuts shortcuts={hints} />}
      <Handle type="source" position={Position.Right} className={handleClass} />
    </div>
  )
}