import { describe, expect, test } from 'bun:test';
import { createTypedEventEmitter } from '@repo/orchestrator';
import { ActivityController } from './activity';
import type { WorkflowEventSchema } from './flow';

function createActivity() {
    const events = createTypedEventEmitter<WorkflowEventSchema>({
        steps: {},
        toolCalls: {},
        toolResults: {},
        answer: { text: '', status: 'PENDING' },
        sources: [],
        suggestions: [],
        object: {},
        error: { error: '', status: 'PENDING' },
        status: 'PENDING',
    });
    const activity = new ActivityController(events);
    activity.begin();
    return { events, activity };
}

describe('ActivityController client tools', () => {
    test('artifact tool updates thread document state', () => {
        const { events, activity } = createActivity();

        activity.registerFunctionCallItem({
            id: 'call-artifact-1',
            name: 'artifact',
            arguments: '',
        });
        activity.completeFunctionCallArguments(
            'call-artifact-1',
            JSON.stringify({
                action: 'create',
                title: 'Letter',
                content: 'Hello world',
            })
        );

        const objectState = events.getState('object') as Record<string, unknown>;
        const artifact = objectState?.artifact as { title?: string; content?: string };
        expect(artifact?.title).toBe('Letter');
        expect(artifact?.content).toBe('Hello world');

        const toolResults = events.getState('toolResults') as Record<string, { result?: unknown }>;
        expect(toolResults['call-artifact-1']?.result).toBeTruthy();
    });

    test('arguments.done before name registers completes when name arrives', () => {
        const { events, activity } = createActivity();

        activity.completeFunctionCallArguments(
            'call-order-1',
            JSON.stringify({ action: 'create', title: 'Late', content: 'x' })
        );
        activity.registerFunctionCallItem({
            id: 'call-order-1',
            name: 'artifact',
            arguments: '',
        });

        const objectState = events.getState('object') as Record<string, unknown>;
        const artifact = objectState?.artifact as { title?: string };
        expect(artifact?.title).toBe('Late');
    });
});
