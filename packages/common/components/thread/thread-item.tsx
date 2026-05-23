import {
    AnimateEnter,
    CitationProvider,
    FollowupSuggestions,
    Message,
    MessageActions,
    MotionSkeleton,
    QuestionPrompt,
    SourceGrid,
    Steps,
} from '@repo/common/components';
import { useChatStore } from '@repo/common/store';
import { ThreadItem as ThreadItemType } from '@repo/shared/types';
import { Alert, AlertDescription, cn } from '@repo/ui';
import { IconAlertCircle } from '@tabler/icons-react';
import { memo, useEffect, useMemo, useRef } from 'react';
import { useInView } from 'react-intersection-observer';
import { StreamingAnswer } from './components/streaming-answer';

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
                    .flatMap(step => step.steps?.read?.data?.map((result: any) => result.link))
                    .filter((link): link is string => link !== undefined) || [];
            return setCurrentSources(sources);
        }, [threadItem]);

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
            <CitationProvider sources={threadItem.sources || []}>
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
                                    <SourceGrid sources={threadItem.sources || []} />
                                    <StreamingAnswer
                                        text={answerText}
                                        isStreaming={isStreaming}
                                        isCompleted={isAnswerDone}
                                        isLast={isLast}
                                    />
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
            </CitationProvider>
        );
    },
    (prevProps, nextProps) =>
        prevProps.isGenerating === nextProps.isGenerating &&
        prevProps.isLast === nextProps.isLast &&
        JSON.stringify(prevProps.threadItem) === JSON.stringify(nextProps.threadItem)
);

ThreadItem.displayName = 'ThreadItem';
