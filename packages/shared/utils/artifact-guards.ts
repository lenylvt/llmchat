import type { ThreadArtifact } from '../types/artifact';

export function isThreadArtifact(value: unknown): value is ThreadArtifact {
    if (!value || typeof value !== 'object') return false;
    const record = value as Record<string, unknown>;
    return (
        typeof record.title === 'string' &&
        typeof record.content === 'string' &&
        typeof record.updatedAt === 'string' &&
        (record.updatedBy === 'assistant' || record.updatedBy === 'user')
    );
}

export function artifactsEqual(
    a: ThreadArtifact | null | undefined,
    b: ThreadArtifact | null | undefined
): boolean {
    if (!a && !b) return true;
    if (!a || !b) return false;
    return (
        a.title === b.title &&
        a.content === b.content &&
        a.updatedAt === b.updatedAt &&
        a.updatedBy === b.updatedBy
    );
}
