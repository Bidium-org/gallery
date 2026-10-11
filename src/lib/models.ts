import type { ImageModel } from '@/types/TImageModel'

export function resolveModel(
  models: ImageModel[],
  modelId: string | undefined,
  defaultModelId: string | null | undefined,
): ImageModel | null {
  const find = (id: string | null | undefined) =>
    id ? models.find((candidate) => candidate.id === id) : undefined
  return find(modelId) ?? find(defaultModelId) ?? models[0] ?? null
}

export function getMaxReferences(model: ImageModel): number | null {
  const descriptor = model.supported_parameters['input_references']
  if (descriptor?.type === 'range') return descriptor.max
  return null
}
