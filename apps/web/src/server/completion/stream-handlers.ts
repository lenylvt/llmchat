import { setXaiApiKey } from '@repo/ai/providers';
import { runWorkflow } from '@repo/ai/workflow';
import { logger } from '@repo/shared/logger';
import { env } from 'cloudflare:workers';
import type { CompletionRequestType, StreamController } from './types';

export function sendMessage(
    controller: StreamController,
    encoder: TextEncoder,
    payload: Record<string, unknown>
) {
    try {
        if (payload.content && typeof payload.content === 'string') {
            payload.content = (payload.content as string).replace(/\\n/g, '\n');
        }
        const message = `event: ${payload.type}\ndata: ${JSON.stringify(payload)}\n\n`;
        controller.enqueue(encoder.encode(message));
    } catch (error) {
        logger.error('Error serializing message payload', error);
        const errorMessage = `event: done\ndata: ${JSON.stringify({
            type: 'done',
            status: 'error',
            error: 'Failed to serialize payload',
            threadId: payload.threadId,
            threadItemId: payload.threadItemId,
            parentThreadItemId: payload.parentThreadItemId,
        })}\n\n`;
        controller.enqueue(encoder.encode(errorMessage));
    }
}

export async function executeStream({
    controller,
    encoder,
    data,
    abortController,
    userId,
}: {
    controller: StreamController;
    encoder: TextEncoder;
    data: CompletionRequestType;
    abortController: AbortController;
    userId?: string;
}): Promise<{ success: boolean }> {
    try {
        const { signal } = abortController;
        setXaiApiKey(env.XAI_API_KEY);

        const workflow = runWorkflow({
            mode: data.mode,
            question: data.prompt,
            threadId: data.threadId,
            threadItemId: data.threadItemId,
            messages: data.messages,
            customInstructions: data.customInstructions,
            webSearch: data.webSearch || false,
            config: {
                maxIterations: data.maxIterations || 3,
                signal,
            },
            showSuggestions: data.showSuggestions || false,
        });

        workflow.onAll((event, payload) => {
            sendMessage(controller, encoder, {
                type: event,
                threadId: data.threadId,
                threadItemId: data.threadItemId,
                parentThreadItemId: data.parentThreadItemId,
                query: data.prompt,
                mode: data.mode,
                webSearch: data.webSearch || false,
                showSuggestions: data.showSuggestions || false,
                [event]: payload,
            });
        });

        await workflow.start('router', {
            question: data.prompt,
        });

        sendMessage(controller, encoder, {
            type: 'done',
            status: 'complete',
            threadId: data.threadId,
            threadItemId: data.threadItemId,
            parentThreadItemId: data.parentThreadItemId,
        });

        return { success: true };
    } catch (error) {
        if (abortController.signal.aborted) {
            sendMessage(controller, encoder, {
                type: 'done',
                status: 'aborted',
                threadId: data.threadId,
                threadItemId: data.threadItemId,
                parentThreadItemId: data.parentThreadItemId,
            });
        } else {
            logger.error('Workflow execution error', error, {
                userId,
                threadId: data.threadId,
                mode: data.mode,
            });

            sendMessage(controller, encoder, {
                type: 'done',
                status: 'error',
                error: error instanceof Error ? error.message : String(error),
                threadId: data.threadId,
                threadItemId: data.threadItemId,
                parentThreadItemId: data.parentThreadItemId,
            });
        }
        throw error;
    }
}
