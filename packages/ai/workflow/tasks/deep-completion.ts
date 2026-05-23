import { createTask } from '@repo/orchestrator';
import { ChatMode } from '@repo/shared/config';
import { buildStandardSystemPrompt } from '../../prompts/standard-system';
import { runGrokCompletion } from '../../run-grok-completion';
import { ActivityController } from '../activity';
import { WorkflowContextSchema, WorkflowEventSchema } from '../flow';
import { ChunkBuffer, handleError } from '../utils';

const DEEP_COMPLETION_TASK_TIMEOUT_MS = 660_000;

export const deepCompletionTask = createTask<WorkflowEventSchema, WorkflowContextSchema>({
    name: 'deep-completion',
    timeoutMs: DEEP_COMPLETION_TASK_TIMEOUT_MS,
    execute: async ({ events, context, signal }) => {
        if (!context) throw new Error('Context required');

        const mode = context.get('mode') ?? ChatMode.Standard;
        const messages =
            context
                .get('messages')
                ?.filter(m => (m.role === 'user' || m.role === 'assistant') && !!m.content) || [];

        const activity = new ActivityController(events!, {
            initialArtifact: context.get('threadArtifact') ?? null,
            userImageAttachment: context.get('userImageAttachment') ?? null,
            abortSignal: signal,
        });
        activity.begin();

        const chunkBuffer = new ChunkBuffer({
            threshold: 200,
            breakOn: ['\n'],
            onFlush: (_chunk, fullText) => {
                events?.update('answer', () => ({
                    text: fullText,
                    status: 'PENDING' as const,
                }));
            },
        });

        const customInstructions = context.get('customInstructions');
        const threadArtifact = context.get('threadArtifact') ?? null;
        const system = `${buildStandardSystemPrompt(customInstructions, threadArtifact)}\n\nYou are conducting deep multi-agent research.`;

        let fullText = '';
        let sources: Awaited<ReturnType<typeof runGrokCompletion>>['sources'] = [];

        try {
            const result = await runGrokCompletion({
                mode,
                messages,
                system,
                signal,
                activity,
                onDelta: delta => chunkBuffer.add(delta),
            });
            fullText = result.text;
            sources = result.sources;
            chunkBuffer.end();

            activity.finalizeArtifactFallback(fullText, context.get('question') ?? '');
            activity.complete();

            if (sources.length > 0) {
                events?.update('sources', () => sources);
            }

            events?.update('answer', () => ({
                text: fullText,
                finalText: fullText,
                status: 'COMPLETED',
            }));
            context.update('answer', () => fullText);
            events?.update('status', () => 'COMPLETED');

            const onFinish = context.get('onFinish');
            onFinish?.({
                answer: fullText,
                threadId: context.get('threadId'),
                threadItemId: context.get('threadItemId'),
            });
        } finally {
            await activity.drainImagineTasks();
        }
    },
    onError: handleError,
});
