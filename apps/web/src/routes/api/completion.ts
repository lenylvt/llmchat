import { collectXaiFileIdsFromMessages } from '@repo/ai/xai-file-ready';
import { getAuth } from '../../auth';
import { ChatModeConfig } from '@repo/shared/config';
import { createFileRoute } from '@tanstack/react-router';
import type { CoreMessage } from 'ai';
import { executeStream } from '../../server/completion/stream-handlers';
import { completionRequestSchema, SSE_HEADERS } from '../../server/completion/types';
import { assertUserOwnsXaiFiles } from '../../server/xai-files';

export const Route = createFileRoute('/api/completion')({
    server: {
        handlers: {
            OPTIONS: async () => {
                return new Response(null, { headers: SSE_HEADERS });
            },
            POST: async ({ request }) => {
                try {
                    const auth = getAuth();
                    const session = await auth.api.getSession({ headers: request.headers });
                    const userId = session?.user?.id;

                    const parsed = await request.json().catch(() => ({}));
                    const validatedBody = completionRequestSchema.safeParse(parsed);

                    if (!validatedBody.success) {
                        return new Response(
                            JSON.stringify({
                                error: 'Invalid request body',
                                details: validatedBody.error.format(),
                            }),
                            { status: 400, headers: { 'Content-Type': 'application/json' } }
                        );
                    }

                    const { data } = validatedBody;

                    const xaiFileIds = collectXaiFileIdsFromMessages(
                        data.messages as CoreMessage[]
                    );

                    if (xaiFileIds.length > 0 && !userId) {
                        return new Response(JSON.stringify({ error: 'Authentication required' }), {
                            status: 401,
                            headers: { 'Content-Type': 'application/json' },
                        });
                    }

                    if (ChatModeConfig[data.mode]?.isAuthRequired && !userId) {
                        return new Response(JSON.stringify({ error: 'Authentication required' }), {
                            status: 401,
                            headers: { 'Content-Type': 'application/json' },
                        });
                    }

                    if (xaiFileIds.length > 0 && userId) {
                        try {
                            await assertUserOwnsXaiFiles(xaiFileIds, userId);
                        } catch {
                            return new Response(JSON.stringify({ error: 'File access denied' }), {
                                status: 403,
                                headers: { 'Content-Type': 'application/json' },
                            });
                        }
                    }

                    const encoder = new TextEncoder();
                    const abortController = new AbortController();

                    const stream = new ReadableStream({
                        async start(controller) {
                            try {
                                await executeStream({
                                    controller,
                                    encoder,
                                    data,
                                    abortController,
                                    userId,
                                });
                            } catch {
                                // errors handled in executeStream
                            } finally {
                                controller.close();
                            }
                        },
                        cancel() {
                            abortController.abort();
                        },
                    });

                    return new Response(stream, { headers: SSE_HEADERS });
                } catch (error) {
                    return new Response(
                        JSON.stringify({
                            error: error instanceof Error ? error.message : 'Internal error',
                        }),
                        { status: 500, headers: { 'Content-Type': 'application/json' } }
                    );
                }
            },
        },
    },
});
