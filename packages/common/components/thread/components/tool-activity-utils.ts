import { ChatMode, ChatModeConfig } from '@repo/shared/config';
import type { Source, Step, ToolCall, ToolResult } from '@repo/shared/types';
import {
    displayNameForServerTool,
    getHost,
    sourceFromUnknownRow as normalizeSourceRow,
    sourcesFromXaiRecord,
} from '@repo/shared/utils';

export function isMultiAgentMode(mode: ChatMode): boolean {
    return mode === ChatMode.Deep4 || mode === ChatMode.Deep16;
}

export type ActivityTimelineEvent = {
    id: string;
    status: 'pending' | 'done';
    title: string;
    detail?: string;
    sources?: Source[];
};

export function researchActivityLabel(mode: ChatMode): string {
    if (mode === ChatMode.Deep4) {
        return 'Pro research (4 agents)';
    }
    if (mode === ChatMode.Deep16) {
        const n = ChatModeConfig[ChatMode.Deep16].multiAgentCount ?? 16;
        return `Deep research (${n} agents)`;
    }
    return 'Research';
}

export function toolPairsFromThreadItem(threadItem: {
    toolCalls?: Record<string, ToolCall>;
    toolResults?: Record<string, ToolResult>;
}): { id: string; toolCall: ToolCall; toolResult?: ToolResult }[] {
    const calls = threadItem.toolCalls ?? {};
    return Object.entries(calls)
        .map(([id, toolCall]) => ({
            id,
            toolCall,
            toolResult: threadItem.toolResults?.[id],
        }))
        .sort((a, b) => a.id.localeCompare(b.id));
}

export function searchQueriesFromSteps(steps: Step[]): string[] {
    const primary = steps[0];
    const data = primary?.steps?.search?.data;
    if (!Array.isArray(data)) return [];
    return data.filter((q): q is string => typeof q === 'string' && q.trim().length > 0);
}

function truncateLine(text: string, max = 100): string {
    const line = text.trim().split('\n')[0] ?? text.trim();
    return line.length > max ? `${line.slice(0, max - 1)}…` : line;
}

function isCodeToolName(toolName: string): boolean {
    const n = toolName.toLowerCase();
    return n === 'code_execution' || n === 'code_interpreter' || n.includes('code');
}

export function detailFromToolArgs(toolName: string, args: unknown): string | undefined {
    if (!args || typeof args !== 'object') return undefined;
    const record = args as Record<string, unknown>;

    if (record.action && typeof record.action === 'object') {
        const action = record.action as Record<string, unknown>;
        const query = action.query;
        if (typeof query === 'string' && query.trim()) return query.trim();
        const url = action.url;
        if (typeof url === 'string' && url.trim()) return url.trim();
        const command = action.command;
        if (typeof command === 'string' && command.trim()) return command.trim();
        const code = action.code;
        if (typeof code === 'string' && code.trim()) return truncateLine(code);
    }

    if (typeof record.prompt === 'string' && record.prompt.trim()) {
        return truncateLine(record.prompt);
    }
    if (typeof record.query === 'string' && record.query.trim()) return record.query.trim();
    if (typeof record.url === 'string' && record.url.trim()) return record.url.trim();

    if (typeof record.code === 'string' && record.code.trim()) {
        return truncateLine(record.code);
    }

    if (typeof record.input === 'string' && record.input.trim()) {
        return truncateLine(record.input);
    }

    if (isCodeToolName(toolName)) {
        return 'Running Python…';
    }

    const keys = Object.keys(record);
    if (keys.length > 0) {
        return `${displayNameForServerTool(toolName)} (${keys.length} ${keys.length === 1 ? 'param' : 'params'})`;
    }

    return undefined;
}

/** Short summary from a completed code_interpreter_call payload. */
export function detailFromToolResult(toolName: string, result: unknown): string | undefined {
    if (!result || typeof result !== 'object') return undefined;
    const record = result as Record<string, unknown>;

    const outputs = record.outputs;
    if (Array.isArray(outputs)) {
        for (const entry of outputs) {
            if (!entry || typeof entry !== 'object') continue;
            const row = entry as Record<string, unknown>;
            if (typeof row.logs === 'string' && row.logs.trim()) {
                return truncateLine(row.logs.split('\n').pop() ?? row.logs, 120);
            }
            if (typeof row.text === 'string' && row.text.trim()) {
                return truncateLine(row.text, 120);
            }
            if (typeof row.output === 'string' && row.output.trim()) {
                return truncateLine(row.output, 120);
            }
        }
    }

    if (isCodeToolName(toolName)) {
        const status = String(record.status ?? '');
        if (status === 'completed' || status === 'done') return 'Finished';
    }

    const items = record.items;
    if (Array.isArray(items) && items.length > 0) {
        const first = items[0];
        if (first && typeof first === 'object' && 'url' in first) {
            return 'Media ready';
        }
    }

    if (typeof record.error === 'string' && record.error.trim()) {
        return truncateLine(record.error, 120);
    }

    return undefined;
}

export function timelineTitleForTool(toolName: string): string {
    return displayNameForServerTool(toolName);
}

function sourcesFromToolResult(result: unknown): Source[] {
    if (!result || typeof result !== 'object') return [];
    return sourcesFromXaiRecord(result as Record<string, unknown>);
}

export function latestSearchHint(threadItem: {
    toolCalls?: Record<string, ToolCall>;
    toolResults?: Record<string, ToolResult>;
}, steps: Step[]): string | undefined {
    const pairs = toolPairsFromThreadItem(threadItem);
    const pending = [...pairs].reverse().find(p => !p.toolResult);
    const current = pending ?? pairs.at(-1);

    if (current) {
        const detail = detailFromToolArgs(current.toolCall.toolName, current.toolCall.args);
        if (detail) return detail;
        return timelineTitleForTool(current.toolCall.toolName);
    }

    const fromSteps = searchQueriesFromSteps(steps);
    return fromSteps.at(-1);
}

export function buildActivityTimeline(
    threadItem: {
        toolCalls?: Record<string, ToolCall>;
        toolResults?: Record<string, ToolResult>;
    },
    steps: Step[],
    sources: Source[]
): ActivityTimelineEvent[] {
    const events: ActivityTimelineEvent[] = [];
    const pairs = toolPairsFromThreadItem(threadItem);

    const linkedSourceUrls = new Set<string>();

    if (pairs.length > 0) {
        for (const { id, toolCall, toolResult } of pairs) {
            const detail =
                detailFromToolArgs(toolCall.toolName, toolCall.args) ??
                (toolResult
                    ? detailFromToolResult(toolCall.toolName, toolResult.result)
                    : undefined);
            const stepSources = toolResult ? sourcesFromToolResult(toolResult.result) : [];
            stepSources.forEach(s => linkedSourceUrls.add(s.link));

            events.push({
                id,
                status: toolResult ? 'done' : 'pending',
                title: timelineTitleForTool(toolCall.toolName),
                ...(detail ? { detail } : {}),
                ...(stepSources.length > 0 ? { sources: stepSources } : {}),
            });
        }
    } else {
        const queries = searchQueriesFromSteps(steps);
        const stepPending = steps[0]?.status === 'PENDING';
        queries.forEach((query, index) => {
            events.push({
                id: `search-${index}-${query}`,
                status: stepPending && index === queries.length - 1 ? 'pending' : 'done',
                title: 'Search',
                detail: query,
            });
        });
    }

    const remainingSources = sources.filter(s => !linkedSourceUrls.has(s.link));
    if (remainingSources.length > 0) {
        const readPending = steps[0]?.steps?.read?.status === 'PENDING';
        events.push({
            id: 'sources',
            status: readPending ? 'pending' : 'done',
            title: remainingSources.length === 1 ? '1 result' : `${remainingSources.length} results`,
            sources: remainingSources,
        });
    }

    return events;
}

export function sourceDisplayLabel(source: Source): string {
    if (source.title && source.title !== source.link) {
        const host = getHost(source.link);
        if (host && source.title.length <= 56) return source.title;
    }
    return getHost(source.link) ?? source.link;
}
