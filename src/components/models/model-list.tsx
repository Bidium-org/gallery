'use client'

import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import type { ImageModel } from '@/types/TImageModel'

function formatCreatedDate(timestamp: number): string {
  const date = new Date(timestamp * 1000)
  const month = date.toLocaleString('en-US', { month: 'long' })
  return `${date.getFullYear()} ${month} ${date.getDate()}`
}

export function ModelList({
  models,
  isLoading,
  selectedModelId,
  onSelect,
  onRefresh,
}: {
  models: ImageModel[]
  isLoading: boolean
  selectedModelId: string | null
  onSelect: (modelId: string) => void
  onRefresh: () => void
}) {
  const [search, setSearch] = useState('')

  const visibleModels = useMemo(() => {
    const query = search.trim().toLowerCase()
    const sorted = [...models].sort((a, b) => b.created - a.created)
    if (!query) return sorted
    return sorted.filter(
      (model) =>
        model.name.toLowerCase().includes(query) || model.id.toLowerCase().includes(query),
    )
  }, [models, search])

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <div className="flex items-center gap-2">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search models…"
          className="flex-1 rounded-md border border-neutral-800 bg-neutral-900 px-2.5 py-1.5 text-xs outline-none placeholder:text-neutral-600"
        />
        <Button variant="outline" size="sm" onClick={onRefresh} disabled={isLoading}>
          {isLoading ? '…' : 'Refresh'}
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col divide-y divide-neutral-900 overflow-y-auto rounded-lg border border-neutral-800">
        {visibleModels.map((model) => (
          <button
            key={model.id}
            onClick={() => onSelect(model.id)}
            className={`flex flex-col gap-0.5 px-3 py-2 text-left text-xs hover:bg-neutral-900 ${
              model.id === selectedModelId ? 'bg-neutral-900 text-sky-300' : ''
            }`}
          >
            <span className="flex items-baseline justify-between gap-3">
              <span>{model.name}</span>
              <span className="shrink-0 text-neutral-500">
                {formatCreatedDate(model.created)}
              </span>
            </span>
            <span className="text-neutral-500">
              {model.architecture.input_modalities.join(' + ')} ·{' '}
              {Object.keys(model.supported_parameters).length} params
            </span>
          </button>
        ))}
        {visibleModels.length === 0 && !isLoading && (
          <p className="px-3 py-2 text-xs text-neutral-500">No models found</p>
        )}
      </div>
    </div>
  )
}