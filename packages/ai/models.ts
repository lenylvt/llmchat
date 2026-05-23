import { ChatMode } from '@repo/shared/config';
import { CoreMessage } from 'ai';

export enum ModelEnum {
    Grok43 = 'grok-4.3',
    Grok420MultiAgent = 'grok-4.20-multi-agent',
}

export type Model = {
    id: ModelEnum;
    name: string;
    maxTokens: number;
    contextWindow: number;
};

export const models: Model[] = [
    {
        id: ModelEnum.Grok43,
        name: 'Grok 4.3',
        maxTokens: 16384,
        contextWindow: 131072,
    },
    {
        id: ModelEnum.Grok420MultiAgent,
        name: 'Grok 4.20 Multi-Agent',
        maxTokens: 16384,
        contextWindow: 131072,
    },
];

export const getModelFromChatMode = (mode?: string): ModelEnum => {
    switch (mode) {
        case ChatMode.Deep4:
        case ChatMode.Deep16:
            return ModelEnum.Grok420MultiAgent;
        case ChatMode.Web:
        case ChatMode.Standard:
        default:
            return ModelEnum.Grok43;
    }
};

export const getChatModeMaxTokens = (mode: ChatMode) => {
    switch (mode) {
        case ChatMode.Deep4:
        case ChatMode.Deep16:
            return models.find(m => m.id === ModelEnum.Grok420MultiAgent)!.contextWindow;
        default:
            return models.find(m => m.id === ModelEnum.Grok43)!.contextWindow;
    }
};

export const estimateTokensByWordCount = (text: string): number => {
    const words = text?.trim().split(/\s+/) || [];
    return Math.ceil(words.length * 1.35);
};

export const estimateTokensForMessages = (messages: CoreMessage[]): number => {
    let total = 0;
    for (const message of messages) {
        if (typeof message.content === 'string') {
            total += estimateTokensByWordCount(message.content);
        } else if (Array.isArray(message.content)) {
            for (const part of message.content) {
                if (part.type === 'text') total += estimateTokensByWordCount(part.text);
            }
        }
    }
    return total;
};

export const trimMessageHistoryEstimated = (messages: CoreMessage[], chatMode: ChatMode) => {
    const maxTokens = getChatModeMaxTokens(chatMode);
    let trimmedMessages = [...messages];
    if (trimmedMessages.length <= 1) {
        return { trimmedMessages, tokenCount: estimateTokensForMessages(trimmedMessages) };
    }
    const latest = trimmedMessages.pop()!;
    let total = estimateTokensForMessages(trimmedMessages) + estimateTokensForMessages([latest]);
    while (total > maxTokens && trimmedMessages.length > 0) {
        trimmedMessages.shift();
        total = estimateTokensForMessages(trimmedMessages) + estimateTokensForMessages([latest]);
    }
    trimmedMessages.push(latest);
    return { trimmedMessages, tokenCount: total };
};
