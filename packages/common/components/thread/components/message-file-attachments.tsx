'use client';

import { getFileExtension, isImageMimeType } from '@repo/shared/config';
import type { ThreadFileAttachment } from '@repo/shared/types';
import {
    Button,
    cn,
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    Flex,
} from '@repo/ui';
import { useCallback, useEffect, useState } from 'react';
import { ImageMessage } from './image-message';

const isTextLike = (filename: string, mediaType: string) => {
    const ext = getFileExtension(filename);
    if (mediaType.startsWith('text/')) return true;
    return ['txt', 'md', 'csv', 'json', 'log', 'xml', 'yaml', 'yml'].includes(ext);
};

const FileChip = ({
    file,
    imageDataUrl,
}: {
    file: ThreadFileAttachment;
    imageDataUrl?: string;
}) => {
    const [open, setOpen] = useState(false);
    const [text, setText] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const ext = getFileExtension(file.filename);
    const canPreviewText = isTextLike(file.filename, file.mediaType);

    const loadText = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/files/${file.id}/content`, { credentials: 'include' });
            if (!res.ok) throw new Error('Failed to load');
            setText(await res.text());
        } catch {
            setText('Could not load file content.');
        } finally {
            setLoading(false);
        }
    }, [file.id]);

    useEffect(() => {
        if (open && canPreviewText && text === null) {
            void loadText();
        }
    }, [open, canPreviewText, text, loadText]);

    if (imageDataUrl) {
        return <ImageMessage imageAttachment={imageDataUrl} />;
    }

    return (
        <>
            <button
                type="button"
                onClick={() => canPreviewText && setOpen(true)}
                className={cn(
                    'bg-muted/60 text-muted-foreground border-border inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium',
                    canPreviewText && 'hover:bg-muted cursor-pointer'
                )}
            >
                <span className="text-foreground/80 uppercase">{ext}</span>
                <span className="max-w-[160px] truncate">{file.filename}</span>
            </button>

            {canPreviewText && (
                <Dialog open={open} onOpenChange={setOpen}>
                    <DialogContent className="bg-secondary border-border max-h-[min(70vh,520px)] max-w-lg overflow-hidden">
                        <DialogHeader>
                            <DialogTitle className="text-sm font-medium">{file.filename}</DialogTitle>
                        </DialogHeader>
                        <div className="bg-tertiary border-border max-h-[min(50vh,400px)] overflow-auto rounded-md border p-3">
                            {loading ? (
                                <p className="text-muted-foreground text-xs">Loading…</p>
                            ) : (
                                <pre className="text-foreground whitespace-pre-wrap break-words font-mono text-xs leading-relaxed">
                                    {text}
                                </pre>
                            )}
                        </div>
                        <div className="flex justify-end">
                            <Button size="xs" variant="bordered" onClick={() => setOpen(false)}>
                                Close
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            )}
        </>
    );
};

export const MessageFileAttachments = ({
    files,
    imageAttachment,
}: {
    files?: ThreadFileAttachment[];
    imageAttachment?: string;
}) => {
    const list = files ?? [];
    const docFiles = list.filter(f => !isImageMimeType(f.mediaType));

    if (!imageAttachment && docFiles.length === 0) return null;

    return (
        <Flex className="flex-wrap justify-end gap-2" gap="sm">
            {imageAttachment && <ImageMessage imageAttachment={imageAttachment} />}
            {docFiles.map(file => (
                <FileChip key={file.id} file={file} />
            ))}
        </Flex>
    );
};
