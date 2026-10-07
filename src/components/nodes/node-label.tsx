'use client'

import { useCallback, useState, type KeyboardEvent } from 'react'
import type { LucideIcon } from 'lucide-react'

export function NodeLabel({
  icon: Icon,
  label,
  onRename,
  selected,
  className,
}: {
  icon: LucideIcon
  label: string
  onRename: (nextLabel: string) => void
  selected?: boolean
  className?: string
}) {
  const [draft, setDraft] = useState<string | null>(null)

  const save = useCallback(() => {
    if (draft === null) return
    const trimmed = draft.trim()
    setDraft(null)
    if (trimmed && trimmed !== label) onRename(trimmed)
  }, [draft, label, onRename])

  const onKeyDown = useCallback((event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') event.currentTarget.blur()
    if (event.key === 'Escape') setDraft(null)
  }, [])

  const colorClass = selected
    ? 'text-sky-400'
    : (className ?? 'text-neutral-400')

  return (
    <div className={`flex min-w-0 flex-1 items-center gap-1.5 text-xs ${colorClass}`}>
      <Icon className="h-3.5 w-3.5 shrink-0" />
      {draft !== null ? (
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={save}
          onKeyDown={onKeyDown}
          autoFocus
          className="nodrag w-full rounded border border-neutral-700 bg-neutral-900 px-1 py-0.5 text-xs text-neutral-200 outline-none"
        />
      ) : (
        <span onDoubleClick={() => setDraft(label)} className="truncate">
          {label}
        </span>
      )}
    </div>
  )
}