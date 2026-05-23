import { createDb } from '../../../../db';
import { threadFiles } from '../../../../db/schema';
import { jsonError, requireSessionFromRequest } from '../../../../server/request-auth';
import { deleteXaiFile } from '../../../../server/xai-files';
import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import { and, eq } from 'drizzle-orm';

export const Route = createFileRoute('/api/files/$fileId/')({
    server: {
        handlers: {
            DELETE: async ({ request, params }) => {
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

                    await deleteXaiFile(row.xaiFileId, apiKey);
                    await db.delete(threadFiles).where(eq(threadFiles.id, params.fileId));

                    return new Response(JSON.stringify({ deleted: true }), {
                        headers: { 'Content-Type': 'application/json' },
                    });
                } catch {
                    return jsonError('Delete failed', 500);
                }
            },
        },
    },
});
