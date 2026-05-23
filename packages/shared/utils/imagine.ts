import type { ThreadItem } from '../types';
import {
    IMAGE_CREATOR_TOOL_NAME,
    VIDEO_CREATOR_TOOL_NAME,
    type ImageCreatorAction,
    type ImagineMediaItem,
    type ThreadImagineMedia,
    type VideoCreatorMode,
} from '../types/imagine';
import { assertAllowedImagineMediaUrl } from './media-url';
import { stringArg, stringArrayArg } from './tool-args';

export {
    IMAGE_CREATOR_TOOL_NAME,
    VIDEO_CREATOR_TOOL_NAME,
} from '../types/imagine';
export type {
    ImagineMediaItem,
    ImagineToolResult,
    ThreadImagineMedia,
} from '../types/imagine';

export function isImageCreatorToolName(toolName: string): boolean {
    return toolName.trim().toLowerCase() === IMAGE_CREATOR_TOOL_NAME;
}

export function isVideoCreatorToolName(toolName: string): boolean {
    return toolName.trim().toLowerCase() === VIDEO_CREATOR_TOOL_NAME;
}

export function isImagineClientToolName(toolName: string): boolean {
    return isImageCreatorToolName(toolName) || isVideoCreatorToolName(toolName);
}

const VIDEO_CREATOR_MODES = [
    'text-to-video',
    'image-to-video',
    'reference-to-video',
    'edit-video',
    'extend-video',
] as const satisfies readonly VideoCreatorMode[];

function isVideoCreatorMode(value: string): value is VideoCreatorMode {
    return (VIDEO_CREATOR_MODES as readonly string[]).includes(value);
}

export function parseImageCreatorAction(raw: unknown): ImageCreatorAction {
    const action = String(raw ?? 'generate').toLowerCase();
    if (action === 'edit' || action === 'edit_multi') return action;
    return 'generate';
}

export function parseVideoCreatorMode(raw: unknown): VideoCreatorMode {
    const mode = String(raw ?? 'text-to-video').toLowerCase();
    return isVideoCreatorMode(mode) ? mode : 'text-to-video';
}

export function isIncompleteImagineToolArgs(
    toolName: string,
    args: Record<string, unknown>
): boolean {
    if ('raw' in args || 'partial' in args) return true;
    if (!stringArg(args, 'prompt')) return true;
    if (isVideoCreatorToolName(toolName)) {
        return !stringArg(args, 'mode');
    }
    return !stringArg(args, 'action');
}

export type ResolvedImagineSources = {
    imageUrls: string[];
};

/** Merge attached chat image + explicit URLs for edit / image-to-video. */
export function imagineItemsFromThreadItem(item: ThreadItem): ImagineMediaItem[] {
    const media = item.object?.imagineMedia;
    return Array.isArray(media?.items) ? media.items : [];
}

/** All generated media in the thread before the current turn. */
export function collectImagineMediaFromThreadItems(
    messages: ThreadItem[]
): ImagineMediaItem[] {
    const items: ImagineMediaItem[] = [];
    for (const message of messages) {
        items.push(...imagineItemsFromThreadItem(message));
    }
    return items;
}

export function lastGeneratedImageUrl(items: ImagineMediaItem[]): string | undefined {
    for (let i = items.length - 1; i >= 0; i--) {
        const row = items[i];
        if (row.kind === 'image' && row.url?.trim()) return row.url.trim();
    }
    return undefined;
}

export function lastGeneratedVideoUrl(items: ImagineMediaItem[]): string | undefined {
    for (let i = items.length - 1; i >= 0; i--) {
        const row = items[i];
        if (row.kind === 'video' && row.url?.trim()) return row.url.trim();
    }
    return undefined;
}

/** Injected into the next user message so Grok can chain edits / image-to-video. */
export function formatImagineContextBlock(priorMedia: ImagineMediaItem[]): string {
    if (priorMedia.length === 0) return '';

    const lastImage = lastGeneratedImageUrl(priorMedia);
    const lastVideo = lastGeneratedVideoUrl(priorMedia);
    const lines: string[] = ['[Generated media in this thread]'];

    if (lastImage) {
        const img = priorMedia.filter(m => m.kind === 'image').at(-1);
        lines.push(
            `Latest image URL (xAI, may expire): ${lastImage}`,
            img?.prompt ? `Latest image prompt: ${img.prompt}` : '',
            'To refine that image use image_creator with action edit or edit_multi and source_image_urls including this URL.'
        );
    }

    if (lastVideo) {
        const vid = priorMedia.filter(m => m.kind === 'video').at(-1);
        lines.push(
            `Latest video URL (xAI, may expire): ${lastVideo}`,
            vid?.prompt ? `Latest video prompt: ${vid.prompt}` : '',
            'To edit or extend that clip use video_creator with mode edit-video or extend-video and video_url.'
        );
    }

    return `${lines.filter(Boolean).join('\n')}\n\n---\n\n`;
}

export function resolveImagineImageSources(
    args: Record<string, unknown>,
    userImageAttachment?: string | null
): ResolvedImagineSources {
    const urls = stringArrayArg(args, 'source_image_urls');
    const useAttached = args.use_attached_image === true;
    const imageUrls: string[] = [];

    if (useAttached && userImageAttachment?.trim()) {
        const raw = userImageAttachment.trim();
        imageUrls.push(
            raw.startsWith('data:') ? raw : `data:image/jpeg;base64,${raw}`
        );
    }

    const single = stringArg(args, 'image_url');
    if (single) imageUrls.push(single);

    for (const url of urls) {
        if (!imageUrls.includes(url)) imageUrls.push(url);
    }

    const limited = imageUrls.slice(0, 3);
    for (const url of limited) {
        if (!url.startsWith('data:')) {
            assertAllowedImagineMediaUrl(url, 'source_image_urls');
        }
    }

    return { imageUrls: limited };
}
