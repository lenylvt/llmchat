import { useWorkflowWorker } from '@repo/ai/worker';
import { ChatMode, ChatModeConfig } from '@repo/shared/config';
import { ThreadItem } from '@repo/shared/types';
import { buildCoreMessagesFromThreadItems } from '@repo/shared/utils';
import { useNavigate, useParams } from '@tanstack/react-router';
import { nanoid } from 'nanoid';
import { createContext, ReactNode, useCallback, useContext, useMemo } from 'react';
import { useSession } from '../lib/auth-client';
import { useApiKeysStore, useAppStore, useChatStore } from '../store';

export type AgentContextType = {
    runAgent: (body: Record<string, unknown>) => Promise<void>;
    handleSubmit: (args: {
        formData: FormData;
        newThreadId?: string;
        existingThreadItemId?: string;
        newChatMode?: string;
        messages?: ThreadItem[];
        useWebSearch?: boolean;
        showSuggestions?: boolean;
    }) => Promise<void>;
    updateContext: (threadId: string, data: Record<string, unknown>) => void;
};

const AgentContext = createContext<AgentContextType | undefined>(undefined);

const EVENT_TYPES = [
    'steps',
    'sources',
    'answer',
    'error',
    'status',
    'suggestions',
    'toolCalls',
    'toolResults',
    'object',
];

export const AgentProvider = ({ children }: { children: ReactNode }) => {
    const params = useParams({ strict: false });
    const currentThreadId = params?.threadId;
    const { data: session } = useSession();
    const isSignedIn = !!session?.user;
    const navigate = useNavigate();

    const {
        updateThreadItem,
        setIsGenerating,
        setAbortController,
        createThreadItem,
        setCurrentSources,
        updateThread,
        chatMode,
        customInstructions,
    } = useChatStore(state => ({
        updateThreadItem: state.updateThreadItem,
        setIsGenerating: state.setIsGenerating,
        setAbortController: state.setAbortController,
        createThreadItem: state.createThreadItem,
        setCurrentSources: state.setCurrentSources,
        updateThread: state.updateThread,
        chatMode: state.chatMode,
        customInstructions: state.customInstructions,
    }));

    const apiKeys = useApiKeysStore(state => state.getAllKeys);
    const hasApiKeyForChatMode = useApiKeysStore(state => state.hasApiKeyForChatMode);
    const setShowSignInModal = useAppStore(state => state.setShowSignInModal);

    const threadItemMap = useMemo(() => new Map<string, ThreadItem>(), []);

    const handleThreadItemUpdate = useCallback(
        (
            threadId: string,
            threadItemId: string,
            eventType: string,
            eventData: Record<string, unknown>,
            parentThreadItemId?: string
        ) => {
            const storeItem = useChatStore
                .getState()
                .threadItems.find(item => item.id === threadItemId);
            const prevItem = threadItemMap.get(threadItemId) || storeItem || ({} as ThreadItem);
            const answerPayload = eventData.answer as ThreadItem['answer'] | undefined;

            // Server emits the full merged map each time; replace to avoid duplicate ghost keys.
            const replaceToolCalls =
                eventType === 'toolCalls' && eventData.toolCalls
                    ? { toolCalls: eventData.toolCalls as ThreadItem['toolCalls'] }
                    : {};

            const replaceToolResults =
                eventType === 'toolResults' && eventData.toolResults
                    ? { toolResults: eventData.toolResults as ThreadItem['toolResults'] }
                    : {};

            const updatedItem: ThreadItem = {
                ...prevItem,
                query: (eventData?.query as string) || prevItem.query || '',
                mode: (eventData?.mode as ChatMode) || prevItem.mode,
                threadId,
                parentId: parentThreadItemId || prevItem.parentId,
                id: threadItemId,
                object: (eventData?.object as Record<string, unknown>) || prevItem.object,
                createdAt: prevItem.createdAt || new Date(),
                updatedAt: new Date(),
                ...replaceToolCalls,
                ...replaceToolResults,
                ...(eventType === 'answer'
                    ? {
                          answer: {
                              ...prevItem.answer,
                              ...answerPayload,
                              text: answerPayload?.text || prevItem.answer?.text || '',
                          },
                          status:
                              answerPayload?.status === 'COMPLETED'
                                  ? 'COMPLETED'
                                  : prevItem.status === 'COMPLETED'
                                    ? 'COMPLETED'
                                    : prevItem.status || 'PENDING',
                      }
                    : eventType === 'status'
                      ? { status: eventData.status as ThreadItem['status'] }
                      : eventType === 'error'
                        ? {
                              status: 'ERROR',
                              error:
                                  (eventData.error as { error?: string })?.error ||
                                  (typeof eventData.error === 'string'
                                      ? eventData.error
                                      : 'Generation failed'),
                          }
                        : eventType === 'toolCalls' || eventType === 'toolResults'
                          ? {}
                          : { [eventType]: eventData[eventType] }),
            } as ThreadItem;

            threadItemMap.set(threadItemId, updatedItem);
            updateThreadItem(threadId, updatedItem);
        },
        [threadItemMap, updateThreadItem]
    );

    const { startWorkflow, abortWorkflow } = useWorkflowWorker(
        useCallback(
            (data: Record<string, unknown>) => {
                if (
                    data?.threadId &&
                    data?.threadItemId &&
                    data.event &&
                    EVENT_TYPES.includes(data.event as string)
                ) {
                    handleThreadItemUpdate(
                        data.threadId as string,
                        data.threadItemId as string,
                        data.event as string,
                        data,
                        data.parentThreadItemId as string | undefined
                    );
                }

                if (data.type === 'done') {
                    setIsGenerating(false);
                    if (data?.threadId && data?.threadItemId) {
                        const finalStatus =
                            data.status === 'error'
                                ? 'ERROR'
                                : data.status === 'aborted'
                                  ? 'ABORTED'
                                  : 'COMPLETED';
                        updateThreadItem(data.threadId as string, {
                            id: data.threadItemId as string,
                            status: finalStatus,
                        });
                        threadItemMap.delete(data.threadItemId as string);
                    }
                }
            },
            [handleThreadItemUpdate, setIsGenerating, threadItemMap, updateThreadItem]
        )
    );

    const runAgent = useCallback(
        async (body: Record<string, unknown>) => {
            const abortController = new AbortController();
            setAbortController(abortController);
            setIsGenerating(true);

            abortController.signal.addEventListener('abort', () => {
                setIsGenerating(false);
                updateThreadItem(body.threadId as string, {
                    id: body.threadItemId as string,
                    status: 'ABORTED',
                });
            });

            try {
                const response = await fetch('/api/completion', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                    credentials: 'include',
                    cache: 'no-store',
                    signal: abortController.signal,
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    setIsGenerating(false);
                    updateThreadItem(body.threadId as string, {
                        id: body.threadItemId as string,
                        status: 'ERROR',
                        error: errorText,
                    });
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                if (!response.body) throw new Error('No response body received');

                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let buffer = '';

                while (true) {
                    const { value, done } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });
                    const messages = buffer.split('\n\n');
                    buffer = messages.pop() || '';

                    for (const message of messages) {
                        if (!message.trim()) continue;
                        const eventMatch = message.match(/^event: (.+)$/m);
                        const dataMatch = message.match(/^data: (.+)$/m);

                        if (eventMatch && dataMatch) {
                            const currentEvent = eventMatch[1];
                            try {
                                const data = JSON.parse(dataMatch[1]);
                                if (
                                    EVENT_TYPES.includes(currentEvent) &&
                                    data?.threadId &&
                                    data?.threadItemId
                                ) {
                                    handleThreadItemUpdate(
                                        data.threadId,
                                        data.threadItemId,
                                        currentEvent,
                                        data,
                                        data.parentThreadItemId
                                    );
                                } else if (currentEvent === 'done' && data.type === 'done') {
                                    setIsGenerating(false);
                                    if (data.threadId && data.threadItemId) {
                                        const finalStatus =
                                            data.status === 'error'
                                                ? 'ERROR'
                                                : data.status === 'aborted'
                                                  ? 'ABORTED'
                                                  : 'COMPLETED';
                                        updateThreadItem(data.threadId, {
                                            id: data.threadItemId,
                                            status: finalStatus,
                                        });
                                        threadItemMap.delete(data.threadItemId);
                                    }
                                }
                            } catch {
                                // ignore parse errors
                            }
                        }
                    }
                }
            } catch (streamError: unknown) {
                setIsGenerating(false);
                if (streamError instanceof Error && streamError.name === 'AbortError') {
                    updateThreadItem(body.threadId as string, {
                        id: body.threadItemId as string,
                        status: 'ABORTED',
                        error: 'Generation aborted',
                    });
                } else {
                    updateThreadItem(body.threadId as string, {
                        id: body.threadItemId as string,
                        status: 'ERROR',
                        error:
                            streamError instanceof Error
                                ? streamError.message
                                : 'Generation failed',
                    });
                }
            } finally {
                setIsGenerating(false);
            }
        },
        [
            setAbortController,
            setIsGenerating,
            updateThreadItem,
            handleThreadItemUpdate,
            threadItemMap,
        ]
    );

    const handleSubmit = useCallback(
        async ({
            formData,
            newThreadId,
            existingThreadItemId,
            newChatMode,
            messages,
            showSuggestions,
        }: {
            formData: FormData;
            newThreadId?: string;
            existingThreadItemId?: string;
            newChatMode?: string;
            messages?: ThreadItem[];
            showSuggestions?: boolean;
        }) => {
            const mode = (newChatMode || chatMode) as ChatMode;
            if (!isSignedIn && ChatModeConfig[mode]?.isAuthRequired) {
                navigate({ to: '/sign-in' });
                return;
            }

            const threadId = currentThreadId?.toString() || newThreadId;
            if (!threadId) return;

            updateThread({ id: threadId, title: formData.get('query') as string });

            const optimisticAiThreadItemId = existingThreadItemId || nanoid();
            const query = formData.get('query') as string;
            const imageAttachment = formData.get('imageAttachment') as string;
            const fileAttachmentsRaw = formData.get('fileAttachments') as string | null;
            const fileAttachments = fileAttachmentsRaw
                ? (JSON.parse(fileAttachmentsRaw) as ThreadItem['fileAttachments'])
                : undefined;

            const aiThreadItem: ThreadItem = {
                id: optimisticAiThreadItemId,
                createdAt: new Date(),
                updatedAt: new Date(),
                status: 'QUEUED',
                threadId,
                query,
                imageAttachment: imageAttachment || undefined,
                fileAttachments,
                mode,
            };

            createThreadItem(aiThreadItem);
            setIsGenerating(true);
            setCurrentSources([]);

            const coreMessages = buildCoreMessagesFromThreadItems({
                messages: messages || [],
                query,
                imageAttachment: imageAttachment || undefined,
                fileAttachments,
            });

            const webSearch = ChatModeConfig[mode]?.webSearch ?? true;

            if (hasApiKeyForChatMode(mode)) {
                const abortController = new AbortController();
                setAbortController(abortController);
                setIsGenerating(true);

                abortController.signal.addEventListener('abort', () => {
                    setIsGenerating(false);
                    abortWorkflow();
                    updateThreadItem(threadId, {
                        id: optimisticAiThreadItemId,
                        status: 'ABORTED',
                    });
                });

                startWorkflow({
                    mode,
                    question: query,
                    threadId,
                    messages: coreMessages,
                    threadItemId: optimisticAiThreadItemId,
                    parentThreadItemId: '',
                    customInstructions,
                    apiKeys: { XAI_API_KEY: apiKeys().XAI_API_KEY },
                });
            } else {
                runAgent({
                    mode: newChatMode || chatMode,
                    prompt: query,
                    threadId,
                    messages: coreMessages,
                    threadItemId: optimisticAiThreadItemId,
                    customInstructions,
                    parentThreadItemId: '',
                    webSearch,
                    showSuggestions: showSuggestions ?? true,
                });
            }
        },
        [
            isSignedIn,
            currentThreadId,
            chatMode,
            navigate,
            updateThread,
            createThreadItem,
            setIsGenerating,
            setCurrentSources,
            abortWorkflow,
            startWorkflow,
            customInstructions,
            apiKeys,
            hasApiKeyForChatMode,
            updateThreadItem,
            runAgent,
            setAbortController,
        ]
    );

    const updateContext = useCallback(
        (threadId: string, data: Record<string, unknown>) => {
            updateThreadItem(threadId, {
                id: data.threadItemId as string,
                parentId: data.parentThreadItemId as string,
                threadId: data.threadId as string,
                metadata: data.context as Record<string, unknown>,
            });
        },
        [updateThreadItem]
    );

    const contextValue = useMemo(
        () => ({ runAgent, handleSubmit, updateContext }),
        [runAgent, handleSubmit, updateContext]
    );

    return <AgentContext.Provider value={contextValue}>{children}</AgentContext.Provider>;
};

export const useAgentStream = (): AgentContextType => {
    const context = useContext(AgentContext);
    if (!context) {
        throw new Error('useAgentStream must be used within an AgentProvider');
    }
    return context;
};
