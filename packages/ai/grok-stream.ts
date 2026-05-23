import type { CoreMessage } from 'ai';
import type { Source } from '@repo/shared/types';
import { getXaiApiKey } from './providers';
import {
    buildXaiResponsesInput,
    messagesHaveXaiFileIds,
    XAI_RESPONSES_TOOLS,
} from './xai-responses-input';
import { isXaiFileIngestError } from './xai-file-ready';
import { sleep } from './sleep';
import { mergeSources, sourcesFromAnswerText, sourcesFromXaiResponse } from './xai-citations';
import type { ActivityController } from './workflow/activity';
import { ingestXaiActivityEvent } from './workflow/activity-stream';

export type GrokStreamResult = { text: string; sources: Source[] };

const SOURCE_EVENT_TYPES = new Set(['response.completed']);

export function grokMessagesNeedFileStream(messages: CoreMessage[]): boolean {
    return messagesHaveXaiFileIds(messages);
}

type StreamGrokOptions = {
    model: string;
    messages: CoreMessage[];
    system: string;
    signal?: AbortSignal;
    onDelta: (delta: string, fullText: string) => void;
    reasoningEffort?: 'low' | 'medium' | 'high';
    activity?: ActivityController;
};

function extractSourcesFromStreamEvent(
    event: Record<string, unknown>,
    fullText: string
): Source[] {
    if (!SOURCE_EVENT_TYPES.has(String(event.type))) {
        return [];
    }

    const response = event.response;
    if (!response || typeof response !== 'object') {
        return [];
    }

    return sourcesFromXaiResponse(response as Record<string, unknown>, fullText);
}

async function readResponseStream(
    response: Response,
    onDelta: (delta: string, fullText: string) => void,
    activity?: ActivityController
): Promise<GrokStreamResult> {
    if (!response.body) throw new Error('No response body from xAI');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullText = '';
    let apiSources: Source[] = [];

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) continue;
            const data = trimmed.slice(5).trim();
            if (!data || data === '[DONE]') continue;

            try {
                const event = JSON.parse(data) as Record<string, unknown>;
                if (activity) {
                    ingestXaiActivityEvent(event, activity);
                }

                if (event.type === 'response.output_text.delta' && typeof event.delta === 'string') {
                    fullText += event.delta;
                    onDelta(event.delta, fullText);
                    continue;
                }

                const found = extractSourcesFromStreamEvent(event, fullText);
                if (found.length > 0) {
                    apiSources = found;
                }
            } catch {
                // ignore malformed SSE chunks
            }
        }
    }

    const sources = mergeSources(apiSources, sourcesFromAnswerText(fullText));

    return { text: fullText, sources };
}

const INGEST_RETRY_DELAYS_MS = [0, 2000, 4000, 6000];

export async function streamGrokCompletion({
    model,
    messages,
    system,
    signal,
    onDelta,
    reasoningEffort,
    activity,
}: StreamGrokOptions): Promise<GrokStreamResult> {
    const apiKey = getXaiApiKey();
    if (!apiKey) throw new Error('XAI_API_KEY is not configured');

    const body: Record<string, unknown> = {
        model,
        input: buildXaiResponsesInput(messages, system),
        tools: XAI_RESPONSES_TOOLS,
        stream: true,
    };

    if (reasoningEffort) {
        body.reasoning = { effort: reasoningEffort };
    }

    let lastError = 'xAI responses error';

    for (let attempt = 0; attempt < INGEST_RETRY_DELAYS_MS.length; attempt++) {
        if (INGEST_RETRY_DELAYS_MS[attempt] > 0) {
            await sleep(INGEST_RETRY_DELAYS_MS[attempt], signal);
        }

        const response = await fetch('https://api.x.ai/v1/responses', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify(body),
            signal,
        });

        if (response.ok) {
            return readResponseStream(response, onDelta, activity);
        }

        const errText = await response.text().catch(() => '');
        lastError = errText || `xAI responses error ${response.status}`;

        const canRetry =
            attempt < INGEST_RETRY_DELAYS_MS.length - 1 && isXaiFileIngestError(lastError);
        if (!canRetry) {
            throw new Error(lastError);
        }
    }

    throw new Error(lastError);
}
