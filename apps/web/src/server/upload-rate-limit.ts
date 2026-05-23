import { XAI_UPLOAD_RATE_LIMIT_PER_MINUTE } from '@repo/shared/config';
import { env } from 'cloudflare:workers';

export async function checkUploadRateLimit(userId: string): Promise<boolean> {
    const minute = Math.floor(Date.now() / 60_000);
    const key = `upload:${userId}:${minute}`;
    const current = parseInt((await env.KV.get(key)) ?? '0', 10);
    if (current >= XAI_UPLOAD_RATE_LIMIT_PER_MINUTE) {
        return false;
    }
    await env.KV.put(key, String(current + 1), { expirationTtl: 120 });
    return true;
}
