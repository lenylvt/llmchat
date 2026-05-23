import { createDb } from '../../../../db';
import { threadFiles } from '../../../../db/schema';
import { jsonError, requireSessionFromRequest } from '../../../../server/request-auth';
import { fetchXaiFileContent, safeInlineFilename } from '../../../../server/xai-files';
import { XAI_INLINE_MEDIA_TYPES } from '@repo/shared/config';
import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import { and, eq } from 'drizzle-orm';

export const Route = createFileRoute('/api/files/$fileId/content')({
    server: {
        handlers: {
            GET: async ({ request, params }) => {
                try {
                    const session = await requireSessionFromRequest(request);
                    if (session instanceof Response) return session;

                    const { userId, apiKey } = session;
                    const db = createDb(env.DB);
                    const [row] = await db
                        .select()
                        .from(threadFiles)
                        .where(
                            and(
                                eq(threadFiles.id, params.fileId),
                                eq(threadFiles.userId, userId)
                            )
                        );

                    if (!row) {
                        return jsonError('Not found', 404);
                    }

                    const buffer = await fetchXaiFileContent(row.xaiFileId, apiKey);
                    const inline = XAI_INLINE_MEDIA_TYPES.has(row.mediaType);
                    const contentType = inline ? row.mediaType : 'application/octet-stream';
                    const disposition = inline ? 'inline' : 'attachment';

                    return new Response(buffer, {
                        headers: {
                            'Content-Type': contentType,
                            'Content-Disposition': `${disposition}; filename="${safeInlineFilename(row.filename)}"`,
                        },
                    });
                } catch {
                    return jsonError('Failed to load file', 500);
                }
            },
        },
    },
});
