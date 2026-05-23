import type { CoreMessage } from 'ai';

type XaiInputPart =
    | { type: 'input_text'; text: string }
    | { type: 'input_image'; image_url: string }
    | { type: 'input_file'; file_id: string }
    | { type: 'input_file'; file_url: string };

type XaiInputMessage =
    | { role: 'system'; content: string }
    | { role: 'user'; content: XaiInputPart[] | string }
    | { role: 'assistant'; content: string };

function getXaiFileId(part: { providerOptions?: { xai?: { fileId?: string } } }): string | undefined {
    const id = part.providerOptions?.xai?.fileId;
    return typeof id === 'string' && id.length > 0 ? id : undefined;
}

function toImageUrl(data: unknown, mediaType: string): string {
    if (data instanceof URL) return data.toString();
    if (typeof data === 'string') {
        if (data.startsWith('data:') || data.startsWith('http')) return data;
        return `data:${mediaType};base64,${data}`;
    }
    return '';
}

export function messagesHaveXaiFileIds(messages: CoreMessage[]): boolean {
    return messages.some(
        m =>
            m.role === 'user' &&
            Array.isArray(m.content) &&
            m.content.some(p => p.type === 'file' && !!getXaiFileId(p))
    );
}

export function buildXaiResponsesInput(
    messages: CoreMessage[],
    system: string
): XaiInputMessage[] {
    const input: XaiInputMessage[] = [{ role: 'system', content: system }];

    for (const message of messages) {
        if (message.role === 'assistant') {
            const text =
                typeof message.content === 'string'
                    ? message.content
                    : message.content
                          .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
                          .map(p => p.text)
                          .join('');
            if (text) input.push({ role: 'assistant', content: text });
            continue;
        }

        if (message.role !== 'user') continue;

        if (typeof message.content === 'string') {
            if (message.content) input.push({ role: 'user', content: message.content });
            continue;
        }

        const parts: XaiInputPart[] = [];
        for (const block of message.content) {
            if (block.type === 'text' && block.text) {
                parts.push({ type: 'input_text', text: block.text });
                continue;
            }
            if (block.type === 'image') {
                const image =
                    typeof block.image === 'string'
                        ? block.image
                        : block.image instanceof URL
                          ? block.image.toString()
                          : '';
                if (image) parts.push({ type: 'input_image', image_url: image });
                continue;
            }
            if (block.type === 'file') {
                const fileId = getXaiFileId(block);
                if (fileId) {
                    parts.push({ type: 'input_file', file_id: fileId });
                    continue;
                }
                if (block.data instanceof URL) {
                    parts.push({ type: 'input_file', file_url: block.data.toString() });
                    continue;
                }
                if (block.mediaType.startsWith('image/')) {
                    const mediaType =
                        block.mediaType === 'image/*' ? 'image/jpeg' : block.mediaType;
                    const url = toImageUrl(block.data, mediaType);
                    if (url) parts.push({ type: 'input_image', image_url: url });
                }
            }
        }

        if (parts.length === 1 && parts[0].type === 'input_text') {
            input.push({ role: 'user', content: parts[0].text });
        } else if (parts.length > 0) {
            input.push({ role: 'user', content: parts });
        }
    }

    return input;
}

/** Server-side agentic tools for `/v1/responses` (OpenAI-compatible type names). */
export const XAI_RESPONSES_TOOLS = [
    { type: 'web_search' as const, enable_image_understanding: true },
    {
        type: 'x_search' as const,
        enable_image_understanding: true,
        enable_video_understanding: true,
    },
    { type: 'code_interpreter' as const },
];
