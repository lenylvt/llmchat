'use client';

import { ArtifactCard } from '../thread/components/artifact-card';
import { useChatStore } from '@repo/common/store';
import { useParams, useRouterState } from '@tanstack/react-router';
import { useShallow } from 'zustand/react/shallow';

export function ArtifactCornerAnchor() {
    const pathname = useRouterState({ select: s => s.location.pathname });
    const { threadId } = useParams({ strict: false });
    const currentThreadId = threadId?.toString() ?? '';
    const isChatThread = pathname.startsWith('/chat/') && currentThreadId.length > 0;
    const artifact = useChatStore(useShallow(state => state.getThreadArtifact(currentThreadId)));

    if (!isChatThread) {
        return null;
    }

    return (
        <div className="pointer-events-auto shrink-0">
            <ArtifactCard threadId={currentThreadId} artifact={artifact} />
        </div>
    );
}
