import type { ThreadArtifact, ThreadItem } from '../types';

/** D1 row size — avoid failing the whole upsert when a chat image is huge. */
export const MAX_PERSIST_IMAGE_ATTACHMENT_CHARS = 100_000;

/** Canonical artifact is `threads.artifact`; do not duplicate full bodies on thread items. */
export const MAX_PERSIST_ARTIFACT_CHARS = 500_000;

export function truncateArtifactForPersist(
    artifact: ThreadArtifact | null | undefined
): ThreadArtifact | null {
    if (!artifact) return null;
    if (artifact.content.length <= MAX_PERSIST_ARTIFACT_CHARS) return artifact;
    return {
        ...artifact,
        content: artifact.content.slice(0, MAX_PERSIST_ARTIFACT_CHARS),
    };
}

/** Strip denormalized artifact from item.object before D1 upsert. */
export function stripArtifactFromThreadItemObject(item: ThreadItem): ThreadItem {
    if (!item.object || !('artifact' in item.object)) return item;
    const { artifact: _removed, ...rest } = item.object as ThreadItem['object'] & {
        artifact?: unknown;
    };
    const nextObject =
        rest && typeof rest === 'object' && Object.keys(rest).length > 0 ? rest : undefined;
    return { ...item, object: nextObject };
}

export function sanitizeThreadItemForPersist(item: ThreadItem): ThreadItem {
    let next = stripArtifactFromThreadItemObject(item);

    const attachment = next.imageAttachment;
    if (!attachment || attachment.length <= MAX_PERSIST_IMAGE_ATTACHMENT_CHARS) {
        return next;
    }

    const { imageAttachment: _removed, ...rest } = next;
    return {
        ...rest,
        metadata: {
            ...(next.metadata ?? {}),
            imageAttachmentOmitted: true,
        },
    };
}
