const PRIVATE_HOST_PATTERNS = [
    /^localhost$/i,
    /^127\.\d+\.\d+\.\d+$/,
    /^10\.\d+\.\d+\.\d+$/,
    /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/,
    /^192\.168\.\d+\.\d+$/,
    /^\[::1\]$/,
    /^0\.0\.0\.0$/,
    /^metadata\.google\.internal$/i,
];

/** Allow data URLs (chat attachments) and public https URLs for xAI media fetches. */
export function assertAllowedImagineMediaUrl(url: string, label: string): void {
    const trimmed = url.trim();
    if (!trimmed) {
        throw new Error(`${label}: URL is required`);
    }
    if (trimmed.startsWith('data:')) return;

    let parsed: URL;
    try {
        parsed = new URL(trimmed);
    } catch {
        throw new Error(`${label}: invalid URL`);
    }

    if (parsed.protocol !== 'https:') {
        throw new Error(`${label}: only https URLs are allowed`);
    }

    const host = parsed.hostname.toLowerCase();
    for (const pattern of PRIVATE_HOST_PATTERNS) {
        if (pattern.test(host)) {
            throw new Error(`${label}: URL host is not allowed`);
        }
    }
}

export function isAllowedImagineMediaUrl(url: string): boolean {
    try {
        assertAllowedImagineMediaUrl(url, 'media');
        return true;
    } catch {
        return false;
    }
}
