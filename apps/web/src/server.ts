import handler from '@tanstack/react-start/server-entry';
import { createDb } from './db';
import { cleanupOrphanThreadFiles } from './server/cleanup-orphan-files';
import { env } from 'cloudflare:workers';

export default {
    fetch: handler.fetch,
    async scheduled(): Promise<void> {
        const apiKey = env.XAI_API_KEY;
        if (!apiKey) return;
        const db = createDb(env.DB);
        const removed = await cleanupOrphanThreadFiles(db, apiKey);
        if (removed > 0) {
            console.log(`Cleaned up ${removed} orphan thread file(s)`);
        }
    },
};
