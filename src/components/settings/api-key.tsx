import { useCallback, useEffect, useState, type KeyboardEvent } from 'react'
import { AlertTriangle, Check, Loader2 } from 'lucide-react'

import { Input } from '@/components/ui/input'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useSettingsStore } from '@/stores/settings-store'

function maskApiKey(key: string): string {
  return `sk-or-${'•'.repeat(30)}${key.slice(-4)}`
}

export function ApiKeyField() {
  const { settings, saveApiKey } = useSettingsStore((state) => state)

  const [inputValue, setInputValue] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const [isValidating, setIsValidating] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  const apiKey = settings?.openRouterApiKey ?? ''

  useEffect(() => {
    if (!isFocused) {
      setInputValue(apiKey ? maskApiKey(apiKey) : '')
    }
  }, [apiKey, isFocused])

  const handleSave = useCallback(async () => {
    if (!inputValue || inputValue === maskApiKey(apiKey)) {
      setInputValue(apiKey ? maskApiKey(apiKey) : '')
      setLocalError(null)
      return
    }

    setIsValidating(true)
    setLocalError(null)

    const result = await saveApiKey(inputValue)
    if (!result.success) {
      setLocalError(result.error ?? 'Invalid API key')
    }

    setIsValidating(false)
  }, [inputValue, apiKey, saveApiKey])

  const handleFocus = useCallback(() => {
    setIsFocused(true)
    setInputValue('')
    setLocalError(null)
  }, [])

  const handleBlur = useCallback(() => {
    setIsFocused(false)
    void handleSave()
  }, [handleSave])

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') event.currentTarget.blur()
      if (event.key === 'Escape') {
        setInputValue(apiKey ? maskApiKey(apiKey) : '')
        setLocalError(null)
        event.currentTarget.blur()
      }
    },
    [apiKey],
  )

  const hasValidKey = Boolean(apiKey) && !isFocused && !isValidating && !localError

  if (!settings) {
    return <div className="h-8 w-full animate-pulse rounded-lg bg-neutral-800" />
  }

  return (
    <div>
      <h3 className="mb-1 text-xs font-medium text-neutral-300">API key</h3>
      <p className="mb-2 text-[11px] text-neutral-500">
        Stored locally. Click the field to edit.
      </p>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="relative flex items-center">
              <Input
                type={isFocused || !apiKey ? 'text' : 'password'}
                value={inputValue}
                onFocus={handleFocus}
                onBlur={handleBlur}
                onChange={(event) => setInputValue(event.target.value)}
                onKeyDown={onKeyDown}
                placeholder="sk-or-xxxxxxxxxx…"
                disabled={isValidating}
                className={`bg-neutral-900 pr-9 text-xs ${
                  localError
                    ? 'border-red-500/60 focus-visible:ring-red-500/30'
                    : hasValidKey
                      ? 'border-green-500/40'
                      : ''
                } ${!isFocused && !isValidating ? 'cursor-pointer' : ''}`}
              />
              <div className="pointer-events-none absolute right-2.5 flex items-center">
                {isValidating && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-neutral-500" />
                )}
                {hasValidKey && <Check className="h-4 w-4 text-green-500" />}
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            {apiKey ? 'Click to edit' : 'Enter your API key'}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {localError && (
        <div className="flex items-center gap-1.5 px-1 pt-1.5 text-[11px] text-red-400">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span>{localError}</span>
        </div>
      )}
    </div>
  )
}