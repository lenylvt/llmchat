import { TaskParams, TypedEventEmitter } from '@repo/orchestrator';
import { format } from 'date-fns';
import type { StreamTextResult, ToolSet } from 'ai';
import { WorkflowEventSchema } from './flow';
import { generateErrorMessage } from './tasks/utils';

/** Consume streamText output; handles text-delta parts from the AI SDK v5 stream. */
export async function consumeStreamText<TOOLS extends ToolSet = ToolSet>(
    result: StreamTextResult<TOOLS, never>,
    onDelta: (delta: string, fullText: string) => void,
): Promise<string> {
    let fullText = '';
    for await (const part of result.fullStream) {
        const delta =
            part.type === 'text-delta'
                ? 'textDelta' in part && typeof part.textDelta === 'string'
                    ? part.textDelta
                    : 'text' in part && typeof part.text === 'string'
                      ? part.text
                      : 'delta' in part && typeof part.delta === 'string'
                        ? part.delta
                        : ''
                : part.type === 'text' && 'text' in part && typeof part.text === 'string'
                  ? part.text
                  : '';
        if (!delta) continue;
        fullText += delta;
        onDelta(delta, fullText);
    }

    if (!fullText.trim()) {
        try {
            fullText = await result.text;
        } catch {
            // fall through with accumulated stream text
        }
    }

    return fullText;
}

export type ChunkBufferOptions = {
    threshold?: number;
    breakOn?: string[];
    onFlush: (chunk: string, fullText: string) => void;
};

export class ChunkBuffer {
    private buffer = '';
    private fullText = '';
    private threshold?: number;
    private breakPatterns: string[];
    private onFlush: (chunk: string, fullText: string) => void;

    constructor(options: ChunkBufferOptions) {
        this.threshold = options.threshold;
        this.breakPatterns = options.breakOn || ['\n\n', '.', '!', '?'];
        this.onFlush = options.onFlush;
    }

    add(chunk: string): void {
        this.fullText += chunk;
        this.buffer += chunk;

        const shouldFlush =
            (this.threshold && this.buffer.length >= this.threshold) ||
            this.breakPatterns.some(pattern => chunk.includes(pattern) || chunk.endsWith(pattern));

        if (shouldFlush) {
            this.flush();
        }
    }

    flush(): void {
        if (this.buffer.length > 0) {
            this.onFlush(this.buffer, this.fullText);
            this.buffer = '';
        }
    }

    end(): void {
        this.flush();
        this.fullText = '';
    }
}

export const getHumanizedDate = () => format(new Date(), 'MMMM dd, yyyy, h:mm a');

export const handleError = (error: Error, { context, events }: TaskParams) => {
    const errorMessage = generateErrorMessage(error);
    console.error('Task failed', error);

    events?.update('error', prev => ({
        ...prev,
        error: errorMessage,
        status: 'ERROR',
    }));

    return Promise.resolve({
        retry: false,
        result: 'error',
    });
};

export const sendEvents = (events?: TypedEventEmitter<WorkflowEventSchema>) => {
    const nextStepId = () => Object.keys(events?.getState('steps') || {}).length;

    const updateStep = (params: {
        stepId: number;
        text?: string;
        stepStatus: 'PENDING' | 'COMPLETED';
        subSteps: Record<string, { status: 'PENDING' | 'COMPLETED'; data?: unknown }>;
    }) => {
        const { stepId, text, stepStatus, subSteps } = params;
        events?.update('steps', prev => ({
            ...prev,
            [stepId]: {
                ...prev?.[stepId],
                id: stepId,
                text: text || prev?.[stepId]?.text,
                status: stepStatus,
                steps: {
                    ...prev?.[stepId]?.steps,
                    ...Object.entries(subSteps).reduce(
                        (acc, [key, value]) => {
                            const prevData = prev?.[stepId]?.steps?.[key]?.data;
                            let mergedData: unknown = value?.data;
                            if (Array.isArray(value?.data)) {
                                mergedData = [
                                    ...(Array.isArray(prevData) ? prevData : []),
                                    ...value.data,
                                ];
                            } else if (
                                typeof value?.data === 'object' &&
                                value?.data !== null &&
                                !Array.isArray(value?.data)
                            ) {
                                mergedData = {
                                    ...(typeof prevData === 'object' &&
                                    prevData !== null &&
                                    !Array.isArray(prevData)
                                        ? prevData
                                        : {}),
                                    ...value.data,
                                };
                            } else if (value?.data === undefined) {
                                mergedData = prevData;
                            }
                            return {
                                ...acc,
                                [key]: {
                                    ...prev?.[stepId]?.steps?.[key],
                                    ...value,
                                    data: mergedData,
                                },
                            };
                        },
                        {} as Record<string, { status: 'PENDING' | 'COMPLETED'; data?: unknown }>
                    ),
                },
            },
        }));
    };

    const updateAnswer = ({
        text,
        finalText,
        status,
    }: {
        text?: string;
        finalText?: string;
        status?: 'PENDING' | 'COMPLETED';
    }) => {
        events?.update('answer', prev => ({
            ...prev,
            text: text || prev?.text,
            finalText: finalText || prev?.finalText,
            status: status || prev?.status,
        }));
    };

    const updateStatus = (status: 'PENDING' | 'COMPLETED' | 'ERROR') => {
        events?.update('status', () => status);
    };

    return { updateStep, updateAnswer, nextStepId, updateStatus };
};
