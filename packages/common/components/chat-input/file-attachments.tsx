'use client';

import { useChatStore } from '@repo/common/store';
import { getFileExtension } from '@repo/shared/config';
import { Button, Flex } from '@repo/ui';
import { X } from 'lucide-react';

export const PendingFileAttachments = () => {
    const files = useChatStore(state => state.pendingFileAttachments);
    const isUploading = useChatStore(state => state.pendingFileUploadCount > 0);
    const remove = useChatStore(state => state.removePendingFileAttachment);

    if (!files.length && !isUploading) return null;

    return (
        <Flex className="flex-wrap gap-2 px-3 pt-2" gap="sm">
            {isUploading && (
                <span className="text-muted-foreground text-xs">Preparing file…</span>
            )}
            {files.map(file => (
                <div
                    key={file.id}
                    className="bg-muted/60 text-muted-foreground border-border flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium"
                >
                    <span className="text-foreground/80 uppercase">
                        {getFileExtension(file.filename)}
                    </span>
                    <span className="max-w-[140px] truncate">{file.filename}</span>
                    <Button
                        size="icon-xs"
                        variant="ghost"
                        className="h-4 w-4 shrink-0"
                        onClick={() => remove(file.id)}
                        aria-label="Remove file"
                    >
                        <X size={12} strokeWidth={2} />
                    </Button>
                </div>
            ))}
        </Flex>
    );
};
