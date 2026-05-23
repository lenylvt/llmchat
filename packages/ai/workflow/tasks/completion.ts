import { createTask } from '@repo/orchestrator';
import { ChatMode } from '@repo/shared/config';
import { buildStandardSystemPrompt } from '../../prompts/standard-system';
import { runGrokCompletion } from '../../run-grok-completion';
import { ActivityController } from '../activity';
import { WorkflowContextSchema, WorkflowEventSchema } from '../flow';
import { ChunkBuffer, handleError } from '../utils';

const COMPLETION_TASK_TIMEOUT_MS = 660_000;

export const completionTask = createTask<WorkflowEventSchema, WorkflowContextSchema>({
    name: 'completion',
    timeoutMs: COMPLETION_TASK_TIMEOUT_MS,
    execute: async ({ events, context, signal }) => {
        if (!context) throw new Error('Context required');

        const customInstructions = context.get('customInstructions');
        const mode = context.get('mode') ?? ChatMode.Standard;

        const messages =
            context
                .get('messages')
                ?.filter(m => (m.role === 'user' || m.role === 'assistant') && !!m.content) || [];

        const threadArtifact = context.get('threadArtifact') ?? null;
        const system = buildStandardSystemPrompt(customInstructions, threadArtifact);
        const activity = new ActivityController(events!, {
            initialArtifact: threadArtifact,
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
