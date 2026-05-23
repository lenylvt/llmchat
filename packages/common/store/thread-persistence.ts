import type { Thread, ThreadItem } from '@repo/shared/types';

export type ThreadPersistenceApi = {
    getThreads: () => Promise<Thread[]>;
    getThread: (threadId: string) => Promise<Thread | null>;
    createThread: (input: { id: string; title?: string }) => Promise<Thread>;
    updateThread: (input: { id: string; title: string }) => Promise<void>;
    deleteThread: (threadId: string) => Promise<void>;
    getThreadItems: (threadId: string) => Promise<ThreadItem[]>;
    upsertThreadItem: (item: ThreadItem) => Promise<void>;
    deleteThreadItem: (itemId: string) => Promise<void>;
};

let api: ThreadPersistenceApi | null = null;

export function registerThreadPersistence(persistence: ThreadPersistenceApi) {
    api = persistence;
}

export function unregisterThreadPersistence() {
    api = null;
}

export function getThreadPersistence(): ThreadPersistenceApi {
    if (!api) {
        throw new Error('Thread persistence not registered. Call registerThreadPersistence first.');
    }
    return api;
}

export function hasThreadPersistence(): boolean {
    return api !== null;
}
