import {
    createContext,
    createTypedEventEmitter,
    WorkflowBuilder,
    WorkflowConfig,
} from '@repo/orchestrator';
import { ChatMode } from '@repo/shared/config';
import type { ThreadArtifact, ToolCall, ToolResult } from '@repo/shared/types';
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
    toolCalls?: Record<string, ToolCall>;
    toolResults?: Record<string, ToolResult>;
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
    threadArtifact?: ThreadArtifact | null;
    userImageAttachment?: string | null;
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
    threadArtifact,
    userImageAttachment,
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
    threadArtifact?: ThreadArtifact | null;
    userImageAttachment?: string | null;
}) => {
    const workflowConfig: WorkflowConfig = {
        maxIterations: 2,
        /** Grok stream + Imagine video poll (up to 10 min) + margin */
        timeoutMs: 660_000,
        ...config,
    };

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
        threadArtifact: threadArtifact ?? null,
        userImageAttachment: userImageAttachment ?? null,
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
