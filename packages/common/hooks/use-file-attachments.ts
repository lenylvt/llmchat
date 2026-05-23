import { useChatStore } from '@repo/common/store';
import { isImageMimeType, XAI_FILE_MAX_BYTES } from '@repo/shared/config';
import type { ThreadFileAttachment } from '@repo/shared/types';
import { useToast } from '@repo/ui';
import { ChangeEvent, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';

export const useFileAttachments = (onImageFile?: (file: File) => void) => {
    const pendingFiles = useChatStore(state => state.pendingFileAttachments);
    const addPendingFile = useChatStore(state => state.addPendingFileAttachment);
    const removePendingFile = useChatStore(state => state.removePendingFileAttachment);
    const beginUpload = useChatStore(state => state.beginPendingFileUpload);
    const endUpload = useChatStore(state => state.endPendingFileUpload);
    const isUploading = useChatStore(state => state.pendingFileUploadCount > 0);
    const { toast } = useToast();

    const uploadDocument = useCallback(
        async (file: File) => {
            if (file.size > XAI_FILE_MAX_BYTES) {
                toast({
                    title: 'File too large',
                    description: `Maximum file size is ${Math.round(XAI_FILE_MAX_BYTES / (1024 * 1024))} MB.`,
                    variant: 'destructive',
                });
                return;
            }

            beginUpload();
            try {
                const formData = new FormData();
                formData.append('file', file);

                const response = await fetch('/api/files', {
                    method: 'POST',
                    body: formData,
                    credentials: 'include',
                });

                if (!response.ok) {
                    const body = (await response.json().catch(() => ({}))) as { error?: string };
                    if (response.status === 401) {
                        toast({
                            title: 'Sign in required',
                            description: 'Sign in to attach files to your messages.',
                            variant: 'destructive',
                        });
                        return;
                    }
                    toast({
                        title: 'Upload failed',
                        description: body.error ?? 'Could not upload file',
                        variant: 'destructive',
                    });
                    return;
                }

                const data = (await response.json()) as ThreadFileAttachment;
                addPendingFile({
                    id: data.id,
                    xaiFileId: data.xaiFileId,
                    filename: data.filename,
                    mediaType: data.mediaType,
                    sizeBytes: data.sizeBytes,
                });
            } finally {
                endUpload();
            }
        },
        [addPendingFile, beginUpload, endUpload, toast]
    );

    const handleFile = useCallback(
        async (file?: File) => {
            if (!file) return;
            if (isImageMimeType(file.type)) {
                onImageFile?.(file);
                return;
            }
            await uploadDocument(file);
        },
        [onImageFile, uploadDocument]
    );

    const onDrop = useCallback(
        (acceptedFiles: File[]) => {
            const file = acceptedFiles[0];
            void handleFile(file);
        },
        [handleFile]
    );

    const dropzoneProps = useDropzone({
        onDrop,
        multiple: false,
        noClick: true,
    });

    const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        await handleFile(file);
    };

    return {
        pendingFiles,
        isUploading,
        removePendingFile,
        dropzoneProps,
        handleFileUpload,
    };
};
