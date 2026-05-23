import { XAI_FILES_API_BASE } from '@repo/shared/config';
import type { CoreMessage } from 'ai';
import { sleep } from './sleep';

export function isXaiFileIngestError(message: string): boolean {
    return (
        message.includes('failed to ingest file_id') ||
        message.includes('ingest file_id') ||
        message.includes('media service')
    );
}

export function collectXaiFileIdsFromMessages(messages: CoreMessage[]): string[] {
    const ids = new Set<string>();
    for (const message of messages) {
        if (message.role !== 'user' || !Array.isArray(message.content)) continue;
        for (const part of message.content) {
            if (part.type !== 'file') continue;
            const fileId = part.providerOptions?.xai?.fileId;
            if (typeof fileId === 'string' && fileId.length > 0) {
                ids.add(fileId);
            }
        }
    }
    return [...ids];
}

async function probeFileReadable(
    fileId: string,
    apiKey: string,
    signal?: AbortSignal
): Promise<boolean> {
    const metaRes = await fetch(`${XAI_FILES_API_BASE}/${fileId}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal,
    });
    if (!metaRes.ok) return false;

    const contentRes = await fetch(`${XAI_FILES_API_BASE}/${fileId}/content`, {
        headers: { Authorization: `Bearer ${apiKey}`, Range: 'bytes=0-0' },
        signal,
    });
    if (!contentRes.ok) return false;
    await contentRes.body?.cancel().catch(() => {});
    return true;
}

/** Give xAI time to ingest files before attaching them to chat. */
export async function waitForXaiFilesReady(
    fileIds: string[],
    apiKey: string,
    signal?: AbortSignal
): Promise<void> {
    if (fileIds.length === 0) return;

    await sleep(Math.min(1200 + fileIds.length * 500, 4000), signal);

    for (const fileId of fileIds) {
        let ready = false;
        for (let attempt = 0; attempt < 10; attempt++) {
            if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

            if (await probeFileReadable(fileId, apiKey, signal)) {
                await sleep(500 + attempt * 250, signal);
                ready = true;
                break;
            }

            await sleep(700 + attempt * 350, signal);
        }

        if (!ready) {
            throw new Error(
                `File ${fileId} is still processing on xAI. Wait a moment and try again.`
            );
        }
    }
}
