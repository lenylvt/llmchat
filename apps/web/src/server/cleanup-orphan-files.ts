import { createDb } from '../db';
import { threadFiles } from '../db/schema';
import { deleteXaiFile } from './xai-files';
import { and, eq, isNull, lt } from 'drizzle-orm';

const ORPHAN_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export async function cleanupOrphanThreadFiles(
    db: ReturnType<typeof createDb>,
    apiKey: string
): Promise<number> {
    const cutoff = new Date(Date.now() - ORPHAN_MAX_AGE_MS);
    const rows = await db
        .select()
        .from(threadFiles)
        .where(and(isNull(threadFiles.threadId), lt(threadFiles.createdAt, cutoff)));

    let removed = 0;
    for (const row of rows) {
        try {
            await deleteXaiFile(row.xaiFileId, apiKey);
            await db.delete(threadFiles).where(eq(threadFiles.id, row.id));
            removed++;
        } catch (error) {
            console.error('orphan file cleanup failed', row.id, error);
        }
    }
    return removed;
}
