'use client';

import { Button, Tooltip } from '@repo/ui';
import { IconPaperclip } from '@tabler/icons-react';
import { FC } from 'react';

export type FileUploadProps = {
    id: string;
    tooltip: string;
    handleFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
};

export const FileUpload: FC<FileUploadProps> = ({ id, tooltip, handleFileUpload }) => {
    const handleFileSelect = () => {
        document.getElementById(id)?.click();
    };

    return (
        <>
            <input
                type="file"
                id={id}
                className="hidden"
                onChange={handleFileUpload}
                accept="*/*"
            />
            <Tooltip content={tooltip}>
                <Button variant="ghost" size="icon-sm" onClick={handleFileSelect}>
                    <IconPaperclip size={16} strokeWidth={2} />
                </Button>
            </Tooltip>
        </>
    );
};
