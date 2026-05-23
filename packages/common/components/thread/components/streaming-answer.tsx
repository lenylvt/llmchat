'use client';

import type { PreparedAnswerContent } from '@repo/shared/utils';
import { memo } from 'react';
import { MarkdownContent } from './markdown-content';

type StreamingAnswerProps = {
    prepared: PreparedAnswerContent;
};

const answerBodyClass =
    'w-full min-w-0 max-w-full overflow-x-hidden break-words [overflow-wrap:anywhere]';

/** Renders prepared markdown (citations already stripped upstream). */
export const StreamingAnswer = memo(({ prepared }: StreamingAnswerProps) => {
    if (!prepared.markdown && prepared.citedIndices.length === 0) return null;

    return (
        <div className={answerBodyClass}>
            <MarkdownContent prepared={prepared} className="min-w-0 max-w-full" />
        </div>
    );
});

StreamingAnswer.displayName = 'StreamingAnswer';
