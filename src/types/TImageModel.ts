export type EnumCapability = {
    type: 'enum'
    values: string[]
  }
  
  export type RangeCapability = {
    type: 'range'
    min: number
    max: number
  }
  
  export type BooleanCapability = {
    type: 'boolean'
  }
  
  export type CapabilityDescriptor = EnumCapability | RangeCapability | BooleanCapability
  
  export type ParamValue = string | number | boolean
  
  export type ImageModelArchitecture = {
    input_modalities: string[]
    output_modalities: string[]
  }
  
  export type ImageModel = {
    id: string
    name: string
    description: string
    created: number
    architecture: ImageModelArchitecture
    supported_parameters: Record<string, CapabilityDescriptor>
    supports_streaming: boolean
  }
  
  export type ImageModelsResponse = {
    data: ImageModel[]
  }