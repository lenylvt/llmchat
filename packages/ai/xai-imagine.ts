import type {
    ImageCreatorAction,
    ImagineMediaItem,
    ImagineToolResult,
    VideoCreatorMode,
} from '@repo/shared/types';
import { getXaiApiKey } from './providers';
import { sleep } from './sleep';
import {
    assertAllowedImagineMediaUrl,
    numberArg,
    parseImageCreatorAction,
    parseVideoCreatorMode,
    resolveImagineImageSources,
    stringArg,
    stringArrayArg,
} from '@repo/shared/utils';

const IMAGE_MODEL = 'grok-imagine-image-quality';
const VIDEO_MODEL = 'grok-imagine-video';
const XAI_BASE = 'https://api.x.ai/v1';

const VIDEO_POLL_INTERVAL_MS = 2500;
const VIDEO_POLL_TIMEOUT_MS = 10 * 60 * 1000;
const XAI_REQUEST_TIMEOUT_MS = 120_000;
const VIDEO_POLL_MAX_RETRIES = 4;

export type ImagineExecutionContext = {
    userImageAttachment?: string | null;
    signal?: AbortSignal;
};

function mediaId(): string {
    return crypto.randomUUID();
}

function requestSignal(signal?: AbortSignal): AbortSignal | undefined {
    if (typeof AbortSignal.timeout !== 'function') return signal;
    const timeout = AbortSignal.timeout(XAI_REQUEST_TIMEOUT_MS);
    if (!signal) return timeout;
    return AbortSignal.any([signal, timeout]);
}

function isRetryableXaiError(error: unknown): boolean {
    if (error instanceof DOMException && error.name === 'AbortError') return false;
    const message = error instanceof Error ? error.message : String(error);
    return (
        /network|fetch|timeout|5\d{2}|503|502|504/i.test(message) ||
        message.includes('xAI error 5')
    );
}

async function xaiJson<T>(
    path: string,
    init: RequestInit,
    signal?: AbortSignal
): Promise<T> {
    const apiKey = getXaiApiKey();
    if (!apiKey) throw new Error('XAI_API_KEY is not configured');

    const response = await fetch(`${XAI_BASE}${path}`, {
        ...init,
        signal: requestSignal(signal),
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
            ...(init.headers as Record<string, string> | undefined),
        },
    });

    const text = await response.text();
    let body: unknown = {};
    try {
        body = text ? JSON.parse(text) : {};
    } catch {
        body = { raw: text };
    }

    if (!response.ok) {
        const err =
            body && typeof body === 'object' && 'error' in body
                ? String((body as { error?: { message?: string } }).error?.message ?? text)
                : text || `xAI error ${response.status}`;
        throw new Error(err);
    }

    return body as T;
}

type ImageDataRow = {
    url?: string | null;
    b64_json?: string | null;
    mime_type?: string | null;
};

type ImagesResponse = {
    data?: ImageDataRow[];
};

function rowsToMediaItems(
    rows: ImageDataRow[],
    meta: Omit<ImagineMediaItem, 'id' | 'url' | 'createdAt' | 'kind'>
): ImagineMediaItem[] {
    const now = new Date().toISOString();
    const items: ImagineMediaItem[] = [];

    for (const row of rows) {
        let url = row.url?.trim() ?? '';
        if (!url && row.b64_json) {
            const mime = row.mime_type?.trim() || 'image/png';
            url = `data:${mime};base64,${row.b64_json}`;
        }
        if (!url) continue;
        items.push({
            id: mediaId(),
            url,
            createdAt: now,
            ...meta,
            kind: 'image',
        });
    }

    return items;
}

async function postImages(
    path: '/images/generations' | '/images/edits',
    body: Record<string, unknown>,
    signal?: AbortSignal
): Promise<ImagineMediaItem[]> {
    const response = await xaiJson<ImagesResponse>(path, {
        method: 'POST',
        body: JSON.stringify(body),
    }, signal);

    const rows = Array.isArray(response.data) ? response.data : [];
    return rowsToMediaItems(rows, {
        prompt: typeof body.prompt === 'string' ? body.prompt : undefined,
        action: path === '/images/generations' ? 'generate' : undefined,
    });
}

export async function executeImageCreator(
    args: Record<string, unknown>,
    ctx: ImagineExecutionContext
): Promise<ImagineToolResult> {
    const action = parseImageCreatorAction(args.action);
    const prompt = stringArg(args, 'prompt');
    if (!prompt) throw new Error('image_creator: prompt is required');

    const aspect_ratio = stringArg(args, 'aspect_ratio');
    const resolution = stringArg(args, 'resolution');
    const response_format = stringArg(args, 'response_format') ?? 'url';
    const n = Math.min(10, Math.max(1, numberArg(args, 'n') ?? 1));

    const base: Record<string, unknown> = {
        model: IMAGE_MODEL,
        prompt,
        response_format,
    };
    if (aspect_ratio) base.aspect_ratio = aspect_ratio;
    if (resolution) base.resolution = resolution;

    if (action === 'generate') {
        const items = await postImages(
            '/images/generations',
            { ...base, n },
            ctx.signal
        );
        return {
            items: items.map(item => ({ ...item, action: 'generate' })),
        };
    }

    const { imageUrls } = resolveImagineImageSources(args, ctx.userImageAttachment);
    if (imageUrls.length === 0) {
        throw new Error(
            'image_creator edit requires source_image_urls or use_attached_image'
        );
    }

    if (action === 'edit') {
        const items = await postImages(
            '/images/edits',
            {
                ...base,
                n: numberArg(args, 'n') ?? 1,
                image: { url: imageUrls[0], type: 'image_url' },
            },
            ctx.signal
        );
        return {
            items: items.map(item => ({ ...item, action: 'edit' })),
        };
    }

    const items = await postImages(
        '/images/edits',
        {
            ...base,
            n: numberArg(args, 'n') ?? 1,
            images: imageUrls.map(url => ({ url })),
        },
        ctx.signal
    );
    return {
        items: items.map(item => ({ ...item, action: 'edit_multi' })),
    };
}

type VideoStartResponse = { request_id?: string };

type VideoPollResponse = {
    status?: string;
    progress?: number;
    video?: {
        url?: string | null;
        duration?: number;
        respect_moderation?: boolean;
    };
    error?: { code?: string; message?: string };
    model?: string;
};

async function pollVideoRequest(
    requestId: string,
    signal?: AbortSignal
): Promise<VideoPollResponse> {
    const started = Date.now();

    while (true) {
        if (signal?.aborted) {
            throw new DOMException('Aborted', 'AbortError');
        }
        if (Date.now() - started > VIDEO_POLL_TIMEOUT_MS) {
            throw new Error('Video generation timed out');
        }

        let result: VideoPollResponse | undefined;
        let lastError: unknown;

        for (let attempt = 0; attempt <= VIDEO_POLL_MAX_RETRIES; attempt++) {
            try {
                result = await xaiJson<VideoPollResponse>(
                    `/videos/${encodeURIComponent(requestId)}`,
                    { method: 'GET' },
                    signal
                );
                lastError = undefined;
                break;
            } catch (error) {
                lastError = error;
                if (!isRetryableXaiError(error) || attempt === VIDEO_POLL_MAX_RETRIES) {
                    throw error;
                }
                await sleep(VIDEO_POLL_INTERVAL_MS, signal);
            }
        }

        if (!result) {
            throw lastError instanceof Error ? lastError : new Error('Video poll failed');
        }

        const status = String(result.status ?? '');
        if (status === 'done') return result;
        if (status === 'failed' || status === 'expired') {
            const msg =
                result.error?.message ??
                `Video request ${status}${result.error?.code ? ` (${result.error.code})` : ''}`;
            throw new Error(msg);
        }

        await sleep(VIDEO_POLL_INTERVAL_MS, signal);
    }
}

async function startVideoJob(
    path: '/videos/generations' | '/videos/edits' | '/videos/extensions',
    body: Record<string, unknown>,
    signal?: AbortSignal
): Promise<string> {
    const start = await xaiJson<VideoStartResponse>(path, {
        method: 'POST',
        body: JSON.stringify(body),
    }, signal);

    const requestId = start.request_id?.trim();
    if (!requestId) throw new Error('xAI video: missing request_id');
    return requestId;
}

export async function executeVideoCreator(
    args: Record<string, unknown>,
    ctx: ImagineExecutionContext
): Promise<ImagineToolResult> {
    const mode = parseVideoCreatorMode(args.mode);
    const prompt = stringArg(args, 'prompt');
    if (!prompt) throw new Error('video_creator: prompt is required');

    const duration = numberArg(args, 'duration');
    const aspect_ratio = stringArg(args, 'aspect_ratio');
    const resolution = stringArg(args, 'resolution');

    const base: Record<string, unknown> = {
        model: VIDEO_MODEL,
        prompt,
    };

    if (mode === 'extend-video') {
        const extDuration = duration != null ? Math.min(10, Math.max(1, duration)) : undefined;
        if (extDuration != null) base.duration = extDuration;
    } else if (duration != null) {
        base.duration = Math.min(15, Math.max(1, duration));
    }

    if (aspect_ratio && mode !== 'edit-video' && mode !== 'extend-video') {
        base.aspect_ratio = aspect_ratio;
    }
    if (resolution && mode !== 'edit-video' && mode !== 'extend-video') {
        base.resolution = resolution;
    }

    let requestId: string;

    if (mode === 'edit-video' || mode === 'extend-video') {
        const videoUrl = stringArg(args, 'video_url');
        if (!videoUrl) throw new Error('video_creator: video_url is required for this mode');
        assertAllowedImagineMediaUrl(videoUrl, 'video_url');
        const path = mode === 'extend-video' ? '/videos/extensions' : '/videos/edits';
        requestId = await startVideoJob(
            path,
            { ...base, video: { url: videoUrl } },
            ctx.signal
        );
    } else {
        const genBody: Record<string, unknown> = { ...base };

        if (mode === 'image-to-video') {
            const { imageUrls } = resolveImagineImageSources(args, ctx.userImageAttachment);
            const imageUrl = imageUrls[0];
            if (!imageUrl) {
                throw new Error(
                    'video_creator image-to-video needs image_url or use_attached_image'
                );
            }
            genBody.image = { url: imageUrl };
        } else if (mode === 'reference-to-video') {
            const refs = stringArrayArg(args, 'reference_image_urls', 3);
            if (refs.length === 0) {
                throw new Error('video_creator reference-to-video needs reference_image_urls');
            }
            for (const url of refs) {
                assertAllowedImagineMediaUrl(url, 'reference_image_urls');
            }
            genBody.reference_images = refs.map(url => ({ url }));
        }

        requestId = await startVideoJob('/videos/generations', genBody, ctx.signal);
    }

    const polled = await pollVideoRequest(requestId, ctx.signal);
    const videoUrl = polled.video?.url?.trim();
    if (!videoUrl) {
        if (polled.video?.respect_moderation === false) {
            throw new Error('Video filtered by moderation');
        }
        throw new Error('Video ready but no URL returned');
    }

    const item: ImagineMediaItem = {
        id: mediaId(),
        kind: 'video',
        url: videoUrl,
        prompt,
        mode,
        duration: polled.video?.duration,
        respectModeration: polled.video?.respect_moderation,
        createdAt: new Date().toISOString(),
    };

    return { items: [item] };
}
