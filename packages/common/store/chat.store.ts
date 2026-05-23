'use client';

import { ChatMode, normalizeChatMode } from '@repo/shared/config';
import { Thread, ThreadArtifact, ThreadFileAttachment, ThreadItem } from '@repo/shared/types';
import {
    artifactsEqual,
    sanitizeThreadItemForPersist,
    truncateArtifactForPersist,
} from '@repo/shared/utils';
import { nanoid } from 'nanoid';
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { useAppStore } from './app.store';
import { getThreadPersistence, hasThreadPersistence } from './thread-persistence';

const CONFIG_KEY = 'chat-config';

const defaultConfig = {
    customInstructions: '',
    useWebSearch: false,
    showSuggestions: true,
    chatMode: ChatMode.Standard,
};

const loadConfig = () => {
    if (typeof window === 'undefined') return defaultConfig;
    try {
        const configStr = localStorage.getItem(CONFIG_KEY);
        if (!configStr) return defaultConfig;
        const parsed = JSON.parse(configStr) as Record<string, unknown>;
        return {
            ...defaultConfig,
            ...parsed,
            chatMode: normalizeChatMode(parsed.chatMode),
        };
    } catch {
        return defaultConfig;
    }
};

const ARTIFACT_PERSIST_DEBOUNCE_MS = 450;
const artifactPersistTimers = new Map<string, ReturnType<typeof setTimeout>>();

const saveConfig = (partial: Record<string, unknown>) => {
    if (typeof window === 'undefined') return;
    const existing = loadConfig();
    localStorage.setItem(CONFIG_KEY, JSON.stringify({ ...existing, ...partial }));
};

type State = {
    isGenerating: boolean;
    useWebSearch: boolean;
    customInstructions: string;
    showSuggestions: boolean;
    editor: unknown;
    chatMode: ChatMode;
    imageAttachment: { base64?: string; file?: File };
    pendingFileAttachments: ThreadFileAttachment[];
    pendingFileUploadCount: number;
    abortController: AbortController | null;
    threads: Thread[];
    threadItems: ThreadItem[];
    currentThreadId: string | null;
    activeThreadItemView: string | null;
    isLoadingThreads: boolean;
    isLoadingThreadItems: boolean;
    currentSources: string[];
};

type Actions = {
    setEditor: (editor: unknown) => void;
    setImageAttachment: (imageAttachment: { base64?: string; file?: File }) => void;
    clearImageAttachment: () => void;
    addPendingFileAttachment: (file: ThreadFileAttachment) => void;
    removePendingFileAttachment: (id: string) => void;
    clearPendingFileAttachments: () => void;
    beginPendingFileUpload: () => void;
    endPendingFileUpload: () => void;
    setIsGenerating: (isGenerating: boolean) => void;
    stopGeneration: () => void;
    setAbortController: (abortController: AbortController) => void;
    createThread: (optimisticId: string, thread?: Pick<Thread, 'title'>) => Promise<Thread>;
    setChatMode: (chatMode: ChatMode) => void;
    updateThread: (thread: Pick<Thread, 'id' | 'title'>) => Promise<void>;
    getThread: (threadId: string) => Promise<Thread | null>;
    createThreadItem: (threadItem: ThreadItem) => Promise<void>;
    updateThreadItem: (threadId: string, threadItem: Partial<ThreadItem>) => Promise<void>;
    switchThread: (threadId: string) => void;
    startNewChat: () => void;
    setActiveThreadItemView: (threadItemId: string) => void;
    setCustomInstructions: (customInstructions: string) => void;
    deleteThreadItem: (threadItemId: string) => Promise<void>;
    deleteThread: (threadId: string) => Promise<void>;
    getPreviousThreadItems: (threadId?: string) => ThreadItem[];
    getCurrentThreadItem: (threadId?: string) => ThreadItem | null;
    removeFollowupThreadItems: (threadItemId: string) => Promise<void>;
    getThreadItems: (threadId: string) => Promise<ThreadItem[]>;
    loadThreadItems: (threadId: string) => Promise<void>;
    clearAllThreads: () => void;
    setCurrentSources: (sources: string[]) => void;
    setUseWebSearch: (useWebSearch: boolean) => void;
    setShowSuggestions: (showSuggestions: boolean) => void;
    loadThreads: () => Promise<void>;
    getThreadArtifact: (threadId?: string) => ThreadArtifact | null;
    setThreadArtifact: (threadId: string, artifact: ThreadArtifact | null) => Promise<void>;
};

const persistItemQueue = new Map<string, ThreadItem>();
let persistTimeout: ReturnType<typeof setTimeout> | null = null;

const flushPersistQueue = async () => {
    if (!hasThreadPersistence()) {
        persistItemQueue.clear();
        return;
    }
    const api = getThreadPersistence();
    const items = Array.from(persistItemQueue.values());
    persistItemQueue.clear();
    for (const item of items) {
        try {
            await api.upsertThreadItem(sanitizeThreadItemForPersist(item));
        } catch (e) {
            console.error('Failed to persist thread item', e, { itemId: item.id });
        }
    }
};

const queuePersistItem = (item: ThreadItem) => {
    if (!hasThreadPersistence()) return;
    persistItemQueue.set(item.id, item);
    if (!persistTimeout) {
        persistTimeout = setTimeout(() => {
            persistTimeout = null;
            void flushPersistQueue();
        }, 500);
    }
};

export const useChatStore = create(
    immer<State & Actions>((set, get) => {
        const config = loadConfig();

        return {
            isGenerating: false,
            editor: undefined,
            threads: [],
            chatMode: config.chatMode,
            threadItems: [],
            useWebSearch: config.useWebSearch,
            customInstructions: config.customInstructions,
            currentThreadId: null,
            activeThreadItemView: null,
            imageAttachment: { base64: undefined, file: undefined },
            pendingFileAttachments: [],
            pendingFileUploadCount: 0,
            abortController: null,
            isLoadingThreads: false,
            isLoadingThreadItems: false,
            currentSources: [],
            showSuggestions: config.showSuggestions,

            loadThreads: async () => {
                if (!hasThreadPersistence()) return;
                set(s => {
                    s.isLoadingThreads = true;
                });
                try {
                    const threads = await getThreadPersistence().getThreads();
                    set(s => {
                        s.threads = threads;
                        s.isLoadingThreads = false;
                    });
                } catch (e) {
                    console.error(e);
                    set(s => {
                        s.isLoadingThreads = false;
                    });
                }
            },

            setCustomInstructions: customInstructions => {
                saveConfig({ customInstructions });
                set(s => {
                    s.customInstructions = customInstructions;
                });
            },

            setImageAttachment: imageAttachment => {
                set(s => {
                    s.imageAttachment = imageAttachment;
                });
            },

            clearImageAttachment: () => {
                set(s => {
                    s.imageAttachment = { base64: undefined, file: undefined };
                });
            },

            addPendingFileAttachment: file => {
                set(s => {
                    s.pendingFileAttachments.push(file);
                });
            },

            removePendingFileAttachment: id => {
                set(s => {
                    s.pendingFileAttachments = s.pendingFileAttachments.filter(f => f.id !== id);
                });
                void fetch(`/api/files/${id}`, { method: 'DELETE', credentials: 'include' });
            },

            clearPendingFileAttachments: () => {
                set(s => {
                    s.pendingFileAttachments = [];
                });
            },

            beginPendingFileUpload: () => {
                set(s => {
                    s.pendingFileUploadCount += 1;
                });
            },

            endPendingFileUpload: () => {
                set(s => {
                    s.pendingFileUploadCount = Math.max(0, s.pendingFileUploadCount - 1);
                });
            },

            setActiveThreadItemView: threadItemId => {
                set(s => {
                    s.activeThreadItemView = threadItemId;
                });
            },

            setShowSuggestions: showSuggestions => {
                saveConfig({ showSuggestions });
                set(s => {
                    s.showSuggestions = showSuggestions;
                });
            },

            setUseWebSearch: useWebSearch => {
                saveConfig({ useWebSearch });
                set(s => {
                    s.useWebSearch = useWebSearch;
                });
            },

            setChatMode: chatMode => {
                saveConfig({ chatMode });
                set(s => {
                    s.chatMode = chatMode;
                });
            },

            getThreadItems: async threadId => {
                if (!hasThreadPersistence()) {
                    return get().threadItems.filter(item => item.threadId === threadId);
                }
                try {
                    return await getThreadPersistence().getThreadItems(threadId);
                } catch (e) {
                    console.error('getThreadItems failed', e);
                    return [];
                }
            },

            setCurrentSources: sources => {
                set(s => {
                    s.currentSources = sources;
                });
            },

            setEditor: editor =>
                set(s => {
                    s.editor = editor;
                }),

            setIsGenerating: isGenerating => {
                set(s => {
                    s.isGenerating = isGenerating;
                });
            },

            stopGeneration: () => {
                set(s => {
                    s.isGenerating = false;
                    s.abortController?.abort();
                });
            },

            setAbortController: abortController =>
                set(s => {
                    s.abortController = abortController;
                }),

            loadThreadItems: async threadId => {
                if (!hasThreadPersistence()) return;
                if (get().isGenerating && get().currentThreadId === threadId) {
                    return;
                }
                set(s => {
                    s.isLoadingThreadItems = true;
                });
                try {
                    const persisted = await getThreadPersistence().getThreadItems(threadId);
                    set(s => {
                        const local = s.threadItems.filter(i => i.threadId === threadId);
                        const merged = new Map(persisted.map(item => [item.id, item]));

                        for (const item of local) {
                            const existing = merged.get(item.id);
                            if (!existing) {
                                merged.set(item.id, item);
                                continue;
                            }
                            const preferLocal =
                                item.updatedAt >= existing.updatedAt ||
                                (!!item.answer?.text && !existing.answer?.text) ||
                                (item.status === 'PENDING' && existing.status !== 'COMPLETED');
                            if (preferLocal) {
                                merged.set(item.id, item);
                            }
                        }

                        s.threadItems = [
                            ...s.threadItems.filter(i => i.threadId !== threadId),
                            ...merged.values(),
                        ];
                        s.isLoadingThreadItems = false;
                    });
                } catch (e) {
                    console.error(e);
                    set(s => {
                        s.isLoadingThreadItems = false;
                    });
                }
            },

            clearAllThreads: () => {
                set(s => {
                    s.threads = [];
                    s.threadItems = [];
                });
            },

            getThread: async threadId => {
                const localThread = get().threads.find(thread => thread.id === threadId) ?? null;
                if (!hasThreadPersistence()) return localThread;
                try {
                    return (await getThreadPersistence().getThread(threadId)) ?? localThread;
                } catch (e) {
                    console.error('getThread failed', e);
                    return localThread;
                }
            },

            createThread: async (optimisticId, thread) => {
                const threadId = optimisticId || nanoid();
                const newThread: Thread = {
                    id: threadId,
                    title: thread?.title || 'New Chat',
                    updatedAt: new Date(),
                    createdAt: new Date(),
                };

                set(s => {
                    s.threads.unshift(newThread);
                    s.currentThreadId = newThread.id;
                });

                if (hasThreadPersistence()) {
                    try {
                        const persisted = await getThreadPersistence().createThread({
                            id: threadId,
                            title: newThread.title,
                        });
                        set(s => {
                            const idx = s.threads.findIndex(t => t.id === threadId);
                            if (idx >= 0) s.threads[idx] = persisted;
                        });
                    } catch (e) {
                        console.error('createThread failed', e);
                    }
                }

                return newThread;
            },

            updateThread: async thread => {
                const existing = get().threads.find(t => t.id === thread.id);
                if (!existing) return;

                const updated: Thread = { ...existing, ...thread, updatedAt: new Date() };
                set(s => {
                    const idx = s.threads.findIndex(t => t.id === thread.id);
                    if (idx >= 0) s.threads[idx] = updated;
                });

                if (hasThreadPersistence() && thread.title) {
                    try {
                        await getThreadPersistence().updateThread({
                            id: thread.id,
                            title: thread.title,
                        });
                    } catch (e) {
                        console.error('updateThread failed', e);
                    }
                }
            },

            createThreadItem: async threadItem => {
                const threadId = threadItem.threadId || get().currentThreadId;
                if (!threadId) return;
                set(s => {
                    const idx = s.threadItems.findIndex(t => t.id === threadItem.id);
                    if (idx >= 0) s.threadItems[idx] = { ...threadItem, threadId };
                    else s.threadItems.push({ ...threadItem, threadId });
                });
                queuePersistItem({ ...threadItem, threadId });
            },

            updateThreadItem: async (threadId, partial) => {
                if (!partial.id || !threadId) return;

                const existing = get().threadItems.find(t => t.id === partial.id);
                const updated: ThreadItem = existing
                    ? { ...existing, ...partial, threadId, updatedAt: new Date() }
                    : ({
                          id: partial.id,
                          threadId,
                          query: partial.query || '',
                          mode: partial.mode || ChatMode.Standard,
                          createdAt: new Date(),
                          updatedAt: new Date(),
                          ...partial,
                      } as ThreadItem);

                set(s => {
                    const idx = s.threadItems.findIndex(t => t.id === partial.id);
                    if (idx >= 0) s.threadItems[idx] = updated;
                    else s.threadItems.push(updated);
                });

                queuePersistItem(updated);
            },

            switchThread: threadId => {
                const thread = get().threads.find(t => t.id === threadId);
                saveConfig({ currentThreadId: threadId });
                set(s => {
                    s.currentThreadId = threadId;
                });
                void get().loadThreadItems(threadId);
            },

            startNewChat: () => {
                saveConfig({ currentThreadId: null });
                set(s => {
                    s.currentThreadId = null;
                    s.threadItems = [];
                    s.activeThreadItemView = null;
                });
            },

            deleteThreadItem: async threadItemId => {
                const threadId = get().currentThreadId;
                if (!threadId) return;

                set(s => {
                    s.threadItems = s.threadItems.filter(t => t.id !== threadItemId);
                });

                if (hasThreadPersistence()) {
                    try {
                        await getThreadPersistence().deleteThreadItem(threadItemId);
                        const remaining = get().threadItems.length;
                        if (remaining === 0) {
                            await get().deleteThread(threadId);
                            if (typeof window !== 'undefined') {
                                window.location.href = '/chat';
                            }
                        }
                    } catch (e) {
                        console.error('deleteThreadItem failed', e);
                    }
                }
            },

            deleteThread: async threadId => {
                if (hasThreadPersistence()) {
                    try {
                        await getThreadPersistence().deleteThread(threadId);
                    } catch (e) {
                        console.error('deleteThread failed', e);
                    }
                }
                set(s => {
                    s.threads = s.threads.filter(t => t.id !== threadId);
                    s.currentThreadId = s.threads[0]?.id ?? null;
                });
            },

            removeFollowupThreadItems: async threadItemId => {
                const threadItem = get().threadItems.find(t => t.id === threadItemId);
                if (!threadItem) return;
                const toRemove = get().threadItems.filter(
                    t => t.threadId === threadItem.threadId && t.createdAt > threadItem.createdAt
                );
                for (const item of toRemove) {
                    await get().deleteThreadItem(item.id);
                }
            },

            getPreviousThreadItems: threadId => {
                const id = threadId || get().currentThreadId;
                const items = get()
                    .threadItems.filter(i => i.threadId === id)
                    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
                return items.length > 1 ? items.slice(0, -1) : [];
            },

            getCurrentThreadItem: threadId => {
                const id = threadId || get().currentThreadId;
                if (!id) return null;
                const items = get()
                    .threadItems.filter(i => i.threadId === id)
                    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
                return items[items.length - 1] || null;
            },

            getThreadArtifact: threadId => {
                const id = threadId || get().currentThreadId;
                if (!id) return null;
                return get().threads.find(t => t.id === id)?.artifact ?? null;
            },

            setThreadArtifact: async (threadId, artifact) => {
                const existing = get().threads.find(t => t.id === threadId);
                if (!existing) return;

                const normalized = truncateArtifactForPersist(artifact);
                if (artifactsEqual(existing.artifact, normalized)) return;

                const updated: Thread = {
                    ...existing,
                    artifact: normalized,
                    updatedAt: new Date(),
                };

                set(s => {
                    const idx = s.threads.findIndex(t => t.id === threadId);
                    if (idx >= 0) s.threads[idx] = updated;
                });

                if (!hasThreadPersistence()) return;

                const prior = artifactPersistTimers.get(threadId);
                if (prior) clearTimeout(prior);

                artifactPersistTimers.set(
                    threadId,
                    setTimeout(() => {
                        artifactPersistTimers.delete(threadId);
                        void (async () => {
                            try {
                                await getThreadPersistence().updateThreadArtifact({
                                    threadId,
                                    artifact: normalized,
                                });
                            } catch (e) {
                                console.error('updateThreadArtifact failed', e);
                            }
                        })();
                    }, ARTIFACT_PERSIST_DEBOUNCE_MS)
                );
            },
        };
    })
);

if (typeof window !== 'undefined') {
    const config = loadConfig();
    useChatStore.setState({
        chatMode: config.chatMode,
        useWebSearch: config.useWebSearch,
        showSuggestions: config.showSuggestions,
        customInstructions: config.customInstructions,
        currentThreadId: (config as { currentThreadId?: string }).currentThreadId ?? null,
    });
}
