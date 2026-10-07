'use client'

import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'

import type { ImageModel } from '@/types/TImageModel'

export type ImageModelsStoreState = {
  models: ImageModel[]
  isLoading: boolean
  error: string | null
  fetchModels: () => Promise<void>
}

export const imageModelsStore = createStore<ImageModelsStoreState>()((set) => ({
  models: [],
  isLoading: false,
  error: null,

  fetchModels: async () => {
    set({ isLoading: true, error: null })

    try {
      const response = await fetch('/api/image-models')
      if (!response.ok) throw new Error('fetch failed')

      const { data } = (await response.json()) as { data: ImageModel[] }
      set({
        models: [...data].sort((a, b) => b.created - a.created),
        isLoading: false,
      })
    } catch {
      set({ isLoading: false, error: 'Failed to load models' })
    }
  },
}))

export function useImageModelsStore<T>(
  selector: (state: ImageModelsStoreState) => T,
): T {
  return useStore(imageModelsStore, selector)
}