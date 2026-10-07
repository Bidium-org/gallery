import { ParamField } from '@/components/models/param-field'
import type { CapabilityDescriptor, ImageModel, ParamValue } from '@/types/TImageModel'
import type { ImageModelEndpoint, PricingLine } from '@/types/TImageModelEndpoint'

function formatPricingLine(line: PricingLine) {
  const variant = line.variant ? ` (${line.variant})` : ''
  return `${line.billable}: $${line.cost_usd} / ${line.unit}${variant}`
}

function collectPricing(endpoints: ImageModelEndpoint[] | null): string[] {
  if (!endpoints) return []
  const lines = endpoints.flatMap((endpoint) => endpoint.pricing.map(formatPricingLine))
  return [...new Set(lines)]
}

function getMaxReferences(model: ImageModel): number | null {
  const descriptor = model.supported_parameters['input_references']
  if (descriptor?.type === 'range') return descriptor.max
  return null
}

export function ModelDetail({
  model,
  endpoints,
  isLoadingEndpoints,
  paramValues,
  onParamChange,
}: {
  model: ImageModel
  endpoints: ImageModelEndpoint[] | null
  isLoadingEndpoints: boolean
  paramValues: Record<string, ParamValue>
  onParamChange: (name: string, value: ParamValue | null) => void
}) {
  const maxReferences = getMaxReferences(model)
  const parameterEntries = Object.entries(model.supported_parameters)
  const pricingLines = collectPricing(endpoints)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-medium">{model.name}</h2>
        <p className="text-xs text-neutral-500">{model.description}</p>
        <div className="flex gap-3 text-xs text-neutral-500">
          <span>input: {model.architecture.input_modalities.join(', ')}</span>
          {maxReferences !== null && (
            <span>up to {maxReferences} reference image{maxReferences > 1 ? 's' : ''}</span>
          )}
          {model.supports_streaming && <span>streaming</span>}
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-neutral-800 p-4">
        {parameterEntries.map(([name, descriptor]) => (
          <ParamField
            key={name}
            name={name}
            descriptor={descriptor as CapabilityDescriptor}
            value={paramValues[name]}
            onChange={onParamChange}
          />
        ))}
        {parameterEntries.length === 0 && (
          <p className="text-xs text-neutral-500">No configurable parameters</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5 rounded-lg border border-neutral-800 p-4">
        <h3 className="text-xs font-medium text-neutral-400">Pricing</h3>
        {isLoadingEndpoints && <p className="text-xs text-neutral-500">Loading…</p>}
        {!isLoadingEndpoints && pricingLines.length === 0 && (
          <p className="text-xs text-neutral-500">No pricing information</p>
        )}
        {pricingLines.map((line) => (
          <p key={line} className="text-xs text-neutral-500">
            {line}
          </p>
        ))}
      </div>
    </div>
  )
}