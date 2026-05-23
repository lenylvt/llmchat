import { parseToolCallArguments } from '@repo/shared/utils';
import { isClientToolOutputType, isServerToolOutputType } from '../xai-server-tools';
import type { ActivityController } from './activity';

function asRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

/** Stable xAI tool id from chunk rows — skip when missing (no synthetic ids). */
export function stableToolCallIdFromChunk(row: Record<string, unknown>): string | null {
    const id = typeof row.id === 'string' ? row.id.trim() : '';
    if (id) return id;
    const callId = typeof row.call_id === 'string' ? row.call_id.trim() : '';
    if (callId) return callId;
    return null;
}

function ingestChunkToolCalls(event: Record<string, unknown>, activity: ActivityController): void {
    const chunk = asRecord(event.chunk);
    const toolCalls = Array.isArray(event.tool_calls)
        ? event.tool_calls
        : chunk && Array.isArray(chunk.tool_calls)
          ? chunk.tool_calls
          : null;

    if (!toolCalls) return;

    for (const row of toolCalls) {
        const tc = asRecord(row);
        if (!tc) continue;

        const toolCallId = stableToolCallIdFromChunk(tc);
        if (!toolCallId) continue;

        const fn = asRecord(tc.function);
        const toolName =
            (typeof tc.name === 'string' && tc.name.trim()) ||
            (fn && typeof fn.name === 'string' && fn.name.trim()) ||
            '';
        if (!toolName) continue;

        const { args } = parseToolCallArguments(tc.arguments ?? fn?.arguments ?? tc.input ?? tc.args);
        activity.recordStreamingToolCall(toolCallId, toolName, args);
    }
}

function ingestServerToolItem(
    item: Record<string, unknown>,
    activity: ActivityController,
    eventType: string
): void {
    const itemType = String(item.type ?? '');
    if (!itemType) return;

    if (isClientToolOutputType(itemType)) {
        const forceComplete = eventType === 'response.output_item.done';
        if (eventType === 'response.output_item.added') {
            activity.registerFunctionCallItem(item);
        }
        activity.recordClientToolItem(item, { forceComplete });
        return;
    }

    if (!isServerToolOutputType(itemType)) return;

    const status = String(item.status ?? '');
    const isTerminal = status === 'completed' || status === 'done' || status === 'failed';

    if (isTerminal) {
        activity.recordServerToolDone(itemType, item);
    } else {
        activity.recordServerToolStarted(itemType, item);
    }
}

/**
 * Ingest xAI Responses SSE — `output_item.*`, `function_call_arguments.*`, and optional `tool_calls`
 * chunks when they carry a stable `id` / `call_id`.
 * @see https://docs.x.ai/developers/tools/streaming
 */
export function ingestXaiActivityEvent(
    event: Record<string, unknown>,
    activity: ActivityController
): void {
    const type = String(event.type ?? '');

    if (type === 'response.function_call_arguments.delta') {
        const itemId = String(event.item_id ?? '');
        const delta = String(event.delta ?? '');
        if (itemId && delta) {
            activity.appendFunctionCallArguments(itemId, delta);
        }
        return;
    }

    if (type === 'response.function_call_arguments.done') {
        const itemId = String(event.item_id ?? '');
        const args = String(event.arguments ?? '');
        if (itemId && args) {
            activity.completeFunctionCallArguments(itemId, args);
        }
        return;
    }

    if (
        type === 'response.output_item.added' ||
        type === 'response.output_item.done' ||
        type === 'response.output_item.in_progress'
    ) {
        const item = asRecord(event.item);
        if (item) ingestServerToolItem(item, activity, type);
        return;
    }

    if (type === 'response.completed' || type === 'response.done') {
        const response = asRecord(event.response);
        const output = response?.output;
        if (!Array.isArray(output)) return;

        for (const entry of output) {
            const item = asRecord(entry);
            if (!item) continue;
            const itemType = String(item.type ?? '');
            if (isClientToolOutputType(itemType)) {
                activity.recordClientToolItem(item, { forceComplete: true });
            } else {
                ingestServerToolItem(item, activity, 'response.output_item.done');
            }
        }
        return;
    }

    ingestChunkToolCalls(event, activity);
}
