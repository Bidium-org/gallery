import { useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'

import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import type { ImageModel } from '@/types/TImageModel'

function formatCreatedDate(timestamp: number): string {
  const date = new Date(timestamp * 1000)
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

export function ModelPicker({
  models,
  value,
  onSelect,
  isLoading,
}: {
  models: ImageModel[]
  value: string | null
  onSelect: (modelId: string) => void
  isLoading?: boolean
}) {
  const [open, setOpen] = useState(false)
  const selected = models.find((model) => model.id === value) ?? null

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          disabled={isLoading}
          className="nodrag flex h-7 min-w-0 flex-1 items-center justify-between gap-2 rounded-lg border border-neutral-800 bg-neutral-900 px-2.5 text-xs text-neutral-300 outline-none hover:bg-neutral-800/60 disabled:opacity-50"
        >
          <span className="truncate">
            {isLoading
              ? 'Loading models…'
              : (selected?.name ?? 'Select model')}
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-neutral-500" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[280px] gap-0 border-neutral-800 bg-neutral-950 p-1"
      >
        <Command className="bg-transparent p-0">
          <CommandInput placeholder="Search models…" />
          <CommandList>
            <CommandEmpty className="py-4 text-xs text-neutral-500">
              No models found
            </CommandEmpty>
            {models.map((model) => (
              <CommandItem
                key={model.id}
                value={model.id}
                keywords={[model.name]}
                onSelect={() => {
                  onSelect(model.id)
                  setOpen(false)
                }}
                className="flex items-center justify-between gap-2 text-xs"
              >
                <span className="min-w-0 truncate">{model.name}</span>
                <span className="flex shrink-0 items-center gap-1.5 text-neutral-500">
                  {formatCreatedDate(model.created)}
                  {model.id === value && <Check className="h-3 w-3" />}
                </span>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}