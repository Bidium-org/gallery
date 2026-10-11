export type ImageInputReference = {
  type: "image_url";
  image_url: { url: string };
};

export type ImageGenerationRequest = {
  model: string;
  prompt: string;
  n?: number;
  resolution?: string;
  aspect_ratio?: string;
  quality?: string;
  output_format?: string;
  background?: string;
  output_compression?: number;
  seed?: number;
  input_references?: ImageInputReference[];
};

export type GeneratedImage = {
  b64_json: string;
  media_type?: string;
};

export type ImageGenerationUsage = {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost?: number;
};

export type ImageGenerationResponse = {
  created: number;
  data: GeneratedImage[];
  usage?: ImageGenerationUsage;
};

export type GenerateApiResponse = {
  images: { url: string }[];
  usage?: ImageGenerationUsage;
};
