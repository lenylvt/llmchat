import {
    ErrorBoundary,
    ErrorPlaceholder,
    mdxComponents,
} from '@repo/common/components';
import type { PreparedAnswerContent } from '@repo/shared/utils';
import { cn } from '@repo/ui';
import { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export type { PreparedAnswerContent } from '@repo/shared/utils';
export { prepareAnswerContent } from '@repo/shared/utils';

export const markdownStyles = {
    'prose prose-sm min-w-0 max-w-full whitespace-normal break-words [overflow-wrap:anywhere]': true,

    // Text styles
    'prose-p:font-normal prose-p:text-base prose-p:leading-[1.65rem]': true,
    'prose-headings:text-base prose-headings:font-medium ': true,
    'prose-h1:text-2xl prose-h1:font-medium ': true,
    'prose-h2:text-2xl prose-h2:font-medium ': true,
    'prose-h3:text-lg prose-h3:font-medium ': true,
    'prose-strong:font-medium prose-th:font-medium': true,

    'prose-li:text-muted-foreground prose-li:font-normal prose-li:leading-[1.65rem]': true,

    // Code styles
    'prose-code:font-mono prose-code:text-sm prose-code:font-normal prose-code:break-words prose-code:[overflow-wrap:anywhere]':
        true,
    'prose-code:bg-secondary prose-code:border-border prose-code:border prose-code:rounded-lg prose-code:p-0.5':
        true,

    // Table styles
    'prose-table:border-border prose-table:border prose-table:rounded-lg prose-table:bg-background':
        true,

    // Table header
    'prose-th:text-sm prose-th:font-medium prose-th:text-muted-foreground prose-th:bg-tertiary prose-th:px-3 prose-th:py-1.5':
        true,

    // Table row
    'prose-tr:border-border prose-tr:border': true,

    // Table cell
    'prose-td:px-3 prose-td:py-2.5': true,

    // Theme
    'prose-prosetheme': true,
};

type MarkdownContentProps = {
    prepared: PreparedAnswerContent;
    className?: string;
};

export const removeIncompleteTags = (content: string) => {
    const lastLessThan = content.lastIndexOf('<');
    if (lastLessThan !== -1) {
        const textAfterLastLessThan = content.substring(lastLessThan);
        if (!textAfterLastLessThan.includes('>')) {
            return content.substring(0, lastLessThan);
        }
    }

    return content;
};

export const normalizeContent = (content: string) => {
    return content.replace(/\\n/g, '\n');
};

export const MarkdownContent = memo(({ prepared, className }: MarkdownContentProps) => {
    if (!prepared.markdown) return null;

    return (
        <div
            className={cn(
                'relative w-full min-w-0 max-w-full overflow-x-hidden',
                markdownStyles,
                className
            )}
        >
            <ErrorBoundary fallback={<ErrorPlaceholder />}>
                <div className="prose-pre:max-w-full prose-pre:overflow-x-auto min-w-0 max-w-full [&_pre]:max-w-full [&_pre]:overflow-x-auto">
                    <MemoizedMdxChunk chunk={prepared.markdown} />
                </div>
            </ErrorBoundary>
        </div>
    );
});

MarkdownContent.displayName = 'MarkdownContent';

export const MemoizedMdxChunk = memo(({ chunk }: { chunk: string }) => {
    if (!chunk) return null;

    return (
        <ErrorBoundary fallback={<ErrorPlaceholder />}>
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdxComponents as never}>
                {chunk}
            </ReactMarkdown>
        </ErrorBoundary>
    );
});

MemoizedMdxChunk.displayName = 'MemoizedMdxChunk';
