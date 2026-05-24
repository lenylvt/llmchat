'use client';
import { useAgentStream, useCopyText } from '@repo/common/hooks';
import { useChatStore } from '@repo/common/store';
import { ChatMode } from '@repo/shared/config';
import { ThreadItem } from '@repo/shared/types';
import { Button, DropdownMenu, DropdownMenuTrigger } from '@repo/ui';
import { AnimateEnter } from '../../animate-enter';
import { ChatModeOptions } from '../../chat-input/chat-actions';
import {
    IconCheck,
    IconCopy,
    IconMarkdown,
    IconRefresh,
    IconTrash,
} from '@tabler/icons-react';
import { AnimatePresence, motion } from 'framer-motion';
import { type ComponentType, forwardRef, useState } from 'react';

type ActionIcon = ComponentType<{ size?: number; strokeWidth?: number }>;

type MessageActionsProps = {
    threadItem: ThreadItem;
    isLast: boolean;
    staggerStart?: number;
    withEnterAnimation?: boolean;
};

const iconToggleTransition = { type: 'spring' as const, duration: 0.12, bounce: 0 };

const actionButtonClass =
    'text-muted-foreground/70 hover:text-muted-foreground hover:bg-muted/60 transition-[color,background-color,transform] duration-150 active:scale-[0.96] motion-reduce:active:scale-100 relative before:absolute before:-inset-1 before:content-[""]';

const deleteButtonClass = `${actionButtonClass} hover:text-destructive hover:bg-destructive/10`;

function ActionToggleIcon({
    active,
    ActiveIcon,
    InactiveIcon,
}: {
    active: boolean;
    ActiveIcon: ActionIcon;
    InactiveIcon: ActionIcon;
}) {
    const iconProps = { size: 14, strokeWidth: 1.75 };

    return (
        <span className="relative grid size-3.5 place-items-center" aria-hidden>
            <AnimatePresence mode="wait" initial={false}>
                {active ? (
                    <motion.span
                        key="active"
                        className="col-start-1 row-start-1"
                        initial={{ scale: 0.25, opacity: 0, filter: 'blur(4px)' }}
                        animate={{ scale: 1, opacity: 1, filter: 'blur(0px)' }}
                        exit={{ scale: 0.25, opacity: 0, filter: 'blur(4px)' }}
                        transition={iconToggleTransition}
                    >
                        <ActiveIcon {...iconProps} />
                    </motion.span>
                ) : (
                    <motion.span
                        key="inactive"
                        className="col-start-1 row-start-1"
                        initial={{ scale: 0.25, opacity: 0, filter: 'blur(4px)' }}
                        animate={{ scale: 1, opacity: 1, filter: 'blur(0px)' }}
                        exit={{ scale: 0.25, opacity: 0, filter: 'blur(4px)' }}
                        transition={iconToggleTransition}
                    >
                        <InactiveIcon {...iconProps} />
                    </motion.span>
                )}
            </AnimatePresence>
        </span>
    );
}

export const MessageActions = forwardRef<HTMLDivElement, MessageActionsProps>(
    ({ threadItem, isLast, staggerStart = 5, withEnterAnimation = true }, copyTargetRef) => {
        const { handleSubmit } = useAgentStream();
        const removeThreadItem = useChatStore(state => state.deleteThreadItem);
        const getThreadItems = useChatStore(state => state.getThreadItems);
        const useWebSearch = useChatStore(state => state.useWebSearch);
        const [chatMode, setChatMode] = useState<ChatMode>(threadItem.mode);
        const { copyToClipboard, status, copyMarkdown, markdownCopyStatus } = useCopyText();

        const toolbar = (
            <div
                className="-mt-0.5 inline-flex flex-row items-center gap-0.5 rounded-lg border border-border/50 bg-muted/35 p-0.5"
                role="toolbar"
                aria-label="Message actions"
            >
                {threadItem?.answer?.text && (
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        className={actionButtonClass}
                        onClick={() => {
                            if (
                                copyTargetRef &&
                                'current' in copyTargetRef &&
                                copyTargetRef.current
                            ) {
                                void copyToClipboard(copyTargetRef.current);
                            }
                        }}
                        tooltip={status === 'copied' ? 'Copied' : 'Copy'}
                    >
                        <ActionToggleIcon
                            active={status === 'copied'}
                            ActiveIcon={IconCheck}
                            InactiveIcon={IconCopy}
                        />
                    </Button>
                )}

                {threadItem?.answer?.text && (
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        className={actionButtonClass}
                        onClick={() => {
                            void copyMarkdown(
                                `${threadItem?.answer?.text}\n\n## References\n${threadItem?.sources
                                    ?.map(source => `[${source.index}] ${source.link}`)
                                    .join('\n')}`
                            );
                        }}
                        tooltip={
                            markdownCopyStatus === 'copied' ? 'Copied' : 'Copy Markdown'
                        }
                    >
                        <ActionToggleIcon
                            active={markdownCopyStatus === 'copied'}
                            ActiveIcon={IconCheck}
                            InactiveIcon={IconMarkdown}
                        />
                    </Button>
                )}

                {threadItem.status !== 'ERROR' && threadItem.answer?.status !== 'HUMAN_REVIEW' && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon-sm"
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
                )}

                {isLast && (
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        className={deleteButtonClass}
                        onClick={() => {
                            removeThreadItem(threadItem.id);
                        }}
                        tooltip="Remove"
                    >
                        <IconTrash size={14} strokeWidth={1.75} />
                    </Button>
                )}
            </div>
        );

        if (!withEnterAnimation) {
            return toolbar;
        }

        return (
            <AnimateEnter stagger={staggerStart} delayMs={50} className="pt-0.5">
                {toolbar}
            </AnimateEnter>
        );
    }
);

MessageActions.displayName = 'MessageActions';
