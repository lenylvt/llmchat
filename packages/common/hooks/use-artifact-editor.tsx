import Bold from '@tiptap/extension-bold';
import BulletList from '@tiptap/extension-bullet-list';
import Code from '@tiptap/extension-code';
import Document from '@tiptap/extension-document';
import HardBreak from '@tiptap/extension-hard-break';
import Heading from '@tiptap/extension-heading';
import Italic from '@tiptap/extension-italic';
import ListItem from '@tiptap/extension-list-item';
import OrderedList from '@tiptap/extension-ordered-list';
import Paragraph from '@tiptap/extension-paragraph';
import Placeholder from '@tiptap/extension-placeholder';
import Text from '@tiptap/extension-text';
import { Editor, useEditor } from '@tiptap/react';
import { Markdown } from 'tiptap-markdown';
import { useEffect } from 'react';

export function useArtifactEditor({
    content,
    placeholder = 'Write here…',
    onUpdate,
}: {
    content: string;
    placeholder?: string;
    onUpdate?: (markdown: string) => void;
}) {
    const editor = useEditor({
        extensions: [
            Document,
            Paragraph,
            Text,
            Bold,
            Italic,
            Code,
            Heading.configure({ levels: [1, 2, 3] }),
            BulletList,
            OrderedList,
            ListItem,
            HardBreak,
            Placeholder.configure({ placeholder }),
            Markdown.configure({
                html: false,
                breaks: true,
                transformPastedText: true,
                transformCopiedText: true,
            }),
        ],
        immediatelyRender: false,
        content: content || '',
        editorProps: {
            attributes: {
                class: 'artifact-editor tiptap h-full min-h-full w-full text-sm leading-relaxed outline-none',
            },
        },
        onUpdate: ({ editor: ed }) => {
            const md = (ed.storage as { markdown?: { getMarkdown: () => string } }).markdown?.getMarkdown();
            onUpdate?.(md ?? ed.getText());
        },
    });

    useEffect(() => {
        if (!editor) return;
        const storage = editor.storage as { markdown?: { getMarkdown: () => string } };
        const current = storage.markdown?.getMarkdown() ?? editor.getText();
        if (content !== current) {
            editor.commands.setContent(content || '', { emitUpdate: false });
        }
    }, [content, editor]);

    return { editor };
}

export type ArtifactEditorInstance = Editor | null;
