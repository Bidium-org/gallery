'use client'

import { useCallback, useEffect, useState } from 'react'

import { GeneratePanel } from '@/components/models/generate-panel'
import { ModelDetail } from '@/components/models/model-detail'
import { ModelList } from '@/components/models/model-list'
import type { ImageModel, ParamValue } from '@/types/TImageModel'
import type {
  ImageModelEndpoint,
  ImageModelEndpointsResponse,
} from '@/types/TImageModelEndpoint'
import type { GenerateApiResponse } from '@/types/TImageGeneration'

export default function ModelsPage() {
  const [models, setModels] = useState<ImageModel[]>([])
  const [modelsError, setModelsError] = useState<string | null>(null)
  const [isLoadingModels, setIsLoadingModels] = useState(false)
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null)
  const [endpoints, setEndpoints] = useState<ImageModelEndpoint[] | null>(null)
  const [isLoadingEndpoints, setIsLoadingEndpoints] = useState(false)
  const [paramValues, setParamValues] = useState<Record<string, ParamValue>>({})
  const [prompt, setPrompt] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [result, setResult] = useState<GenerateApiResponse | null>(null)

  const selectedModel = models.find((model) => model.id === selectedModelId) ?? null

  const fetchModels = useCallback(async () => {
    setIsLoadingModels(true)
    setModelsError(null)

    try {
      const response = await fetch('/api/image-models')
      if (!response.ok) throw new Error('fetch failed')

      const { data } = (await response.json()) as { data: ImageModel[] }
      setModels(data)
    } catch {
      setModelsError('Failed to load models')
    } finally {
      setIsLoadingModels(false)
    }
  }, [])

  useEffect(() => {
    void fetchModels()
  }, [fetchModels])

  const selectModel = useCallback(async (modelId: string) => {
    setSelectedModelId(modelId)
    setParamValues({})
    setResult(null)
    setGenerateError(null)
    setEndpoints(null)
    setIsLoadingEndpoints(true)

    try {
      const response = await fetch(
        `/api/image-model-endpoints?model=${encodeURIComponent(modelId)}`,
      )
      if (!response.ok) throw new Error('fetch failed')

      const data = (await response.json()) as ImageModelEndpointsResponse
      setEndpoints(data.endpoints)
    } catch {
      setEndpoints([])
    } finally {
      setIsLoadingEndpoints(false)
    }
  }, [])

  const setParam = useCallback((name: string, value: ParamValue | null) => {
    setParamValues((values) => {
      const next = { ...values }
      if (value === null) {
        delete next[name]
      } else {
        next[name] = value
      }
      return next
    })
  }, [])

  const generate = useCallback(async () => {
    if (!selectedModel || !prompt.trim()) return

    setIsGenerating(true)
    setGenerateError(null)
    setResult(null)

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: selectedModel.id,
          prompt: prompt.trim(),
          ...paramValues,
        }),
      })

      if (!response.ok) throw new Error('generation failed')

      setResult((await response.json()) as GenerateApiResponse)
    } catch {
      setGenerateError('Generation failed')
    } finally {
      setIsGenerating(false)
    }
  }, [selectedModel, prompt, paramValues])

  return (
    <main className="grid h-screen grid-cols-[440px_1fr] bg-neutral-950 text-neutral-200">
      <div className="flex min-h-0 flex-col gap-3 border-r border-neutral-800 p-4">
        <ModelList
          models={models}
          isLoading={isLoadingModels}
          selectedModelId={selectedModelId}
          onSelect={(modelId) => void selectModel(modelId)}
          onRefresh={() => void fetchModels()}
        />
        {modelsError && <p className="text-xs text-red-400">{modelsError}</p>}
      </div>

      <div className="flex min-h-0 flex-col gap-4 overflow-y-auto p-6">
        {selectedModel ? (
          <>
            <ModelDetail
              model={selectedModel}
              endpoints={endpoints}
              isLoadingEndpoints={isLoadingEndpoints}
              paramValues={paramValues}
              onParamChange={setParam}
            />
            <GeneratePanel
              prompt={prompt}
              onPromptChange={setPrompt}
              isGenerating={isGenerating}
              error={generateError}
              result={result}
              onGenerate={() => void generate()}
            />
          </>
        ) : (
          <p className="text-xs text-neutral-500">Select a model</p>
        )}
      </div>
    </main>
  )
}