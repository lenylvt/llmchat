'use client';

import { useArtifactEditor } from '@repo/common/hooks';
import type { ThreadArtifact } from '@repo/shared/types';
import { EditorContent } from '@tiptap/react';
import { FC } from 'react';

export type ArtifactEditorPanelProps = {
    artifact: ThreadArtifact;
    onContentChange: (content: string) => void;
};

export const ArtifactEditorPanel: FC<ArtifactEditorPanelProps> = ({
    artifact,
    onContentChange,
}) => {
    const { editor } = useArtifactEditor({
        content: artifact.content,
        onUpdate: onContentChange,
    });

    return (
        <div className="flex h-full min-h-0 w-full flex-1 flex-col">
            {editor ? (
                <EditorContent
                    editor={editor}
                    className="artifact-editor-root flex h-full min-h-0 flex-1 flex-col"
                />
            ) : null}
        </div>
    );
};
