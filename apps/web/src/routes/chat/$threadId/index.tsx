import { TableOfMessages, Thread } from '@repo/common/components';
import { useChatStore } from '@repo/common/store';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useStickToBottom } from 'use-stick-to-bottom';

export const Route = createFileRoute('/chat/$threadId/')({
    component: ChatSessionPage,
});

function ChatSessionPage() {
    const { threadId } = Route.useParams();
    const navigate = useNavigate();
    const isGenerating = useChatStore(state => state.isGenerating);
    const [shouldScroll, setShouldScroll] = useState(isGenerating);
    const { scrollRef, contentRef } = useStickToBottom({
        stiffness: 1,
        damping: 0,
    });
    const switchThread = useChatStore(state => state.switchThread);
    const getThread = useChatStore(state => state.getThread);
    const threads = useChatStore(state => state.threads);

    useEffect(() => {
        if (isGenerating) {
            setShouldScroll(true);
        } else {
            const timer = setTimeout(() => {
                setShouldScroll(false);
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [isGenerating]);

    useEffect(() => {
        if (!threadId) return;
        const localThread = threads.find(thread => thread.id === threadId);
        if (localThread) {
            switchThread(localThread.id);
            return;
        }
        if (isGenerating) {
            useChatStore.setState({
                currentThreadId: threadId,
            });
            return;
        }

        getThread(threadId).then(thread => {
            if (thread?.id) {
                switchThread(thread.id);
            } else {
                navigate({ to: '/chat' });
            }
        });
    }, [threadId, threads, isGenerating, getThread, switchThread, navigate]);

    return (
        <div
            className="no-scrollbar flex w-full flex-1 flex-col items-center overflow-y-auto px-8"
            ref={shouldScroll ? scrollRef : undefined}
        >
            <div className="mx-auto w-full max-w-3xl px-4 pb-[200px] pt-2" ref={contentRef}>
                <Thread />
            </div>
            <TableOfMessages />
        </div>
    );
}
