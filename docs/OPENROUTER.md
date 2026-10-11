# OpenRouter

The OpenRouter integration: four host routes that proxy it, and the client code that shapes a generation request. Map and main flow: `docs/OVERVIEW.md`.

```
src/server/routes/
├── generate/            → image generation
├── name/                → names generated images
├── image-models/        → available image models
└── settings/validate-key/ → checks a candidate API key
src/lib/generation.ts    → client: builds the generation request
src/lib/naming.ts        → client: asks for a name, `null` on any failure
src/lib/models.ts        → which model a node uses, its reference cap (pure)
src/lib/constants.ts     → OpenRouter base URL, naming model
src/types/TImageGeneration.ts, TImageModel.ts → wire shapes
```

## Owns

- Every call to OpenRouter. The renderer never calls it directly.
- How a node graph becomes a generation request (prompt resolution, reference images).
- The model catalogue contract that drives the node UI.

## Upstream calls

| Route                             | OpenRouter call                                                  | Key comes from  | On failure                    |
| --------------------------------- | ---------------------------------------------------------------- | --------------- | ----------------------------- |
| `POST /api/generate`              | `POST /images`                                                   | `settings.json` | 502 with OpenRouter's message |
| `POST /api/name`                  | `POST /chat/completions` (naming model)                          | `settings.json` | 502                           |
| `GET /api/image-models`           | `GET /images/models`, keeps models whose output includes `image` | `settings.json` | 502                           |
| `POST /api/settings/validate-key` | `GET /credits`                                                   | request body    | 401 invalid key, 502 network  |

The first three answer 500 `No API key configured — open Settings` when no key is stored (`docs/HOST.md` for how the key is stored). There is no timeout and no cancellation on any of these calls.

## Building a generation request

`generateImage()` in `src/lib/generation.ts` receives what the Canvas collected from the text node's wired inputs (`docs/CANVAS.md`):

- Prompt: each `@label` of a wired **text** node is replaced by that node's content, longest label first so `@Foo Bar` wins over `@Foo`. A mention of an **image** node stays in the prompt as plain `@label`; the image travels as a reference instead.
- References: wired images become `input_references` data URLs, cut to the model's maximum (the `range.max` of its `input_references` capability). A user-set `input_references` param is discarded.
- Params: the node version's parameter values are spread into the body as is. `POST /api/generate` forwards the body to OpenRouter without validating it beyond `model` and `prompt`.

The reply carries base64 images and a `usage.cost`. The route writes each image to disk and returns URLs plus the usage. Duration is measured by the client around the whole call, disk write included.

## Model catalogue

- Each model exposes `supported_parameters`, a map from parameter name to a descriptor (`enum`, `range` or `boolean`). The node's "Advanced settings" are generated from it: a new OpenRouter parameter of one of these three kinds shows up with no code change.
- `imageModelsStore` sorts newest first. The model used by a node is its own choice, else the default model setting, else the first of the list (`resolveModel()`, shared by the node's display and the generation).
- Fetched when settings load with a key set, and again after a key is saved. No cache, no retry besides the Retry button of the settings dialog.

## Naming

`POST /api/name` sends the prompt with `@` stripped and the labels already on the canvas, with a system prompt forcing a 1-3 word name that avoids those labels. It is best effort: on failure the outputs keep the model name as label.

## Gotchas

- References are inlined as base64 in the JSON body: the request grows with the number and size of wired images.
- OpenRouter errors are flattened: only `error.message` survives to the error node.
