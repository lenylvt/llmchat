import type { Source } from '@repo/shared/types';
import { cn } from '@repo/ui';
import { IconCheck, IconLoader2 } from '@tabler/icons-react';
import { memo } from 'react';
import type { ActivityTimelineEvent } from './tool-activity-utils';
import { sourceDisplayLabel } from './tool-activity-utils';

function TimelineDot({ status }: { status: 'pending' | 'done' }) {
    if (status === 'pending') {
        return (
            <span className="bg-background relative flex size-4 shrink-0 items-center justify-center rounded-full border border-border">
                <IconLoader2 size={10} strokeWidth={2.5} className="text-muted-foreground animate-spin" />
            </span>
        );
    }

    return (
        <span className="bg-brand/15 flex size-4 shrink-0 items-center justify-center rounded-full">
            <IconCheck size={10} strokeWidth={2.5} className="text-brand" />
        </span>
    );
}

const ResultLinks = memo(({ sources }: { sources: Source[] }) => (
    <ul className="mt-1.5 list-none space-y-1 pl-0">
        {sources.map(source => (
            <li key={`${source.index}-${source.link}`}>
                <a
                    href={source.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground block truncate text-sm underline-offset-2 hover:underline"
                >
                    {sourceDisplayLabel(source)}
                </a>
            </li>
        ))}
    </ul>
));
ResultLinks.displayName = 'ResultLinks';

const TimelineRow = memo(({ event, isLast }: { event: ActivityTimelineEvent; isLast: boolean }) => {
    const isResultsOnly = event.id === 'sources' && !event.detail;

    return (
        <li className="flex gap-3">
            <div className="flex flex-col items-center pt-0.5">
                <TimelineDot status={event.status} />
                {!isLast && <div className="bg-border/70 mt-1 min-h-4 w-px flex-1" />}
            </div>
            <div className={cn('min-w-0 flex-1', !isLast && 'pb-4')}>
                {!isResultsOnly && (
                    <>
                        <p className="text-sm leading-snug text-foreground/90">{event.title}</p>
                        {event.detail && (
                            <p className="text-muted-foreground mt-0.5 text-sm leading-snug">
                                {event.detail}
                            </p>
                        )}
                    </>
                )}
                {event.sources && event.sources.length > 0 && (
                    <div className={isResultsOnly ? undefined : 'mt-1.5'}>
                        {isResultsOnly && (
                            <p className="text-sm leading-snug text-foreground/90">{event.title}</p>
                        )}
                        <ResultLinks sources={event.sources} />
                    </div>
                )}
            </div>
        </li>
    );
});
TimelineRow.displayName = 'TimelineRow';

export const ActivityTimeline = memo(({ events }: { events: ActivityTimelineEvent[] }) => {
    if (events.length === 0) {
        return (
            <p className="text-muted-foreground px-1 py-6 text-sm">No research steps yet.</p>
        );
    }

    return (
        <ol className="flex w-full flex-col px-1 py-2">
            {events.map((event, index) => (
                <TimelineRow
                    key={event.id}
                    event={event}
                    isLast={index === events.length - 1}
                />
            ))}
        </ol>
    );
});
ActivityTimeline.displayName = 'ActivityTimeline';
