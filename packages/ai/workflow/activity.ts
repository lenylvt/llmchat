import type { TypedEventEmitter } from '@repo/orchestrator';
import type { Source, ToolCall, ToolResult } from '@repo/shared/types';
import { mergeQueryStrings, mergeSourceRows, sourcesFromXaiRecord } from '@repo/shared/utils';
import {
    type XaiSearchToolCategory,
    resolveServerToolName,
    searchCategoryFromFunctionName,
    searchCategoryFromOutputType,
} from '../xai-server-tools';
import type { WorkflowEventSchema } from './flow';

const ACTIVITY_STEP_KEY = '0';

function argsFromXaiItem(item: Record<string, unknown>): Record<string, unknown> {
    const action = item.action;
    if (action && typeof action === 'object') {
        return { action };
    }
    if (typeof item.arguments === 'string' && item.arguments.trim()) {
        try {
            const parsed = JSON.parse(item.arguments) as unknown;
            if (parsed && typeof parsed === 'object') {
                return parsed as Record<string, unknown>;
            }
        } catch {
            return { raw: item.arguments };
        }
    }
    if (item.arguments && typeof item.arguments === 'object') {
        return item.arguments as Record<string, unknown>;
    }
    return {};
}

function searchQueryFromArgs(args: unknown): string | undefined {
    if (!args || typeof args !== 'object') return undefined;
    const record = args as Record<string, unknown>;
    if (record.action && typeof record.action === 'object') {
        const action = record.action as Record<string, unknown>;
        const query = action.query;
        if (typeof query === 'string' && query.trim()) return query.trim();
        const url = action.url;
        if (typeof url === 'string' && url.trim()) return url.trim();
    }
    const query = record.query;
    if (typeof query === 'string' && query.trim()) return query.trim();
    const url = record.url;
    if (typeof url === 'string' && url.trim()) return url.trim();
    return undefined;
}

export class ActivityController {
    private readonly events: TypedEventEmitter<WorkflowEventSchema>;
    private hasActivity = false;
    private readonly completedToolIds = new Set<string>();

    constructor(events: TypedEventEmitter<WorkflowEventSchema>) {
        this.events = events;
    }

    begin() {
        this.events.update('status', () => 'PENDING');
    }

    get recordedActivity(): boolean {
        return this.hasActivity;
    }

    recordStreamingToolCall(toolCallId: string, toolName: string, args: Record<string, unknown>) {
        if (!toolCallId || this.completedToolIds.has(toolCallId)) return;
        this.onToolPending(toolCallId, toolName, args);
    }

    recordToolCall(toolCall: ToolCall) {
        if (!toolCall.toolCallId) return;
        this.onToolPending(toolCall.toolCallId, toolCall.toolName, toolCall.args);
    }

    recordToolResult(toolResult: ToolResult) {
        const key = toolResult.toolCallId;
        if (!key) return;
        const sources = sourcesFromXaiRecord(
            toolResult.result && typeof toolResult.result === 'object'
                ? (toolResult.result as Record<string, unknown>)
                : {}
        );
        this.onToolFinished(
            key,
            toolResult.toolName,
            toolResult.args,
            toolResult.result,
            sources
        );
    }

    recordClientToolItem(item: Record<string, unknown>) {
        const key = typeof item.id === 'string' ? item.id : undefined;
        if (!key) return;

        const toolName =
            (typeof item.name === 'string' && item.name.trim()) ||
            resolveServerToolName(item, 'function_call');
        const args = argsFromXaiItem(item);
        const status = String(item.status ?? '');
        const isComplete = status === 'completed' || status === 'done';
        const isFailed = status === 'failed';

        if (isComplete || isFailed) {
            this.onToolFinished(key, toolName, args, item, sourcesFromXaiRecord(item));
        } else {
            this.onToolPending(key, toolName, args);
        }
    }

    recordServerToolStarted(itemType: string, item: Record<string, unknown>) {
        const key = typeof item.id === 'string' ? item.id : undefined;
        if (!key || this.completedToolIds.has(key)) return;
        const toolName = resolveServerToolName(item, itemType);
        this.onToolPending(key, toolName, argsFromXaiItem(item), itemType);
    }

    recordServerToolDone(itemType: string, item: Record<string, unknown>) {
        const key = typeof item.id === 'string' ? item.id : undefined;
        if (!key) return;

        const toolName = resolveServerToolName(item, itemType);
        const args = argsFromXaiItem(item);
        const status = String(item.status ?? '');
        const isComplete = status === 'completed' || status === 'done';
        const isFailed = status === 'failed';

        if (isComplete || isFailed) {
            this.onToolFinished(key, toolName, args, item, sourcesFromXaiRecord(item), itemType);
        } else {
            this.onToolPending(key, toolName, args, itemType);
        }
    }

    complete() {
        if (!this.hasActivity) return;
        this.patchStep({ status: 'COMPLETED' });
    }

    private onToolPending(
        key: string,
        toolName: string,
        args: unknown,
        itemType?: string
    ) {
        this.hasActivity = true;
        this.upsertToolCall(key, toolName, args);

        const searchKind =
            (itemType ? searchCategoryFromOutputType(itemType) : null) ??
            searchCategoryFromFunctionName(toolName);
        const query = searchQueryFromArgs(args);
        if (searchKind && query) {
            this.appendSearchMeta(searchKind, 'PENDING', [query]);
        } else {
            this.patchStep({ status: 'PENDING' });
        }
    }

    private onToolFinished(
        key: string,
        toolName: string,
        args: unknown,
        result: unknown,
        sources: Source[],
        itemType?: string
    ) {
        if (this.completedToolIds.has(key)) return;

        this.hasActivity = true;
        this.completedToolIds.add(key);
        this.upsertToolCall(key, toolName, args);
        this.upsertToolResult(key, toolName, args, result);

        const searchKind =
            (itemType ? searchCategoryFromOutputType(itemType) : null) ??
            searchCategoryFromFunctionName(toolName);
        const query = searchQueryFromArgs(args);
        if (searchKind) {
            this.appendSearchMeta(
                searchKind,
                'COMPLETED',
                query ? [query] : undefined,
                sources
            );
        } else {
            this.patchStep({ status: 'COMPLETED' });
        }
    }

    private upsertToolCall(key: string, toolName: string, args: unknown) {
        this.events.update('toolCalls', prev => ({
            ...(prev && typeof prev === 'object' && !Array.isArray(prev) ? prev : {}),
            [key]: {
                type: 'tool-call',
                toolCallId: key,
                toolName,
                args,
            },
        }));
    }

    private upsertToolResult(key: string, toolName: string, args: unknown, result: unknown) {
        this.events.update('toolResults', prev => ({
            ...(prev && typeof prev === 'object' && !Array.isArray(prev) ? prev : {}),
            [key]: {
                type: 'tool-result',
                toolCallId: key,
                toolName,
                args,
                result,
            },
        }));
    }

    private appendSearchMeta(
        _kind: XaiSearchToolCategory,
        status: 'PENDING' | 'COMPLETED',
        queries?: string[],
        sources?: Source[]
    ) {
        this.patchStep({
            status: status === 'PENDING' ? 'PENDING' : undefined,
            subSteps: {
                search: {
                    status,
                    ...(queries?.length ? { data: queries } : {}),
                },
                ...(status === 'COMPLETED' && sources && sources.length > 0
                    ? { read: { status: 'COMPLETED' as const, data: sources } }
                    : {}),
            },
        });
    }

    private patchStep(params: {
        status?: 'PENDING' | 'COMPLETED';
        subSteps?: Record<string, { status: 'PENDING' | 'COMPLETED'; data?: unknown }>;
    }) {
        this.events.update('steps', prev => {
            const current = prev?.[ACTIVITY_STEP_KEY];
            const mergedSubSteps = { ...current?.steps };

            if (params.subSteps) {
                for (const [key, value] of Object.entries(params.subSteps)) {
                    const prevSub = mergedSubSteps[key];
                    let mergedData: unknown = value.data;
                    if (Array.isArray(value.data) && Array.isArray(prevSub?.data)) {
                        if (key === 'search') {
                            mergedData = mergeQueryStrings(prevSub.data, value.data);
                        } else if (key === 'read') {
                            mergedData = mergeSourceRows(prevSub.data, value.data);
                        } else {
                            mergedData = [...prevSub.data, ...value.data];
                        }
                    } else if (value.data === undefined) {
                        mergedData = prevSub?.data;
                    }
                    mergedSubSteps[key] = {
                        ...prevSub,
                        status: value.status,
                        data: mergedData,
                    };
                }
            }

            return {
                ...prev,
                [ACTIVITY_STEP_KEY]: {
                    id: 0,
                    text: current?.text,
                    status: params.status ?? current?.status ?? 'PENDING',
                    steps: mergedSubSteps,
                },
            };
        });
    }
}
