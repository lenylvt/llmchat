import { TaskParams, TypedEventEmitter } from '@repo/orchestrator';
import { mergeQueryStrings, mergeSourceRows } from '@repo/shared/utils';
import { format } from 'date-fns';
import { WorkflowEventSchema } from './flow';
import { generateErrorMessage } from './tasks/utils';

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
                            if (Array.isArray(value?.data) && Array.isArray(prevData)) {
                                if (key === 'search') {
                                    mergedData = mergeQueryStrings(prevData, value.data);
                                } else if (key === 'read') {
                                    mergedData = mergeSourceRows(prevData, value.data);
                                } else {
                                    mergedData = [...prevData, ...value.data];
                                }
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
