'use client';

import { useAppStore } from '@repo/common/store';
import { useChatStore } from '@repo/common/store';
import type { ThreadArtifact } from '@repo/shared/types';
import { isArtifactToolName } from '@repo/shared/utils';
import { Button } from '@repo/ui';
import { IconCheck, IconCopy, IconFileText, IconLoader2, IconTrash } from '@tabler/icons-react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArtifactEditorPanel } from './artifact-editor-panel';
import { toolPairsFromThreadItem } from './tool-activity-utils';

export type ArtifactCardProps = {
    threadId: string;
    artifact: ThreadArtifact | null;
    isToolPending?: boolean;
};

export const ArtifactCard = memo(({ threadId, artifact, isToolPending: isToolPendingProp }: ArtifactCardProps) => {
    const currentThreadItem = useChatStore(state => state.getCurrentThreadItem(threadId));
    const isToolPendingFromStore = useMemo(() => {
        if (!currentThreadItem) return false;
        return toolPairsFromThreadItem(currentThreadItem).some(
            pair =>
                isArtifactToolName(pair.toolCall.toolName) &&
                !pair.toolResult &&
                currentThreadItem.status === 'PENDING'
        );
    }, [currentThreadItem]);
    const isToolPending = isToolPendingProp ?? isToolPendingFromStore;
    const openSideDrawer = useAppStore(state => state.openSideDrawer);
    const updateSideDrawer = useAppStore(state => state.updateSideDrawer);
    const sideDrawerOpen = useAppStore(state => state.sideDrawer.open);
    const sideDrawerId = useAppStore(state => state.sideDrawer.id);
    const setThreadArtifact = useChatStore(state => state.setThreadArtifact);

    const lastAutoOpenRef = useRef<string | null>(null);
    const contentDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [localArtifact, setLocalArtifact] = useState<ThreadArtifact | null>(artifact);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        setLocalArtifact(artifact);
    }, [artifact]);

    const persistArtifact = useCallback(
        (next: ThreadArtifact | null) => {
            void setThreadArtifact(threadId, next);
        },
        [setThreadArtifact, threadId]
    );

    const handleContentChange = useCallback(
        (content: string) => {
            if (!localArtifact) return;
            const next = {
                ...localArtifact,
                content,
                updatedAt: new Date().toISOString(),
                updatedBy: 'user' as const,
            };
            setLocalArtifact(next);
            if (contentDebounceRef.current) clearTimeout(contentDebounceRef.current);
            contentDebounceRef.current = setTimeout(() => {
                persistArtifact(next);
            }, 450);
        },
        [localArtifact, persistArtifact]
    );

    const handleDelete = useCallback(() => {
        persistArtifact(null);
        if (sideDrawerId === 'artifact') {
            useAppStore.getState().dismissSideDrawer();
        }
    }, [persistArtifact, sideDrawerId]);

    const handleCopy = useCallback(async () => {
        const text = localArtifact?.content ?? '';
        if (!text) return;
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // ignore
        }
    }, [localArtifact?.content]);

    const drawerHeaderActions = useCallback(() => {
        if (!localArtifact) return null;
        return (
            <div className="flex shrink-0 flex-row items-center gap-1">
                <Button
                    type="button"
                    variant="secondary"
                    size="icon-xs"
                    tooltip={copied ? 'Copied' : 'Copy'}
                    onClick={() => void handleCopy()}
                >
                    {copied ? (
                        <IconCheck size={14} strokeWidth={2} />
                    ) : (
                        <IconCopy size={14} strokeWidth={2} />
                    )}
                </Button>
                <Button
                    type="button"
                    variant="secondary"
                    size="icon-xs"
                    tooltip="Delete document"
                    onClick={handleDelete}
                    className="text-destructive hover:text-destructive"
                >
                    <IconTrash size={14} strokeWidth={2} />
                </Button>
            </div>
        );
    }, [copied, handleCopy, handleDelete, localArtifact]);

    const drawerContent = useCallback(() => {
        if (!localArtifact) {
            return (
                <p className="text-muted-foreground px-1 py-6 text-sm">No document in this thread.</p>
            );
        }
        return (
            <ArtifactEditorPanel
                artifact={localArtifact}
                onContentChange={handleContentChange}
            />
        );
    }, [localArtifact, handleContentChange]);

    const drawerTitle = useCallback(
        () => (
            <p className="truncate">
                {localArtifact?.title?.trim() || artifact?.title?.trim() || 'Document'}
            </p>
        ),
        [artifact?.title, localArtifact?.title]
    );

    const openDrawer = useCallback(() => {
        openSideDrawer({
            id: 'artifact',
            title: drawerTitle,
            headerActions: drawerHeaderActions,
            renderContent: drawerContent,
        });
    }, [drawerContent, drawerHeaderActions, drawerTitle, openSideDrawer]);

    useEffect(() => {
        if (!sideDrawerOpen || sideDrawerId !== 'artifact') return;
        updateSideDrawer({
            title: drawerTitle,
            headerActions: drawerHeaderActions,
            renderContent: drawerContent,
        });
    }, [
        drawerContent,
        drawerHeaderActions,
        drawerTitle,
        sideDrawerId,
        sideDrawerOpen,
        updateSideDrawer,
    ]);

    useEffect(() => {
        if (!artifact || artifact.updatedBy !== 'assistant') return;
        if (lastAutoOpenRef.current === artifact.updatedAt) return;
        lastAutoOpenRef.current = artifact.updatedAt;
        openDrawer();
    }, [artifact, openDrawer]);

    const showTrigger = !!artifact || isToolPending;
    if (!showTrigger) return null;

    const isActive = sideDrawerOpen && sideDrawerId === 'artifact';

    return (
        <Button
            type="button"
            variant={isActive ? 'secondary' : 'bordered'}
            size="xs"
            rounded="lg"
            className="gap-1.5 shadow-subtle-xs"
            onClick={openDrawer}
        >
            {isToolPending && !artifact ? (
                <IconLoader2 size={14} strokeWidth={2} className="animate-spin" />
            ) : (
                <IconFileText size={14} strokeWidth={2} />
            )}
            Artifact
        </Button>
    );
});

ArtifactCard.displayName = 'ArtifactCard';
