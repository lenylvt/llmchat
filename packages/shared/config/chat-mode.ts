export enum ChatMode {
    Standard = 'standard',
    /** @deprecated Legacy stored value; normalized to Standard */
    Web = 'web',
    Deep4 = 'deep-4',
    Deep16 = 'deep-16',
}

export const ChatModeConfig: Record<
    ChatMode,
    {
        webSearch: boolean;
        xSearch: boolean;
        imageUpload: boolean;
        retry: boolean;
        isNew?: boolean;
        isAuthRequired?: boolean;
        multiAgentCount?: 4 | 16;
    }
> = {
    [ChatMode.Standard]: {
        webSearch: true,
        xSearch: true,
        imageUpload: true,
        retry: true,
        isAuthRequired: false,
    },
    [ChatMode.Web]: {
        webSearch: true,
        xSearch: true,
        imageUpload: true,
        retry: true,
        isAuthRequired: false,
    },
    [ChatMode.Deep4]: {
        webSearch: true,
        xSearch: true,
        imageUpload: true,
        retry: false,
        isAuthRequired: true,
        multiAgentCount: 4,
    },
    [ChatMode.Deep16]: {
        webSearch: true,
        xSearch: true,
        imageUpload: true,
        retry: false,
        isAuthRequired: true,
        multiAgentCount: 16,
    },
};

export const getChatModeName = (mode: ChatMode) => {
    switch (mode) {
        case ChatMode.Standard:
        case ChatMode.Web:
            return 'Normal';
        case ChatMode.Deep4:
            return 'Pro · 4 agents';
        case ChatMode.Deep16:
            return 'Deep · 16 agents';
    }
};

/** Modes shown in the chat mode selector. */
export const SELECTABLE_CHAT_MODES = [
    ChatMode.Standard,
    ChatMode.Deep4,
    ChatMode.Deep16,
] as const;

export const normalizeChatMode = (mode: unknown): ChatMode => {
    if (mode === ChatMode.Web) return ChatMode.Standard;
    if (typeof mode === 'string' && Object.values(ChatMode).includes(mode as ChatMode)) {
        return mode as ChatMode;
    }
    return ChatMode.Standard;
};
