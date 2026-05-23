import {
    AnimateEnter,
    FollowupSuggestions,
    Message,
    MessageActions,
    MotionSkeleton,
    QuestionPrompt,
    Steps,
} from '@repo/common/components';
import { useChatStore } from '@repo/common/store';
import { Source, ThreadItem as ThreadItemType } from '@repo/shared/types';
import {
    mergeSourcesByIndex,
    prepareAnswerContent,
    type PreparedAnswerContent,
} from '@repo/shared/utils';
import { getHost, isValidUrl } from '@repo/shared/utils';
import { Alert, AlertDescription, cn } from '@repo/ui';
import { IconAlertCircle } from '@tabler/icons-react';
import { memo, useEffect, useMemo, useRef } from 'react';
import { useInView } from 'react-intersection-observer';
import { collectSourcesFromThreadItem } from './collect-sources';
import { CitationFooter } from './components/citation-footer';
import { StreamingAnswer } from './components/streaming-answer';

function buildPreparedAnswer(
    answerText: string,
    threadItem: ThreadItemType,
    isStreaming: boolean
): { prepared: PreparedAnswerContent; footerSources: Source[] } {
    const prepared = prepareAnswerContent(answerText, { isStreaming });

    const fromPersisted = collectSourcesFromThreadItem(threadItem);
    const fromInline = Object.entries(prepared.citationUrls)
        .map(([indexKey, url]) => {
            const index = Number.parseInt(indexKey, 10);
            if (Number.isNaN(index) || !isValidUrl(url)) return null;
            return {
                index,
                link: url,
                title: getHost(url) ?? url,
            };
        })
        .filter((source): source is NonNullable<typeof source> => source !== null);

    const all = mergeSourcesByIndex(fromPersisted, fromInline);
    const footerSources =
        prepared.citedIndices.length > 0
            ? all.filter(source => prepared.citedIndices.includes(source.index))
            : all;

    return { prepared, footerSources };
}

function threadItemRenderKey(item: ThreadItemType) {
    return [
        item.id,
        item.status,
        item.answer?.text,
        item.sources?.length,
        item.error,
        item.updatedAt?.toString?.(),
    ].join(':');
}

export const ThreadItem = memo(
    ({
        threadItem,
        isGenerating,
        isLast,
    }: {
        isAnimated: boolean;
        threadItem: ThreadItemType;
        isGenerating: boolean;
        isLast: boolean;
    }) => {
        const answerText = threadItem.answer?.text || '';
        const isStreaming = isLast && isGenerating;

        const { prepared, footerSources } = useMemo(
            () => buildPreparedAnswer(answerText, threadItem, isStreaming),
            [answerText, isStreaming, threadItem]
        );

        const isAnswerDone = ['COMPLETED', 'ERROR', 'ABORTED'].includes(threadItem.status || '');

        const setCurrentSources = useChatStore(state => state.setCurrentSources);
        const messageRef = useRef<HTMLDivElement>(null);
        const actionsEnterApplied = useRef(false);

        const { ref: inViewRef, inView } = useInView({});

        useEffect(() => {
            if (inView && threadItem.id) {
                useChatStore.getState().setActiveThreadItemView(threadItem.id);
            }
        }, [inView, threadItem.id]);

        useEffect(() => {
            const sources =
                Object.values(threadItem.steps || {})
                    ?.filter(
                        step =>
                            step.steps && 'read' in step?.steps && !!step.steps?.read?.data?.length
                    )
                    .flatMap(step => step.steps?.read?.data?.map((result: { link?: string }) => result.link))
                    .filter((link): link is string => link !== undefined) || [];
            return setCurrentSources(sources);
        }, [threadItem, setCurrentSources]);

        const hasAnswer = answerText.length > 0;

        const showMessageActions = useMemo(
            () => !isStreaming && hasAnswer && (isAnswerDone || !isGenerating),
            [isStreaming, hasAnswer, isAnswerDone, isGenerating]
        );

        if (showMessageActions && !actionsEnterApplied.current) {
            actionsEnterApplied.current = true;
        }

        const hasResponse = useMemo(() => {
            return (
                !!threadItem?.steps ||
                !!threadItem?.answer?.text ||
                !!threadItem?.object ||
                !!threadItem?.error ||
                threadItem?.status === 'COMPLETED' ||
                threadItem?.status === 'ABORTED' ||
                threadItem?.status === 'ERROR'
            );
        }, [threadItem]);

        return (
            <div className="w-full" ref={inViewRef} id={`thread-item-${threadItem.id}`}>
                <div className={cn('flex w-full flex-col items-start gap-3 pt-4')}>
                    {threadItem.query && (
                        <Message
                            message={threadItem.query}
                            imageAttachment={threadItem?.imageAttachment}
                            fileAttachments={threadItem?.fileAttachments}
                            threadItem={threadItem}
                        />
                    )}

                    {threadItem.steps && (
                        <AnimateEnter stagger={2}>
                            <Steps
                                steps={Object.values(threadItem?.steps || {})}
                                threadItem={threadItem}
                            />
                        </AnimateEnter>
                    )}

                    {!hasResponse && (
                        <div className="flex w-full flex-col items-start gap-2 opacity-10">
                            <MotionSkeleton className="bg-muted-foreground/40 mb-2 h-4 !w-[100px] rounded-sm" />
                            <MotionSkeleton className="w-full bg-gradient-to-r" />
                            <MotionSkeleton className="w-[70%] bg-gradient-to-r" />
                            <MotionSkeleton className="w-[50%] bg-gradient-to-r" />
                        </div>
                    )}

                    <div ref={messageRef} className="min-w-0 w-full max-w-full">
                        {hasAnswer && (
                            <div className="flex min-w-0 w-full max-w-full flex-col gap-1">
                                <StreamingAnswer prepared={prepared} />
                                {(footerSources?.length ?? 0) > 0 && (
                                    <CitationFooter sources={footerSources ?? []} />
                                )}
                                {showMessageActions && (
                                    <MessageActions
                                        threadItem={threadItem}
                                        ref={messageRef}
                                        isLast={isLast}
                                        staggerStart={4}
                                        withEnterAnimation={actionsEnterApplied.current}
                                    />
                                )}
                            </div>
                        )}
                    </div>

                    <QuestionPrompt threadItem={threadItem} />

                    {threadItem.error && (
                        <Alert variant="destructive">
                            <AlertDescription>
                                <IconAlertCircle className="mt-0.5 size-3.5" />
                                {typeof threadItem.error === 'string'
                                    ? threadItem.error
                                    : 'Something went wrong while processing your request. Please try again.'}
                            </AlertDescription>
                        </Alert>
                    )}

                    {threadItem.status === 'ABORTED' && (
                        <Alert variant="warning">
                            <AlertDescription>
                                <IconAlertCircle className="mt-0.5 size-3.5" />
                                {threadItem.error ?? 'Generation stopped'}
                            </AlertDescription>
                        </Alert>
                    )}

                    {showMessageActions && isLast && (
                        <AnimateEnter stagger={9}>
                            <FollowupSuggestions suggestions={threadItem.suggestions || []} />
                        </AnimateEnter>
                    )}
                </div>
            </div>
        );
    },
    (prevProps, nextProps) =>
        prevProps.isGenerating === nextProps.isGenerating &&
        prevProps.isLast === nextProps.isLast &&
        threadItemRenderKey(prevProps.threadItem) === threadItemRenderKey(nextProps.threadItem)
);

ThreadItem.displayName = 'ThreadItem';
