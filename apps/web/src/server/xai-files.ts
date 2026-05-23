import { XAI_FILE_EXPIRES_SECONDS, XAI_FILES_API_BASE } from '@repo/shared/config';
import { createDb } from '../db';
import { threadFiles } from '../db/schema';
import { env } from 'cloudflare:workers';
import { and, eq, inArray } from 'drizzle-orm';

export type XaiUploadedFile = {
    id: string;
    filename: string;
    bytes: number;
    expires_at: number | null;
};

export async function uploadFileToXai(file: File, apiKey: string): Promise<XaiUploadedFile> {
    const formData = new FormData();
    formData.append('expires_after', String(XAI_FILE_EXPIRES_SECONDS));
    formData.append('purpose', 'assistants');
    formData.append('file', file, file.name);

    const response = await fetch(XAI_FILES_API_BASE, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
        body: formData,
    });

    if (!response.ok) {
        const err = await response.text().catch(() => '');
        throw new Error(err || `xAI file upload failed (${response.status})`);
    }

    return (await response.json()) as XaiUploadedFile;
}

export async function deleteXaiFile(xaiFileId: string, apiKey: string): Promise<boolean> {
    const response = await fetch(`${XAI_FILES_API_BASE}/${xaiFileId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (response.ok || response.status === 404) {
        return true;
    }
    const err = await response.text().catch(() => '');
    throw new Error(err || `xAI file delete failed (${response.status})`);
}

export async function fetchXaiFileContent(xaiFileId: string, apiKey: string): Promise<ArrayBuffer> {
    const response = await fetch(`${XAI_FILES_API_BASE}/${xaiFileId}/content`, {
        headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!response.ok) {
        const err = await response.text().catch(() => '');
        throw new Error(err || `xAI file download failed (${response.status})`);
    }
    return response.arrayBuffer();
}

export async function deleteXaiFilesByIds(
    xaiFileIds: string[],
    apiKey: string
): Promise<string[]> {
    const deleted: string[] = [];
    await Promise.all(
        xaiFileIds.map(async id => {
            try {
                if (await deleteXaiFile(id, apiKey)) {
                    deleted.push(id);
                }
            } catch (error) {
                console.error('xAI delete failed', id, error);
            }
        })
    );
    return deleted;
}

async function deleteThreadFilesWhere(
    whereClause: ReturnType<typeof eq>,
    apiKey: string
): Promise<void> {
    const db = createDb(env.DB);
    const rows = await db
        .select({ id: threadFiles.id, xaiFileId: threadFiles.xaiFileId })
        .from(threadFiles)
        .where(whereClause);

    if (rows.length === 0) return;

    const deletedXaiIds = await deleteXaiFilesByIds(
        rows.map(r => r.xaiFileId),
        apiKey
    );
    const deletedSet = new Set(deletedXaiIds);
    const dbIdsToRemove = rows.filter(r => deletedSet.has(r.xaiFileId)).map(r => r.id);

    if (dbIdsToRemove.length > 0) {
        await db.delete(threadFiles).where(inArray(threadFiles.id, dbIdsToRemove));
    }
}

export async function deleteThreadFilesFromDb(threadId: string, apiKey: string): Promise<void> {
    await deleteThreadFilesWhere(eq(threadFiles.threadId, threadId), apiKey);
}

export async function deleteThreadItemFilesFromDb(
    threadItemId: string,
    apiKey: string
): Promise<void> {
    await deleteThreadFilesWhere(eq(threadFiles.threadItemId, threadItemId), apiKey);
}

export async function assertUserOwnsXaiFiles(
    xaiFileIds: string[],
    userId: string
): Promise<void> {
    const unique = [...new Set(xaiFileIds)];
    if (unique.length === 0) return;

    const db = createDb(env.DB);
    const rows = await db
        .select({ xaiFileId: threadFiles.xaiFileId })
        .from(threadFiles)
        .where(and(eq(threadFiles.userId, userId), inArray(threadFiles.xaiFileId, unique)));

    if (rows.length !== unique.length) {
        throw new Error('File access denied');
    }
}

export function safeInlineFilename(filename: string): string {
    const sanitized = filename.replace(/[\r\n"\\]/g, '_').trim().slice(0, 200);
    return sanitized || 'file';
}

export async function linkThreadFilesToItem(
    fileIds: string[],
    userId: string,
    threadId: string,
    threadItemId: string
): Promise<void> {
    if (fileIds.length === 0) return;
    const db = createDb(env.DB);

    await db
        .update(threadFiles)
        .set({ threadId, threadItemId })
        .where(and(eq(threadFiles.userId, userId), inArray(threadFiles.id, fileIds)));

    const linked = await db
        .select({ id: threadFiles.id })
        .from(threadFiles)
        .where(
            and(
                eq(threadFiles.userId, userId),
                inArray(threadFiles.id, fileIds),
                eq(threadFiles.threadItemId, threadItemId)
            )
        );

    if (linked.length !== fileIds.length) {
        throw new Error('One or more file attachments could not be linked');
    }
}
