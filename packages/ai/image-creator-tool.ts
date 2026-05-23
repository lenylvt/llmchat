import { IMAGE_CREATOR_TOOL_NAME } from '@repo/shared/types';

export { IMAGE_CREATOR_TOOL_NAME };

export const IMAGE_CREATOR_FUNCTION_TOOL = {
    type: 'function' as const,
    name: IMAGE_CREATOR_TOOL_NAME,
    description:
        'Generate or edit images with Grok Imagine (grok-imagine-image-quality). Actions: generate (text-to-image), edit (one source image + prompt), edit_multi (2–3 source images + prompt, reference as <IMAGE_1>, <IMAGE_2> in prompt). Use use_attached_image when the user attached a photo in chat. Supports aspect_ratio, resolution (1k|2k), n (1–10 for generate). Returns temporary image URLs.',
    parameters: {
        type: 'object',
        properties: {
            action: {
                type: 'string',
                enum: ['generate', 'edit', 'edit_multi'],
                description: 'generate = new image from prompt; edit = one source image; edit_multi = up to 3 sources.',
            },
            prompt: {
                type: 'string',
                description: 'What to generate or how to edit. For edit_multi, use <IMAGE_1>, <IMAGE_2>, <IMAGE_3> placeholders.',
            },
            source_image_urls: {
                type: 'array',
                items: { type: 'string' },
                description: 'Public HTTPS URLs or data:image/... URIs (max 3 for edit_multi).',
            },
            use_attached_image: {
                type: 'boolean',
                description: 'Include the user image attachment from this message as a source (edit / image-to-video).',
            },
            aspect_ratio: {
                type: 'string',
                enum: [
                    'auto',
                    '1:1',
                    '16:9',
                    '9:16',
                    '4:3',
                    '3:4',
                    '3:2',
                    '2:3',
                    '2:1',
                    '1:2',
                    '19.5:9',
                    '9:19.5',
                    '20:9',
                    '9:20',
                ],
                description: 'Output aspect ratio. edit_multi defaults to first image unless set.',
            },
            resolution: {
                type: 'string',
                enum: ['1k', '2k'],
                description: 'Output resolution.',
            },
            n: {
                type: 'integer',
                description: 'Number of images to generate (generate only, 1–10).',
            },
            response_format: {
                type: 'string',
                enum: ['url', 'b64_json'],
                description: 'Prefer url (default) for chat display.',
            },
        },
        required: ['action', 'prompt'],
    },
};
