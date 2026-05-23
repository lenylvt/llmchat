import { createTask } from '@repo/orchestrator';
import { runGrokCompletion } from '../../run-grok-completion';
import { WorkflowContextSchema, WorkflowEventSchema } from '../flow';
import { ChunkBuffer, getHumanizedDate, handleError } from '../utils';

export const deepCompletionTask = createTask<WorkflowEventSchema, WorkflowContextSchema>({
    name: 'deep-completion',
    execute: async ({ events, context, signal }) => {
        if (!context) throw new Error('Context required');

        const mode = context.get('mode');
        const messages =
            context
                .get('messages')
                ?.filter(m => (m.role === 'user' || m.role === 'assistant') && !!m.content) || [];

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

        const system = `You are Grok conducting deep multi-agent research. Today is ${getHumanizedDate()}.`;

        const { text: fullText, sources } = await runGrokCompletion({
            mode,
            messages,
            system,
            signal,
            onDelta: delta => chunkBuffer.add(delta),
        });
        chunkBuffer.end();

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
    },
    onError: handleError,
});
