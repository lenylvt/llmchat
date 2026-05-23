import { createTask } from '@repo/orchestrator';
import { runGrokCompletion } from '../../run-grok-completion';
import { WorkflowContextSchema, WorkflowEventSchema } from '../flow';
import { ChunkBuffer, getHumanizedDate, handleError } from '../utils';

const MAX_ALLOWED_CUSTOM_INSTRUCTIONS_LENGTH = 6000;

export const completionTask = createTask<WorkflowEventSchema, WorkflowContextSchema>({
    name: 'completion',
    execute: async ({ events, context, signal }) => {
        if (!context) throw new Error('Context required');

        const customInstructions = context.get('customInstructions');
        const mode = context.get('mode');

        const messages =
            context
                .get('messages')
                ?.filter(m => (m.role === 'user' || m.role === 'assistant') && !!m.content) || [];

        const dateLine = `Today is ${getHumanizedDate()}.`;
        const system =
            customInstructions &&
            customInstructions.length < MAX_ALLOWED_CUSTOM_INSTRUCTIONS_LENGTH
                ? `${dateLine} ${customInstructions}\n\nYou are a helpful Grok assistant.`
                : `${dateLine} You are a helpful Grok assistant.`;

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

        const fullText = await runGrokCompletion({
            mode,
            messages,
            system,
            signal,
            onDelta: delta => chunkBuffer.add(delta),
        });
        chunkBuffer.end();

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
