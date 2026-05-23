import type { CoreMessage } from 'ai';
import type { Source } from '@repo/shared/types';
import { getModelFromChatMode, getMultiAgentReasoningEffort } from './models';
import { getXaiApiKey } from './providers';
import { streamGrokCompletion } from './grok-stream';
import { collectXaiFileIdsFromMessages, waitForXaiFilesReady } from './xai-file-ready';
import { ChatMode } from '@repo/shared/config';
import type { ActivityController } from './workflow/activity';

export type GrokCompletionResult = {
    text: string;
    sources: Source[];
};

export type RunGrokCompletionOptions = {
    mode: ChatMode;
    messages: CoreMessage[];
    system: string;
    signal?: AbortSignal;
    onDelta: (delta: string) => void;
    activity?: ActivityController;
};

export async function runGrokCompletion({
    mode,
    messages,
    system,
    signal,
    onDelta,
    activity,
}: RunGrokCompletionOptions): Promise<GrokCompletionResult> {
    const fileIds = collectXaiFileIdsFromMessages(messages);
    const isDeep = mode === ChatMode.Deep4 || mode === ChatMode.Deep16;

    if (fileIds.length > 0) {
        await waitForXaiFilesReady(fileIds, getXaiApiKey(), signal);
    }

    // Always use raw Responses SSE: real-time server tool calls + web_search_call / x_search_call payloads.
    const model = isDeep ? 'grok-4.20-multi-agent' : getModelFromChatMode(mode);
    const reasoningEffort = getMultiAgentReasoningEffort(mode);

    return streamGrokCompletion({
        model,
        messages,
        system,
        signal,
        reasoningEffort,
        activity,
        onDelta: (delta, _full) => onDelta(delta),
    });
}
