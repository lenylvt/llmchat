import type { CoreMessage } from 'ai';
import type { Source } from '@repo/shared/types';
import { streamText } from 'ai';
import { getModelFromChatMode } from './models';
import { getXai, getXaiApiKey } from './providers';
import { streamGrokCompletion } from './grok-stream';
import { collectXaiFileIdsFromMessages, waitForXaiFilesReady } from './xai-file-ready';
import { getXaiSearchTools } from './xai-search-tools';
import { ChatMode } from '@repo/shared/config';
import { consumeStreamText } from './workflow/utils';
import { sourcesFromAnswerText } from './xai-citations';

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
};

export async function runGrokCompletion({
    mode,
    messages,
    system,
    signal,
    onDelta,
}: RunGrokCompletionOptions): Promise<GrokCompletionResult> {
    const fileIds = collectXaiFileIdsFromMessages(messages);

    if (fileIds.length > 0) {
        await waitForXaiFilesReady(fileIds, getXaiApiKey(), signal);
        const model =
            mode === ChatMode.Deep4 || mode === ChatMode.Deep16
                ? 'grok-4.20-multi-agent'
                : getModelFromChatMode(mode);
        const reasoningEffort =
            mode === ChatMode.Deep16 ? 'high' : mode === ChatMode.Deep4 ? 'medium' : undefined;

        return streamGrokCompletion({
            model,
            messages,
            system,
            signal,
            reasoningEffort,
            onDelta: (delta, _full) => onDelta(delta),
        });
    }

    const xai = getXai();
    const modelEnum = getModelFromChatMode(mode);
    const isDeep = mode === ChatMode.Deep4 || mode === ChatMode.Deep16;

    const result = streamText({
        model: xai.responses(isDeep ? 'grok-4.20-multi-agent' : modelEnum),
        messages,
        system,
        abortSignal: signal,
        ...(isDeep
            ? {
                  providerOptions: {
                      xai: {
                          reasoning: {
                              effort: mode === ChatMode.Deep16 ? 'high' : 'medium',
                          },
                      },
                  },
              }
            : {}),
        tools: getXaiSearchTools(xai),
    });

    const text = await consumeStreamText(result, (delta, _full) => onDelta(delta));
    return { text, sources: sourcesFromAnswerText(text) };
}
