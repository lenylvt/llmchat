'use client';

import { memo } from 'react';
import { MarkdownContent } from './markdown-content';

type StreamingAnswerProps = {
    text: string;
    isStreaming: boolean;
    isCompleted?: boolean;
    isLast?: boolean;
};

const answerBodyClass =
    'w-full min-w-0 max-w-full overflow-x-hidden break-words [overflow-wrap:anywhere]';

/** Renders markdown while streaming and after completion without swapping renderers. */
export const StreamingAnswer = memo(
    ({ text, isStreaming, isCompleted, isLast }: StreamingAnswerProps) => {
        if (!text) return null;

        return (
            <div className={answerBodyClass}>
                <MarkdownContent
                    content={text}
                    isCompleted={isCompleted}
                    isStreaming={isStreaming}
                    isLast={isLast}
                    className="min-w-0 max-w-full"
                />
            </div>
        );
    }
);

StreamingAnswer.displayName = 'StreamingAnswer';
