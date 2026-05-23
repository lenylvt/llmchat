import type { Source } from '../types';
import { getHost } from './url';

export function sourceLinkFromUnknown(link: unknown): string | undefined {
    if (typeof link !== 'string') return undefined;
    const trimmed = link.trim();
    return trimmed.length > 0 ? trimmed : undefined;
}

/** Normalize xAI / step payloads into a `Source` (requires a string URL). */
export function sourceFromUnknownRow(item: unknown, fallbackIndex: number): Source | null {
    if (!item || typeof item !== 'object') return null;

    const row = item as Record<string, unknown>;
    const link =
        sourceLinkFromUnknown(row.link) ??
        sourceLinkFromUnknown(row.url) ??
        sourceLinkFromUnknown(row.href);

    if (!link) return null;

    const title =
        (typeof row.title === 'string' && row.title.trim()) ||
        (typeof row.name === 'string' && row.name.trim()) ||
        getHost(link) ||
        link;

    const index =
        typeof row.index === 'number' && Number.isFinite(row.index) && row.index > 0
            ? row.index
            : fallbackIndex;

    return {
        index,
        link,
        title,
        snippet: typeof row.snippet === 'string' ? row.snippet : undefined,
    };
}

export function mergeQueryStrings(prev: unknown[], next: unknown[]): string[] {
    const combined = [...prev, ...next]
        .map(value => (typeof value === 'string' ? value.trim() : String(value).trim()))
        .filter(Boolean);
    return Array.from(new Set(combined));
}

/** Sources from xAI tool `action.sources` or top-level `sources` on an output item. */
export function sourcesFromXaiRecord(record: Record<string, unknown>): Source[] {
    const action = record.action;
    const raw = Array.isArray(
        action && typeof action === 'object'
            ? (action as Record<string, unknown>).sources
            : undefined
    )
        ? (action as Record<string, unknown>).sources
        : Array.isArray(record.sources)
          ? record.sources
          : null;

    if (!raw) return [];

    const sources: Source[] = [];
    raw.forEach((row, index) => {
        const source = sourceFromUnknownRow(row, index + 1);
        if (source) sources.push(source);
    });
    return sources;
}

export function mergeSourceRows(prev: unknown[], next: unknown[]): Source[] {
    const map = new Map<string, Source>();
    let index = 1;

    for (const row of [...prev, ...next]) {
        const source = sourceFromUnknownRow(row, index++);
        if (source) map.set(source.link, source);
    }

    return Array.from(map.values()).sort((a, b) => a.index - b.index);
}
