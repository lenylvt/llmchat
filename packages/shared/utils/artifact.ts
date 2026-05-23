import { ARTIFACT_TOOL_NAME, type ThreadArtifact } from '../types/artifact';
import { stringArg } from './tool-args';

export { ARTIFACT_TOOL_NAME };

export function isArtifactToolName(toolName: string): boolean {
    return toolName.trim().toLowerCase() === ARTIFACT_TOOL_NAME;
}

function parseAction(raw: unknown): 'create' | 'update' | 'replace' | 'delete' {
    const action = String(raw ?? 'replace').toLowerCase();
    if (action === 'create' || action === 'update' || action === 'delete') return action;
    return 'replace';
}

/** Apply an artifact tool call to the current thread document (one per thread). */
export function applyArtifactToolAction(
    current: ThreadArtifact | null | undefined,
    args: Record<string, unknown>
): ThreadArtifact | null {
    const action = parseAction(args.action);
    const now = new Date().toISOString();

    if (action === 'delete') {
        return null;
    }

    const nextTitle = stringArg(args, 'title');
    const nextContent = stringArg(args, 'content');
    const title = nextTitle ?? current?.title ?? 'Document';

    // Never wipe an existing body when the model omits content (common on create mid-thread).
    const content =
        nextContent ??
        (action === 'create' && !current ? '' : (current?.content ?? ''));

    return {
        title,
        content,
        updatedAt: now,
        updatedBy: 'assistant',
    };
}

/** Skip artifact writes when SSE delivered incomplete function arguments. */
export function isIncompleteArtifactToolArgs(args: Record<string, unknown>): boolean {
    if ('raw' in args || 'partial' in args) return true;
    const hasPayload =
        stringArg(args, 'content') !== undefined ||
        stringArg(args, 'title') !== undefined ||
        typeof args.action === 'string';
    return !hasPayload;
}

const DOCUMENT_REQUEST_RE =
    /\b(doc(ument)?|lettre|draft|modèle|mod[eè]le|template|rédige|cr[eé]e|cr[eé]er|mets?\s+[àa]\s+jour|remboursement)\b/i;

/** True when the user message is asking for a thread document. */
export function userWantsThreadDocument(query: string): boolean {
    return DOCUMENT_REQUEST_RE.test(query.trim());
}

function inferTitleFromQuery(query: string): string {
    const q = query.trim();
    if (/google/i.test(q)) return 'Google Play refund request';
    if (/apple/i.test(q)) return 'Apple refund request';
    if (/remboursement|refund/i.test(q)) return 'Refund request';
    if (/lettre|email|mail/i.test(q)) return 'Draft';
    return 'Document';
}

/** Pull a letter-like body from an assistant reply when the model skipped the artifact tool. */
export function extractArtifactBodyFromAnswer(answer: string): string | null {
    const text = answer.trim();
    if (text.length < 80) return null;

    const lines = text.split('\n');
    const bodyStartPatterns = [
        /^objet\s*:/i,
        /^subject\s*:/i,
        /^bonjour[,]?\s*$/i,
        /^dear\s+/i,
        /^to\s+whom/i,
        /^#{1,3}\s+\S/,
    ];
    const preamblePatterns = [
        /^(done|ok|voilà|le doc|document|j['’]ai|tu peux|panneau)/i,
        /^research\b/i,
        /^\d+\s+step/i,
    ];

    let start = -1;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        if (bodyStartPatterns.some(p => p.test(line))) {
            start = i;
            break;
        }
    }

    if (start < 0) {
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            if (preamblePatterns.some(p => p.test(line))) continue;
            if (line.length >= 12) {
                start = i;
                break;
            }
        }
    }

    if (start < 0) return null;

    const tailStopPatterns = [
        /^le doc est prêt/i,
        /^tu peux (le )?modifier/i,
        /^dis[- ]moi si/i,
        /^want me to/i,
    ];
    const bodyLines: string[] = [];
    for (let i = start; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        if (trimmed && tailStopPatterns.some(p => p.test(trimmed))) break;
        bodyLines.push(line);
    }

    const body = bodyLines.join('\n').trim();
    return body.length >= 80 ? body : null;
}

/**
 * When the model dumps the document in chat instead of calling `artifact`, mirror it into the panel.
 */
export function tryArtifactFallbackFromAnswer(
    current: ThreadArtifact | null | undefined,
    answer: string,
    userQuery: string,
    artifactToolApplied: boolean
): ThreadArtifact | null {
    if (artifactToolApplied) return current ?? null;

    const content = extractArtifactBodyFromAnswer(answer);
    if (!content) return current ?? null;

    const looksLikeLetter =
        /^objet\s*:/im.test(content) ||
        /^bonjour[,]?\s*$/im.test(content.split('\n')[0]?.trim() ?? '') ||
        /^dear\s+/im.test(content);

    if (!userWantsThreadDocument(userQuery) && !looksLikeLetter) {
        return current ?? null;
    }

    return applyArtifactToolAction(current, {
        action: current ? 'replace' : 'create',
        title: inferTitleFromQuery(userQuery),
        content,
    });
}

/** Prefix injected into the next user message so Grok sees the live document. */
export function formatArtifactContextBlock(artifact: ThreadArtifact | null | undefined): string {
    if (!artifact?.content?.trim() && !artifact?.title?.trim()) return '';
    const title = artifact.title?.trim() || 'Document';
    const body = artifact.content?.trim() ?? '';
    if (!body) {
        return `[Thread document "${title}" is open but empty.]\n\n`;
    }
    return `[Thread document: ${title}]\n${body}\n\n---\n\n`;
}
