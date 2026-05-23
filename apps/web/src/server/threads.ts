import { getAuth } from '../auth';
import { createDb } from '../db';
import { threadItems, threads } from '../db/schema';
import {
    deleteThreadFilesFromDb,
    deleteThreadItemFilesFromDb,
    linkThreadFilesToItem,
} from './xai-files';
import { ChatMode } from '@repo/shared/config';
import type { Thread, ThreadItem } from '@repo/shared/types';
import { createServerFn } from '@tanstack/react-start';
import { getRequestHeaders } from '@tanstack/react-start/server';
import { env } from 'cloudflare:workers';
import { and, desc, eq } from 'drizzle-orm';

const THREAD_LIST_LIMIT = 50;

function parseJsonColumn<T>(raw: string | null | undefined, fallback: T): T {
    if (!raw) return fallback;
    try {
        return JSON.parse(raw) as T;
    } catch {
        console.error('Invalid JSON in thread_items column');
        return fallback;
    }
}

function requireXaiApiKey(): string {
    const apiKey = env.XAI_API_KEY;
    if (!apiKey) {
        throw new Error('XAI_API_KEY not configured');
    }
    return apiKey;
}

async function requireSession() {
    const auth = getAuth();
    const headers = getRequestHeaders();
    const session = await auth.api.getSession({ headers });
    if (!session?.user?.id) {
        throw new Error('Unauthorized');
    }
    return session.user.id;
}

function rowToThread(row: typeof threads.$inferSelect): Thread {
    return {
        id: row.id,
        title: row.title,
        createdAt: new Date(row.createdAt),
        updatedAt: new Date(row.updatedAt),
    };
}

function rowToThreadItem(row: typeof threadItems.$inferSelect): ThreadItem {
    return {
        id: row.id,
        threadId: row.threadId,
        parentId: row.parentId ?? undefined,
        query: row.query,
        mode: row.mode as ChatMode,
        status: (row.status as ThreadItem['status']) ?? 'PENDING',
        createdAt: new Date(row.createdAt),
        updatedAt: new Date(row.updatedAt),
        answer: parseJsonColumn(row.answer, undefined),
        steps: parseJsonColumn(row.steps, undefined),
        sources: parseJsonColumn(row.sources, undefined),
        toolCalls: parseJsonColumn(row.toolCalls, undefined),
        toolResults: parseJsonColumn(row.toolResults, undefined),
        metadata: parseJsonColumn(row.metadata, undefined),
        suggestions: parseJsonColumn(row.suggestions, undefined),
        imageAttachment: row.imageAttachment ?? undefined,
        fileAttachments: parseJsonColumn(row.fileAttachments, undefined),
    };
}

function threadItemToRow(item: ThreadItem, userId: string) {
    return {
        id: item.id,
        threadId: item.threadId,
        parentId: item.parentId ?? null,
        userId,
        query: item.query,
        mode: item.mode,
        status: item.status ?? 'PENDING',
        answer: item.answer ? JSON.stringify(item.answer) : null,
        steps: item.steps ? JSON.stringify(item.steps) : null,
        sources: item.sources ? JSON.stringify(item.sources) : null,
        toolCalls: item.toolCalls ? JSON.stringify(item.toolCalls) : null,
        toolResults: item.toolResults ? JSON.stringify(item.toolResults) : null,
        metadata: item.metadata ? JSON.stringify(item.metadata) : null,
        suggestions: item.suggestions ? JSON.stringify(item.suggestions) : null,
        imageAttachment: item.imageAttachment ?? null,
        fileAttachments: item.fileAttachments?.length
            ? JSON.stringify(item.fileAttachments)
            : null,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
    };
}

export const getThreadsFn = createServerFn({ method: 'GET' }).handler(async () => {
    const userId = await requireSession();
    const db = createDb(env.DB);
    const rows = await db
        .select()
        .from(threads)
        .where(eq(threads.userId, userId))
        .orderBy(desc(threads.updatedAt))
        .limit(THREAD_LIST_LIMIT);
    return rows.map(rowToThread);
});

export const getThreadFn = createServerFn({ method: 'GET' })
    .inputValidator((threadId: string) => threadId)
    .handler(async ({ data: threadId }) => {
        const userId = await requireSession();
        const db = createDb(env.DB);
        const [row] = await db
            .select()
            .from(threads)
            .where(and(eq(threads.id, threadId), eq(threads.userId, userId)));
        return row ? rowToThread(row) : null;
    });

export const createThreadFn = createServerFn({ method: 'POST' })
    .inputValidator((input: { id: string; title?: string }) => input)
    .handler(async ({ data }) => {
        const userId = await requireSession();
        const db = createDb(env.DB);
        const now = new Date();
        const thread = {
            id: data.id,
            userId,
            title: data.title ?? 'New Chat',
            createdAt: now,
            updatedAt: now,
        };
        await db.insert(threads).values(thread);
        return rowToThread(thread);
    });

export const updateThreadFn = createServerFn({ method: 'POST' })
    .inputValidator((input: { id: string; title: string }) => input)
    .handler(async ({ data }) => {
        const userId = await requireSession();
        const db = createDb(env.DB);
        await db
            .update(threads)
            .set({ title: data.title, updatedAt: new Date() })
            .where(and(eq(threads.id, data.id), eq(threads.userId, userId)));
    });

export const deleteThreadFn = createServerFn({ method: 'POST' })
    .inputValidator((threadId: string) => threadId)
    .handler(async ({ data: threadId }) => {
        const userId = await requireSession();
        await deleteThreadFilesFromDb(threadId, requireXaiApiKey());
        const db = createDb(env.DB);
        await db
            .delete(threads)
            .where(and(eq(threads.id, threadId), eq(threads.userId, userId)));
    });

export const getThreadItemsFn = createServerFn({ method: 'GET' })
    .inputValidator((threadId: string) => threadId)
    .handler(async ({ data: threadId }) => {
        const userId = await requireSession();
        const db = createDb(env.DB);
        const rows = await db
            .select()
            .from(threadItems)
            .where(and(eq(threadItems.threadId, threadId), eq(threadItems.userId, userId)))
            .orderBy(threadItems.createdAt);
        return rows.map(rowToThreadItem);
    });

export const upsertThreadItemFn = createServerFn({ method: 'POST' })
    .inputValidator((item: ThreadItem) => item)
    .handler(async ({ data: item }) => {
        const userId = await requireSession();
        const db = createDb(env.DB);
        const row = threadItemToRow(item, userId);
        if (item.fileAttachments?.length) {
            await linkThreadFilesToItem(
                item.fileAttachments.map(f => f.id),
                userId,
                item.threadId,
                item.id
            );
        }

        await db.insert(threadItems).values(row).onConflictDoUpdate({
            target: threadItems.id,
            set: {
                query: row.query,
                answer: row.answer,
                steps: row.steps,
                sources: row.sources,
                status: row.status,
                metadata: row.metadata,
                suggestions: row.suggestions,
                toolCalls: row.toolCalls,
                toolResults: row.toolResults,
                imageAttachment: row.imageAttachment,
                fileAttachments: row.fileAttachments,
                updatedAt: new Date(),
            },
        });
    });

export const deleteThreadItemFn = createServerFn({ method: 'POST' })
    .inputValidator((itemId: string) => itemId)
    .handler(async ({ data: itemId }) => {
        const userId = await requireSession();
        await deleteThreadItemFilesFromDb(itemId, requireXaiApiKey());
        const db = createDb(env.DB);
        await db
            .delete(threadItems)
            .where(and(eq(threadItems.id, itemId), eq(threadItems.userId, userId)));
    });
