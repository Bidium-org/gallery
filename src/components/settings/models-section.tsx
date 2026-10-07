'use client'

import { AlertTriangle, Check, Loader2, RefreshCw } from 'lucide-react'

import { ModelPicker } from '@/components/nodes/model-picker'
import { ApiKeyField } from '@/components/settings/api-key'
import { Button } from '@/components/ui/button'
import { useImageModelsStore } from '@/stores/image-models-store'
import { useSettingsStore } from '@/stores/settings-store'

export function ModelsSection() {
  const { settings, setDefaultModel } = useSettingsStore((state) => state)
  const { models, isLoading, error, fetchModels } = useImageModelsStore(
    (state) => state,
  )

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h2 className="mb-3 text-sm font-semibold text-neutral-200">OpenRouter</h2>
        <div className="flex flex-col gap-4">
          <ApiKeyField />

          {settings?.openRouterApiKey && (
            <div>
              <h3 className="mb-1.5 text-xs font-medium text-neutral-300">Status</h3>
              <div className="flex items-center justify-between gap-3 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2.5">
                <div className="flex min-w-0 items-center gap-2 text-xs">
                  {isLoading && (
                    <>
                      <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-neutral-500" />
                      <span className="text-neutral-500">Checking availability…</span>
                    </>
                  )}
                  {!isLoading && error && (
                    <>
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-400" />
                      <span className="truncate text-red-400">{error}</span>
                    </>
                  )}
                  {!isLoading && !error && (
                    <>
                      <Check className="h-3.5 w-3.5 shrink-0 text-green-500" />
                      <span className="text-neutral-300">
                        {models.length} models available
                      </span>
                    </>
                  )}
                </div>
                {!isLoading && error && (
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={() => void fetchModels()}
                    className="shrink-0"
                  >
                    <RefreshCw />
                    Retry
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-1 text-sm font-semibold text-neutral-200">Defaults</h2>
        <p className="mb-2 text-[11px] text-neutral-500">
          Default model for new text nodes.
        </p>
        <ModelPicker
          models={models}
          value={settings?.defaultModelId ?? null}
          onSelect={(modelId) => void setDefaultModel(modelId)}
          isLoading={isLoading}
        />
      </section>
    </div>
  )
}