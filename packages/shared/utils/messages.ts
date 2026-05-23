import { ThreadFileAttachment, ThreadItem } from '@repo/shared/types';

type UserContentPart =
    | { type: 'text'; text: string }
    | { type: 'image'; image: string }
    | {
          type: 'file';
          data: string;
          mediaType: string;
          filename?: string;
          providerOptions?: { xai?: { fileId: string } };
      };

type CoreMessage =
    | { role: 'user'; content: string | UserContentPart[] }
    | { role: 'assistant'; content: string };

function buildUserContent(
    query: string,
    imageAttachment?: string,
    fileAttachments?: ThreadFileAttachment[]
): string | UserContentPart[] {
    const parts: UserContentPart[] = [];

    if (query) {
        parts.push({ type: 'text', text: query });
    }

    if (imageAttachment) {
        parts.push({ type: 'image', image: imageAttachment });
    }

    for (const file of fileAttachments ?? []) {
        parts.push({
            type: 'file',
            data: file.xaiFileId,
            mediaType: file.mediaType,
            filename: file.filename,
            providerOptions: {
                xai: { fileId: file.xaiFileId },
            },
        });
    }

    if (parts.length === 0) return '';
    if (parts.length === 1 && parts[0].type === 'text') return parts[0].text;
    return parts;
}

export const buildCoreMessagesFromThreadItems = ({
    messages,
    query,
    imageAttachment,
    fileAttachments,
}: {
    messages: ThreadItem[];
    query: string;
    imageAttachment?: string;
    fileAttachments?: ThreadFileAttachment[];
}): CoreMessage[] => {
    return [
        ...(messages || []).flatMap(item => [
            {
                role: 'user' as const,
                content: buildUserContent(
                    item.query || '',
                    item.imageAttachment,
                    item.fileAttachments
                ),
            },
            {
                role: 'assistant' as const,
                content: item.answer?.text || '',
            },
        ]),
        {
            role: 'user' as const,
            content: buildUserContent(query, imageAttachment, fileAttachments),
        },
    ];
};
