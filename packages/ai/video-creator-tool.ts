import { VIDEO_CREATOR_TOOL_NAME } from '@repo/shared/types';

export { VIDEO_CREATOR_TOOL_NAME };

export const VIDEO_CREATOR_FUNCTION_TOOL = {
    type: 'function' as const,
    name: VIDEO_CREATOR_TOOL_NAME,
    description:
        'Generate or edit videos with Grok Imagine Video (grok-imagine-video). Async (polls until ready). Modes: text-to-video, image-to-video (image_url or use_attached_image), reference-to-video (reference_image_urls, use <IMAGE_N> in prompt), edit-video (video_url + prompt), extend-video (video_url + prompt, duration = extension seconds 1–10). Supports duration (1–15 for generation), aspect_ratio, resolution (480p|720p). Returns temporary video URL.',
    parameters: {
        type: 'object',
        properties: {
            mode: {
                type: 'string',
                enum: [
                    'text-to-video',
                    'image-to-video',
                    'reference-to-video',
                    'edit-video',
                    'extend-video',
                ],
                description: 'Which Imagine video workflow to run.',
            },
            prompt: {
                type: 'string',
                description: 'Scene / motion / edit instructions. Required for all modes.',
            },
            image_url: {
                type: 'string',
                description: 'Source still for image-to-video (URL or data URI).',
            },
            use_attached_image: {
                type: 'boolean',
                description: 'Use the user chat image attachment as image-to-video source.',
            },
            reference_image_urls: {
                type: 'array',
                items: { type: 'string' },
                description: 'Reference images for reference-to-video (not combinable with image_url).',
            },
            video_url: {
                type: 'string',
                description: 'Source video URL for edit-video or extend-video.',
            },
            duration: {
                type: 'integer',
                description: 'Seconds: 1–15 for generation; 1–10 for extend-video extension segment.',
            },
            aspect_ratio: {
                type: 'string',
                enum: ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3'],
            },
            resolution: {
                type: 'string',
                enum: ['480p', '720p'],
            },
        },
        required: ['mode', 'prompt'],
    },
};
