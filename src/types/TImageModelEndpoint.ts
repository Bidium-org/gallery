import type { CapabilityDescriptor } from '@/types/TImageModel'

export type PricingLine = {
  billable: 'output_image' | 'input_image' | 'input_reference' | string
  unit: 'image' | 'megapixel' | 'token' | string
  cost_usd: number
  variant?: string
}

export type ImageModelEndpoint = {
  provider_name: string
  provider_slug: string
  provider_tag: string | null
  supported_parameters: Record<string, CapabilityDescriptor>
  allowed_passthrough_parameters: string[]
  supports_streaming: boolean
  pricing: PricingLine[]
}

export type ImageModelEndpointsResponse = {
  id: string
  endpoints: ImageModelEndpoint[]
}