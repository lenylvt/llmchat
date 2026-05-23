import type { TypedEventEmitter } from '@repo/orchestrator';
import type {
    ImagineMediaItem,
    Source,
    ThreadArtifact,
    ToolCall,
    ToolResult,
} from '@repo/shared/types';
import {
    applyArtifactToolAction,
    artifactsEqual,
    isArtifactToolName,
    isImageCreatorToolName,
    isImagineClientToolName,
    isIncompleteArtifactToolArgs,
    isIncompleteImagineToolArgs,
    isVideoCreatorToolName,
    mergeQueryStrings,
    mergeSourceRows,
    parseToolCallArguments,
    sourcesFromXaiRecord,
    tryArtifactFallbackFromAnswer,
} from '@repo/shared/utils';
import { executeImageCreator, executeVideoCreator } from '../xai-imagine';
import { stableToolCallIdFromChunk } from './activity-stream';
import {
    type XaiSearchToolCategory,
    resolveServerToolName,
    searchCategoryFromFunctionName,
    searchCategoryFromOutputType,
} from '../xai-server-tools';
import type { WorkflowEventSchema } from './flow';

const ACTIVITY_STEP_KEY = '0';

function argsFromXaiItem(item: Record<string, unknown>): Record<string, unknown> {
    const fn = item.function;
    const fnArgs =
        fn && typeof fn === 'object' && !Array.isArray(fn)
            ? (fn as Record<string, unknown>).arguments
            : undefined;

    const parsed = parseToolCallArguments(item.arguments ?? fnArgs ?? item.input);
    if (Object.keys(parsed.args).length > 0 || parsed.incomplete) {
        return parsed.args;
    }

    const action = item.action;
    if (action && typeof action === 'object' && !Array.isArray(action)) {
        return { action };
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

type PendingFunctionCall = {
    name: string;
    argsJson: string;
    /** Set when arguments.done arrives before output_item provides the tool name. */
    pendingDoneArgs?: string;
};

export class ActivityController {
    private readonly events: TypedEventEmitter<WorkflowEventSchema>;
    private hasActivity = false;
    private readonly completedToolIds = new Set<string>();
    private readonly pendingFunctionCalls = new Map<string, PendingFunctionCall>();
    private artifactState: ThreadArtifact | null;
    private artifactToolAppliedThisTurn = false;
    private imagineMedia: ImagineMediaItem[] = [];
    private readonly userImageAttachment?: string | null;
    private readonly abortSignal?: AbortSignal;
    private readonly imagineTasks = new Set<Promise<void>>();
    private imagineInFlight = 0;

    constructor(
        events: TypedEventEmitter<WorkflowEventSchema>,
        options?: {
            initialArtifact?: ThreadArtifact | null;
            userImageAttachment?: string | null;
            abortSignal?: AbortSignal;
        }
    ) {
        this.events = events;
        this.artifactState = options?.initialArtifact ?? null;
        this.userImageAttachment = options?.userImageAttachment ?? null;
        this.abortSignal = options?.abortSignal;
    }

    begin() {
        this.imagineMedia = [];
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

    registerFunctionCallItem(item: Record<string, unknown>) {
        const key = stableToolCallIdFromChunk(item);
        if (!key) return;

        const toolName =
            (typeof item.name === 'string' && item.name.trim()) ||
            resolveServerToolName(item, 'function_call');
        const existing = this.pendingFunctionCalls.get(key);
        const argsJson =
            typeof item.arguments === 'string'
                ? item.arguments
                : (existing?.argsJson ?? '');
        const pendingDoneArgs = existing?.pendingDoneArgs;
        this.pendingFunctionCalls.set(key, { name: toolName, argsJson, pendingDoneArgs });

        if (pendingDoneArgs?.trim()) {
            this.completeFunctionCallArguments(key, pendingDoneArgs);
        }
    }

    appendFunctionCallArguments(itemId: string, delta: string) {
        if (!itemId || !delta) return;
        const existing = this.pendingFunctionCalls.get(itemId);
        this.pendingFunctionCalls.set(itemId, {
            name: existing?.name ?? '',
            argsJson: `${existing?.argsJson ?? ''}${delta}`,
            pendingDoneArgs: existing?.pendingDoneArgs,
        });
    }

    completeFunctionCallArguments(itemId: string, argumentsJson: string) {
        if (!itemId || !argumentsJson.trim()) return;

        const pending = this.pendingFunctionCalls.get(itemId);
        const toolName = pending?.name?.trim();
        if (!toolName) {
            this.pendingFunctionCalls.set(itemId, {
                name: pending?.name ?? '',
                argsJson: pending?.argsJson ?? '',
                pendingDoneArgs: argumentsJson,
            });
            return;
        }

        const { args } = parseToolCallArguments(argumentsJson);
        this.finishClientToolCall(itemId, toolName, args, {
            type: 'function_call',
            id: itemId,
            name: toolName,
            arguments: argumentsJson,
            status: 'completed',
        });
    }

    recordClientToolItem(
        item: Record<string, unknown>,
        options?: { forceComplete?: boolean }
    ) {
        const key = stableToolCallIdFromChunk(item);
        if (!key) return;

        const toolName =
            (typeof item.name === 'string' && item.name.trim()) ||
            resolveServerToolName(item, 'function_call');

        this.registerFunctionCallItem(item);

        const args = argsFromXaiItem(item);
        const status = String(item.status ?? '');
        const isComplete =
            options?.forceComplete ||
            status === 'completed' ||
            status === 'done' ||
            status === 'failed';

        if (isComplete) {
            this.finishClientToolCall(key, toolName, args, item);
        } else {
            this.onToolPending(key, toolName, args);
        }
    }

    private finishClientToolCall(
        key: string,
        toolName: string,
        args: Record<string, unknown>,
        item: Record<string, unknown>
    ) {
        this.onToolFinished(key, toolName, args, item, sourcesFromXaiRecord(item));
    }

    /** If Grok wrote the document in chat, sync it to the side panel. */
    finalizeArtifactFallback(answer: string, userQuery: string) {
        const next = tryArtifactFallbackFromAnswer(
            this.artifactState,
            answer,
            userQuery,
            this.artifactToolAppliedThisTurn
        );
        if (!next) return;
        if (artifactsEqual(this.artifactState, next)) return;

        this.artifactState = next;
        this.hasActivity = true;
        this.emitObjectState();
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

    /** Wait for in-flight Imagine API jobs (video poll can take several minutes). */
    async drainImagineTasks(): Promise<void> {
        if (this.imagineTasks.size === 0) return;
        await Promise.all(Array.from(this.imagineTasks));
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

        const record =
            args && typeof args === 'object' ? (args as Record<string, unknown>) : {};

        if (isArtifactToolName(toolName)) {
            if (!isIncompleteArtifactToolArgs(record)) {
                this.artifactState = applyArtifactToolAction(this.artifactState, record);
                this.artifactToolAppliedThisTurn = true;
                this.emitObjectState();
            }
            this.upsertToolResult(key, toolName, args, { artifact: this.artifactState });
        } else if (isImagineClientToolName(toolName)) {
            if (isIncompleteImagineToolArgs(toolName, record)) {
                this.upsertToolResult(key, toolName, args, {
                    error: 'Incomplete tool arguments',
                });
            } else {
                const task = this.executeImagineClientTool(key, toolName, record);
                this.imagineTasks.add(task);
                void task.finally(() => this.imagineTasks.delete(task));
                return;
            }
        } else {
            this.upsertToolResult(key, toolName, args, result);
        }

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

    private emitObjectState(options?: { artifactOnly?: boolean; imagineOnly?: boolean }) {
        this.events.update('object', prev => {
            const base = prev && typeof prev === 'object' ? prev : {};
            const next: Record<string, unknown> = { ...base };

            if (!options?.imagineOnly) {
                next.artifact = this.artifactState;
            }
            if (!options?.artifactOnly) {
                next.imagineMedia = { items: this.imagineMedia };
            }

            return next;
        });
    }

    private patchImagineStep(status: 'PENDING' | 'COMPLETED', label: string) {
        this.patchStep({
            status: status === 'PENDING' ? 'PENDING' : undefined,
            subSteps: {
                imagine: {
                    status,
                    data: [label],
                },
            },
        });
    }

    private async executeImagineClientTool(
        key: string,
        toolName: string,
        record: Record<string, unknown>
    ) {
        const label = isImageCreatorToolName(toolName) ? 'Creating image' : 'Creating video';
        this.imagineInFlight += 1;
        this.patchImagineStep('PENDING', label);

        try {
            const ctx = {
                userImageAttachment: this.userImageAttachment,
                signal: this.abortSignal,
            };
            const outcome = isImageCreatorToolName(toolName)
                ? await executeImageCreator(record, ctx)
                : await executeVideoCreator(record, ctx);

            if (outcome.items.length > 0) {
                this.imagineMedia = [...this.imagineMedia, ...outcome.items];
                this.emitObjectState({ imagineOnly: true });
            }

            this.upsertToolResult(key, toolName, record, outcome);
        } catch (error) {
            const message =
                error instanceof Error ? error.message : 'Imagine request failed';
            this.upsertToolResult(key, toolName, record, { error: message, items: [] });
        } finally {
            this.imagineInFlight -= 1;
            if (this.imagineInFlight === 0) {
                this.patchImagineStep('COMPLETED', label);
                this.patchStep({ status: 'COMPLETED' });
            }
        }
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
