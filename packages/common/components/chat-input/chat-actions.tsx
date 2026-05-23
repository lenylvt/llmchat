'use client';
import { DotSpinner } from '@repo/common/components';
import { useApiKeysStore, useChatStore } from '@repo/common/store';
import {
    ChatMode,
    ChatModeConfig,
    getChatModeName,
    SELECTABLE_CHAT_MODES,
} from '@repo/shared/config';
import {
    Button,
    cn,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from '@repo/ui';
import {
    IconArrowUp,
    IconAtom,
    IconChevronDown,
    IconMessageCircle,
    IconPlayerStopFilled,
} from '@tabler/icons-react';
import { useNavigate } from '@tanstack/react-router';
import { AnimatePresence, motion } from 'framer-motion';
import { useState, type ReactNode } from 'react';
import { BYOKIcon } from '../icons';
import { useSession } from '../../lib/auth-client';

const modeIcons: Record<(typeof SELECTABLE_CHAT_MODES)[number], ReactNode> = {
    [ChatMode.Standard]: (
        <IconMessageCircle size={16} className="text-muted-foreground" strokeWidth={2} />
    ),
    [ChatMode.Deep4]: <IconAtom size={16} className="text-brand" strokeWidth={2} />,
    [ChatMode.Deep16]: <IconAtom size={16} className="text-brand" strokeWidth={2} />,
};

export const chatOptions = SELECTABLE_CHAT_MODES.map(mode => ({
    label: getChatModeName(mode),
    value: mode,
    icon: modeIcons[mode],
}));

export const ChatModeButton = () => {
    const chatMode = useChatStore(state => state.chatMode);
    const setChatMode = useChatStore(state => state.setChatMode);
    const [isChatModeOpen, setIsChatModeOpen] = useState(false);
    const hasApiKeyForChatMode = useApiKeysStore(state => state.hasApiKeyForChatMode);
    const { data: session } = useSession();
    const navigate = useNavigate();

    const selectedMode = SELECTABLE_CHAT_MODES.includes(
        chatMode as (typeof SELECTABLE_CHAT_MODES)[number]
    )
        ? chatMode
        : ChatMode.Standard;
    const selectedOption =
        chatOptions.find(option => option.value === selectedMode) ?? chatOptions[0];

    const handleSelectMode = (mode: ChatMode) => {
        if (ChatModeConfig[mode]?.isAuthRequired && !session?.user) {
            setIsChatModeOpen(false);
            void navigate({ to: '/sign-in' });
            return;
        }

        setChatMode(mode);
        setIsChatModeOpen(false);
    };

    return (
        <DropdownMenu open={isChatModeOpen} onOpenChange={setIsChatModeOpen}>
            <DropdownMenuTrigger asChild>
                <Button variant="secondary" size="xs" className="gap-1.5">
                    {selectedOption?.icon}
                    <span className="text-xs font-medium">{selectedOption?.label}</span>
                    <IconChevronDown size={14} strokeWidth={2} />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
                align="start"
                side="bottom"
                className="no-scrollbar max-h-[320px] w-[300px] overflow-y-auto p-1"
            >
                <DropdownMenuLabel className="text-muted-foreground px-2 py-1.5 text-xs font-normal">
                    Chat mode
                </DropdownMenuLabel>
                <DropdownMenuGroup>
                    {chatOptions.map(option => (
                        <DropdownMenuItem
                            key={option.value}
                            onClick={() => handleSelectMode(option.value)}
                            className="h-auto cursor-pointer rounded-md px-2 py-2"
                        >
                            <div className="flex w-full min-w-0 items-center gap-2">
                                <div className="shrink-0">{option.icon}</div>
                                <span className="truncate text-sm font-medium">{option.label}</span>
                                {selectedMode === option.value && (
                                    <span className="text-brand ml-auto shrink-0 text-xs">
                                        Active
                                    </span>
                                )}
                            </div>
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuGroup>
                {hasApiKeyForChatMode(chatMode) && (
                    <div className="text-muted-foreground flex items-center gap-1 border-t px-2 py-2 text-xs">
                        <BYOKIcon size={14} /> Using your xAI API key
                    </div>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
};

export const WebSearchButton = () => null;

export const GeneratingStatus = () => (
    <div className="text-muted-foreground flex flex-row items-center gap-1 px-2 text-xs">
        <DotSpinner /> Generating...
    </div>
);

export const ChatModeOptions = ({
    chatMode,
    setChatMode,
}: {
    chatMode: ChatMode;
    setChatMode: (mode: ChatMode) => void;
}) => (
    <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>Chat mode</DropdownMenuLabel>
        <DropdownMenuGroup>
            {chatOptions.map(option => (
                <DropdownMenuItem key={option.value} onSelect={() => setChatMode(option.value)}>
                    {option.label}
                    {chatMode === option.value && ' ✓'}
                </DropdownMenuItem>
            ))}
        </DropdownMenuGroup>
    </DropdownMenuContent>
);

export const SendStopButton = ({
    isGenerating,
    isChatPage,
    stopGeneration,
    hasTextInput,
    sendMessage,
}: {
    isGenerating: boolean;
    isChatPage: boolean;
    stopGeneration: () => void;
    hasTextInput: boolean;
    sendMessage: () => void;
}) => (
    <div className="flex flex-row items-center gap-2">
        <AnimatePresence mode="wait" initial={false}>
            {isGenerating ? (
                <motion.div
                    key="stop"
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                >
                    <Button
                        size="icon-sm"
                        variant="default"
                        onClick={stopGeneration}
                        tooltip="Stop"
                    >
                        <IconPlayerStopFilled size={14} strokeWidth={2} />
                    </Button>
                </motion.div>
            ) : (
                <motion.div
                    key="send"
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                >
                    <Button
                        size="icon-sm"
                        tooltip="Send"
                        variant={hasTextInput ? 'default' : 'secondary'}
                        disabled={!hasTextInput || isGenerating}
                        onClick={sendMessage}
                    >
                        <IconArrowUp size={16} strokeWidth={2} />
                    </Button>
                </motion.div>
            )}
        </AnimatePresence>
    </div>
);
