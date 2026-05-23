# xAI Imagine — capability matrix (Groot)

Reference: [Imagine overview](https://docs.x.ai/developers/model-capabilities/imagine), [Images API](https://docs.x.ai/developers/rest-api-reference/inference/images), [Videos API](https://docs.x.ai/developers/rest-api-reference/inference/videos).

## Image (`grok-imagine-image-quality`)

| Capability | API | Tool: `image_creator` |
|------------|-----|------------------------|
| Text-to-image | `POST /v1/images/generations` | `action: generate` |
| Image edit (1 source) | `POST /v1/images/edits` + `image` | `action: edit` |
| Multi-image edit (≤3 sources) | `POST /v1/images/edits` + `images[]` | `action: edit_multi` |
| Batch (`n` 1–10) | `n` on generations | `n` on generate |
| Aspect ratio | `aspect_ratio` | same |
| Resolution 1k / 2k | `resolution` | same |
| Output URL / base64 | `response_format` | same |
| Chat attachment as source | base64 data URI | `use_attached_image: true` |

## Video (`grok-imagine-video`, async + poll)

| Capability | API | Tool: `video_creator` |
|------------|-----|------------------------|
| Text-to-video | `POST /v1/videos/generations` | `mode: text-to-video` |
| Image-to-video | generations + `image` | `mode: image-to-video` |
| Reference-to-video | generations + `reference_images` | `mode: reference-to-video` |
| Video editing | `POST /v1/videos/edits` | `mode: edit-video` + `video_url` |
| Video extension | `POST /v1/videos/extensions` | `mode: extend-video` + `video_url` |
| Duration | 1–15s (gen), 1–10s (extend segment) | `duration` |
| Aspect ratio | generations only | `aspect_ratio` |
| Resolution 480p / 720p | generations only | `resolution` |
| Poll status | `GET /v1/videos/{request_id}` | automatic in worker |

## Not exposed as separate tools (use parameters above)

- Style transfer → image `edit` with style prompt  
- Multi-turn edit chain → sequential `edit` calls with previous output URL  
- Concurrent different prompts → multiple tool calls in one turn  

## Groot wiring

- Tools registered in `XAI_RESPONSES_TOOLS` (`packages/ai/xai-responses-input.ts`)
- Execution: `packages/ai/xai-imagine.ts` from `ActivityController`
- UI gallery: `ImagineMediaGallery` on `threadItem.object.imagineMedia`
