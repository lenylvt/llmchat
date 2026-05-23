import { createDb } from '../../db';
import { threadFiles } from '../../db/schema';
import { jsonError, requireSessionFromRequest } from '../../server/request-auth';
import { checkUploadRateLimit } from '../../server/upload-rate-limit';
import { deleteXaiFile, uploadFileToXai } from '../../server/xai-files';
import { XAI_FILE_MAX_BYTES } from '@repo/shared/config';
import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import { nanoid } from 'nanoid';

export const Route = createFileRoute('/api/files')({
    server: {
        handlers: {
            POST: async ({ request }) => {
                try {
                    const session = await requireSessionFromRequest(request);
                    if (session instanceof Response) return session;

                    const { userId, apiKey } = session;

                    if (!(await checkUploadRateLimit(userId))) {
                        return jsonError('Too many uploads. Try again in a minute.', 429);
                    }

                    const formData = await request.formData();
                    const file = formData.get('file');
                    if (!(file instanceof File)) {
                        return jsonError('Missing file', 400);
                    }

                    if (file.size > XAI_FILE_MAX_BYTES) {
                        return jsonError(
                            `File exceeds maximum size of ${Math.round(XAI_FILE_MAX_BYTES / (1024 * 1024))} MB`,
                            400
                        );
                    }

                    const uploaded = await uploadFileToXai(file, apiKey);
                    const id = nanoid();
                    const expiresAt = uploaded.expires_at
                        ? new Date(uploaded.expires_at * 1000)
                        : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

                    const db = createDb(env.DB);
                    try {
                        await db.insert(threadFiles).values({
                            id,
                            userId,
                            threadId: null,
                            threadItemId: null,
                            xaiFileId: uploaded.id,
                            filename: uploaded.filename ?? file.name,
                            mediaType: file.type || 'application/octet-stream',
                            sizeBytes: uploaded.bytes ?? file.size,
                            expiresAt,
                            createdAt: new Date(),
                        });
                    } catch (dbError) {
                        await deleteXaiFile(uploaded.id, apiKey).catch(() => {});
                        throw dbError;
                    }

                    return new Response(
                        JSON.stringify({
                            id,
                            xaiFileId: uploaded.id,
                            filename: uploaded.filename ?? file.name,
                            mediaType: file.type || 'application/octet-stream',
                            sizeBytes: uploaded.bytes ?? file.size,
                            expiresAt: expiresAt.toISOString(),
                            status: 'processing',
                        }),
                        { status: 200, headers: { 'Content-Type': 'application/json' } }
                    );
                } catch {
                    return jsonError('Upload failed', 500);
                }
            },
        },
    },
});
