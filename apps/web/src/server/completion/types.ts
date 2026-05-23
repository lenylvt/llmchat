import { ChatMode } from '@repo/shared/config';
import {
    MAX_PERSIST_ARTIFACT_CHARS,
    MAX_PERSIST_IMAGE_ATTACHMENT_CHARS,
} from '@repo/shared/utils';
import { z } from 'zod';

const threadArtifactSchema = z.object({
    title: z.string().max(500),
    content: z.string().max(MAX_PERSIST_ARTIFACT_CHARS),
    updatedAt: z.string(),
    updatedBy: z.enum(['assistant', 'user']),
});

export const completionRequestSchema = z.object({
    threadId: z.string(),
    threadItemId: z.string(),
    parentThreadItemId: z.string(),
    prompt: z.string(),
    messages: z
        .array(
            z.object({
                role: z.enum(['user', 'assistant', 'system']),
                content: z.union([z.string(), z.array(z.record(z.unknown()))]),
            })
        )
        .max(200),
    mode: z.nativeEnum(ChatMode),
    maxIterations: z.number().optional(),
    webSearch: z.boolean().optional(),
    showSuggestions: z.boolean().optional(),
    customInstructions: z.string().optional(),
    threadArtifact: threadArtifactSchema.nullable().optional(),
    userImageAttachment: z.string().max(MAX_PERSIST_IMAGE_ATTACHMENT_CHARS).optional(),
});

export type CompletionRequestType = z.infer<typeof completionRequestSchema>;

export type StreamController = ReadableStreamDefaultController<Uint8Array>;

export const SSE_HEADERS = {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept',
    'X-Accel-Buffering': 'no',
} as const;
