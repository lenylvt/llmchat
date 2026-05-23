'use client';
import { ChatModeOptions } from '@repo/common/components';
import { useAgentStream, useCopyText } from '@repo/common/hooks';
import { useChatStore } from '@repo/common/store';
import { ChatMode } from '@repo/shared/config';
import { ThreadItem } from '@repo/shared/types';
import { Button, DropdownMenu, DropdownMenuTrigger } from '@repo/ui';
import { IconCheck, IconCopy, IconMarkdown, IconRefresh, IconTrash } from '@tabler/icons-react';
import type { CSSProperties, ReactNode } from 'react';
import { forwardRef, useState } from 'react';

type MessageActionsProps = {
    threadItem: ThreadItem;
    isLast: boolean;
    staggerStart?: number;
    withEnterAnimation?: boolean;
};

function ActionWrap({
    stagger,
    withEnterAnimation,
    children,
}: {
    stagger: number;
    withEnterAnimation?: boolean;
    children: ReactNode;
}) {
    if (!withEnterAnimation) {
        return <>{children}</>;
    }

    return (
        <div
            className="animate-enter"
            style={
                {
                    '--stagger': stagger,
                    '--delay': '100ms',
                } as CSSProperties
            }
        >
            {children}
        </div>
    );
}

export const MessageActions = forwardRef<HTMLDivElement, MessageActionsProps>(
    ({ threadItem, isLast, staggerStart = 5, withEnterAnimation = true }, ref) => {
        const { handleSubmit } = useAgentStream();
        const removeThreadItem = useChatStore(state => state.deleteThreadItem);
        const getThreadItems = useChatStore(state => state.getThreadItems);
        const useWebSearch = useChatStore(state => state.useWebSearch);
        const [chatMode, setChatMode] = useState<ChatMode>(threadItem.mode);
        const { copyToClipboard, status, copyMarkdown, markdownCopyStatus } = useCopyText();

        let stagger = staggerStart;

        const actionButtonClass =
            'text-muted-foreground/70 hover:text-muted-foreground hover:bg-muted/60 transition-colors active:scale-[0.96]';

        return (
            <div className="-mt-0.5 flex flex-row items-center gap-0.5 pt-0.5">
                {threadItem?.answer?.text && (
                    <ActionWrap
                        stagger={stagger++}
                        withEnterAnimation={withEnterAnimation}
                    >
                        <Button
                            variant="ghost"
                            size="icon-xs"
                            className={actionButtonClass}
                            onClick={() => {
                                if (ref && 'current' in ref && ref.current) {
                                    copyToClipboard(ref.current || '');
                                }
                            }}
                            tooltip="Copy"
                        >
                            {status === 'copied' ? (
                                <IconCheck size={14} strokeWidth={1.75} />
                            ) : (
                                <IconCopy size={14} strokeWidth={1.75} />
                            )}
                        </Button>
                    </ActionWrap>
                )}

                {threadItem?.answer?.text && (
                    <ActionWrap
                        stagger={stagger++}
                        withEnterAnimation={withEnterAnimation}
                    >
                        <Button
                            variant="ghost"
                            size="icon-xs"
                            className={actionButtonClass}
                            onClick={() => {
                                copyMarkdown(
                                    `${threadItem?.answer?.text}\n\n## References\n${threadItem?.sources
                                        ?.map(source => `[${source.index}] ${source.link}`)
                                        .join('\n')}`
                                );
                            }}
                            tooltip="Copy Markdown"
                        >
                            {markdownCopyStatus === 'copied' ? (
                                <IconCheck size={14} strokeWidth={1.75} />
                            ) : (
                                <IconMarkdown size={14} strokeWidth={1.75} />
                            )}
                        </Button>
                    </ActionWrap>
                )}

                {threadItem.status !== 'ERROR' && threadItem.answer?.status !== 'HUMAN_REVIEW' && (
                    <ActionWrap
                        stagger={stagger++}
                        withEnterAnimation={withEnterAnimation}
                    >
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon-xs"
                                    className={actionButtonClass}
                                    tooltip="Rewrite"
                                >
                                    <IconRefresh size={14} strokeWidth={1.75} />
                                </Button>
                            </DropdownMenuTrigger>
                            <ChatModeOptions
                                chatMode={chatMode}
                                setChatMode={async mode => {
                                    setChatMode(mode);
                                    const formData = new FormData();
                                    formData.append('query', threadItem.query || '');
                                    const threadItems = await getThreadItems(threadItem.threadId);
                                    handleSubmit({
                                        formData,
                                        existingThreadItemId: threadItem.id,
                                        newChatMode: mode as ChatMode,
                                        messages: threadItems,
                                        useWebSearch: useWebSearch,
                                    });
                                }}
                            />
                        </DropdownMenu>
                    </ActionWrap>
                )}

                {isLast && (
                    <ActionWrap
                        stagger={stagger++}
                        withEnterAnimation={withEnterAnimation}
                    >
                        <Button
                            variant="ghost"
                            size="icon-xs"
                            className={actionButtonClass}
                            onClick={() => {
                                removeThreadItem(threadItem.id);
                            }}
                            tooltip="Remove"
                        >
                            <IconTrash size={14} strokeWidth={1.75} />
                        </Button>
                    </ActionWrap>
                )}
            </div>
        );
    }
);

MessageActions.displayName = 'MessageActions';
