import {
    createContext,
    createTypedEventEmitter,
    WorkflowBuilder,
    WorkflowConfig,
} from '@repo/orchestrator';
import { ChatMode } from '@repo/shared/config';
import { CoreMessage } from 'ai';
import { completionTask, deepCompletionTask, modeRoutingTask } from './tasks';

type Status = 'PENDING' | 'COMPLETED' | 'ERROR' | 'HUMAN_REVIEW';

export type WorkflowEventSchema = {
    steps?: Record<
        string,
        {
            id: number;
            text?: string;
            steps: Record<string, { data?: unknown; status: Status }>;
            status: Status;
        }
    >;
    toolCalls?: unknown[];
    toolResults?: unknown[];
    answer: {
        text?: string;
        object?: unknown;
        objectType?: string;
        finalText?: string;
        status: Status;
    };
    sources?: { index: number; title: string; link: string }[];
    object?: Record<string, unknown>;
    error?: { error: string; status: Status };
    status: Status;
    suggestions?: string[];
};

export type WorkflowContextSchema = {
    question: string;
    search_queries: string[];
    messages: CoreMessage[];
    mode: ChatMode;
    webSearch: boolean;
    queries: string[];
    summaries: string[];
    sources: { index: number; title: string; link: string }[];
    answer: string | undefined;
    threadId: string;
    threadItemId: string;
    showSuggestions: boolean;
    customInstructions?: string;
    onFinish: (data: unknown) => void;
};

export const runWorkflow = ({
    mode,
    question,
    threadId,
    threadItemId,
    messages,
    config = {},
    signal,
    webSearch = false,
    showSuggestions = false,
    onFinish,
    customInstructions,
}: {
    mode: ChatMode;
    question: string;
    threadId: string;
    threadItemId: string;
    messages: CoreMessage[];
    config?: WorkflowConfig;
    signal?: AbortSignal;
    webSearch?: boolean;
    showSuggestions?: boolean;
    onFinish?: (data: unknown) => void;
    customInstructions?: string;
}) => {
    const workflowConfig: WorkflowConfig = {
        maxIterations: 2,
        timeoutMs: 480000,
        ...config,
    };

    const events = createTypedEventEmitter<WorkflowEventSchema>({
        steps: {},
        toolCalls: [],
        toolResults: [],
        answer: { text: '', status: 'PENDING' },
        sources: [],
        suggestions: [],
        object: {},
        error: { error: '', status: 'PENDING' },
        status: 'PENDING',
    });

    const context = createContext<WorkflowContextSchema>({
        question,
        mode,
        webSearch,
        search_queries: [],
        messages: messages as CoreMessage[],
        queries: [],
        sources: [],
        summaries: [],
        answer: undefined,
        threadId,
        threadItemId,
        showSuggestions,
        customInstructions,
        onFinish: onFinish as (data: unknown) => void,
    });

    const builder = new WorkflowBuilder(threadId, {
        initialEventState: events.getAllState(),
        events,
        context,
        config: workflowConfig,
        signal,
    });

    builder.addTasks([modeRoutingTask, completionTask, deepCompletionTask]);

    return builder.build();
};
