'use client'

import { Button } from '@/components/ui/button'
import type { GenerateApiResponse } from '@/types/TImageGeneration'

export function GeneratePanel({
  prompt,
  onPromptChange,
  isGenerating,
  error,
  result,
  onGenerate,
}: {
  prompt: string
  onPromptChange: (prompt: string) => void
  isGenerating: boolean
  error: string | null
  result: GenerateApiResponse | null
  onGenerate: () => void
}) {
  return (
    <div className="flex flex-col gap-4">
      <textarea
        value={prompt}
        onChange={(event) => onPromptChange(event.target.value)}
        placeholder="Prompt…"
        rows={3}
        className="rounded-lg border border-neutral-800 bg-neutral-900 p-3 text-xs text-neutral-200 outline-none placeholder:text-neutral-600"
      />

      <Button
        size="sm"
        className="self-start"
        onClick={onGenerate}
        disabled={isGenerating || !prompt.trim()}
      >
        {isGenerating ? 'Generating…' : 'Generate'}
      </Button>

      {error && <p className="text-xs text-red-400">{error}</p>}

      {result && (
        <div className="flex flex-col gap-3">
          {result.images.map((image, index) => (
            <div key={index} className="flex flex-col items-start gap-1.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image.url}
                alt={prompt}
                className="max-w-md rounded-lg border border-neutral-800"
              />
              {result.usage?.cost !== undefined && (
                <span className="rounded-full border border-neutral-800 bg-neutral-900 px-2.5 py-0.5 text-xs text-neutral-400">
                  ${result.usage.cost}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}