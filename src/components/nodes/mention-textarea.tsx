import { useCallback, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react'
import { Image as ImageIcon, Text } from 'lucide-react'

import { Textarea } from '@/components/ui/textarea'

export type CitableNode = {
  id: string
  label: string
  type?: string
}

type MentionState = {
  start: number
  query: string
}

function findMention(value: string, caret: number): MentionState | null {
  const before = value.slice(0, caret)
  const match = /(?:^|\s)@([\w -]*)$/.exec(before)
  if (!match) return null
  return { start: caret - match[1].length - 1, query: match[1] }
}

export function MentionTextarea({
  value,
  onChange,
  onSubmit,
  citableNodes,
  onMention,
  autoFocus,
  placeholder,
  className,
}: {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  citableNodes: CitableNode[]
  onMention: (nodeId: string) => void
  autoFocus?: boolean
  placeholder?: string
  className?: string
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [mention, setMention] = useState<MentionState | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)

  const filtered = mention
    ? citableNodes.filter((node) =>
        node.label.toLowerCase().includes(mention.query.toLowerCase()),
      )
    : []

  const isOpen = mention !== null && filtered.length > 0

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      const next = event.target.value
      onChange(next)
      setMention(findMention(next, event.target.selectionStart ?? next.length))
      setActiveIndex(0)
    },
    [onChange],
  )

  const insertMention = useCallback(
    (node: CitableNode) => {
      if (!mention) return
      const caret = textareaRef.current?.selectionStart ?? value.length
      onChange(`${value.slice(0, mention.start)}@${node.label} ${value.slice(caret)}`)
      onMention(node.id)
      setMention(null)
      textareaRef.current?.focus()
    },
    [mention, value, onChange, onMention],
  )

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (isOpen) {
        if (event.key === 'ArrowDown') {
          event.preventDefault()
          setActiveIndex((index) => (index + 1) % filtered.length)
          return
        }
        if (event.key === 'ArrowUp') {
          event.preventDefault()
          setActiveIndex((index) => (index - 1 + filtered.length) % filtered.length)
          return
        }
        if (event.key === 'Enter') {
          event.preventDefault()
          insertMention(filtered[activeIndex])
          return
        }
        if (event.key === 'Escape') {
          event.preventDefault()
          event.stopPropagation()
          setMention(null)
          return
        }
      }
      if (event.key === 'Escape' || (event.key === 'Enter' && (event.metaKey || event.ctrlKey))) {
        event.preventDefault()
        onSubmit()
      }
    },
    [isOpen, filtered, activeIndex, insertMention, onSubmit],
  )

  return (
    <div className="relative">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={onKeyDown}
        autoFocus={autoFocus}
        placeholder={placeholder}
        className={className}
      />
      {isOpen && (
        <div className="nodrag absolute top-full right-0 left-0 z-10 mt-1 overflow-hidden rounded-lg border border-neutral-800 bg-neutral-950 shadow-xl">
          {filtered.map((node, index) => (
            <button
              key={node.id}
              onMouseDown={(event) => {
                event.preventDefault()
                insertMention(node)
              }}
              onMouseEnter={() => setActiveIndex(index)}
              className={`flex w-full items-center gap-2 px-2.5 py-1.5 text-xs ${
                index === activeIndex
                  ? 'bg-neutral-800 text-neutral-200'
                  : 'text-neutral-400'
              }`}
            >
              {node.type === 'image' ? (
                <ImageIcon className="h-3 w-3 shrink-0" />
              ) : (
                <Text className="h-3 w-3 shrink-0" />
              )}
              <span className="truncate">{node.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}