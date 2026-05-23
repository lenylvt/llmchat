/** xAI Files API limits (https://docs.x.ai/developers/files) */
export const XAI_FILE_MAX_BYTES = 48 * 1024 * 1024;

export const XAI_FILES_API_BASE = 'https://api.x.ai/v1/files';

/** Safe inline preview types for GET /api/files/:id/content */
export const XAI_INLINE_MEDIA_TYPES = new Set([
    'text/plain',
    'text/markdown',
    'application/pdf',
]);

/** Max uploads per user per minute (KV rate limit). */
export const XAI_UPLOAD_RATE_LIMIT_PER_MINUTE = 20;

/** Auto-delete uploaded files after 7 days (xAI `expires_after`, seconds). */
export const XAI_FILE_EXPIRES_SECONDS = 7 * 24 * 60 * 60;

export const isImageMimeType = (mime: string) => mime.startsWith('image/');

export const getFileExtension = (filename: string): string => {
    const base = filename.split(/[\\/]/).pop() ?? filename;
    const dot = base.lastIndexOf('.');
    if (dot <= 0 || dot === base.length - 1) return 'file';
    return base.slice(dot + 1).toLowerCase();
};
