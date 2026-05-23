import { useAppStore } from '@repo/common/store';
import type { Source, Step, ThreadItem } from '@repo/shared/types';
import { sourceFromUnknownRow } from '@repo/shared/utils';
import { cn } from '@repo/ui';
import { IconAtom, IconChevronRight, IconLoader2, IconSearch } from '@tabler/icons-react';
import { memo, useCallback, useEffect, useMemo } from 'react';
import { ActivityToolsDrawer } from './activity-tools-drawer';
import {
    buildActivityTimeline,
    isMultiAgentMode,
    latestSearchHint,
    researchActivityLabel,
    timelineTitleForTool,
    toolPairsFromThreadItem,
} from './tool-activity-utils';

function hasRecordedToolActivity(threadItem: ThreadItem): boolean {
    if (Object.keys(threadItem.toolCalls ?? {}).length > 0) return true;

    const primary = Object.values(threadItem.steps ?? {})[0] as Step | undefined;
    const sub = primary?.steps;
    return sub?.search?.status === 'PENDING' || sub?.search?.status === 'COMPLETED';
}

function collectSourcesFromSteps(steps: Step[]): Source[] {
    const read = steps[0]?.steps?.read?.data;
    if (!Array.isArray(read)) return [];
    return read
        .map((row, index) => sourceFromUnknownRow(row, index + 1))
        .filter((source): source is Source => source !== null);
}

export type AgentActivityCardProps = {
    steps: Step[];
    threadItem: ThreadItem;
};

export const AgentActivityCard = memo(({ steps, threadItem }: AgentActivityCardProps) => {
    const openSideDrawer = useAppStore(state => state.openSideDrawer);
    const updateSideDrawer = useAppStore(state => state.updateSideDrawer);
    const sideDrawerOpen = useAppStore(state => state.sideDrawer.open);
    const sideDrawerId = useAppStore(state => state.sideDrawer.id);

    const multiAgent = isMultiAgentMode(threadItem.mode);

    const isStopped = threadItem.status === 'ABORTED' || threadItem.status === 'ERROR';
    const isLoading =
        (steps.some(step => step.status === 'PENDING') || threadItem.status === 'PENDING') &&
        !isStopped;
    const hasAnswer =
        !!threadItem.answer?.text &&
        (threadItem.status === 'COMPLETED' ||
            threadItem.status === 'ABORTED' ||
            threadItem.status === 'ERROR');

    const hasTools = useMemo(() => hasRecordedToolActivity(threadItem), [threadItem]);

    const showCard = useMemo(() => {
        if (multiAgent) {
            return hasTools || (isLoading && !hasAnswer);
        }
        return hasTools;
    }, [hasAnswer, hasTools, isLoading, multiAgent]);

    const label = researchActivityLabel(threadItem.mode);
    const toolPairs = useMemo(() => toolPairsFromThreadItem(threadItem), [threadItem]);
    const sources = useMemo(() => collectSourcesFromSteps(steps), [steps]);
    const hint = useMemo(() => latestSearchHint(threadItem, steps), [threadItem, steps]);
    const timelineEvents = useMemo(
        () => buildActivityTimeline(threadItem, steps, sources),
        [threadItem, steps, sources]
    );

    const pendingTool = useMemo(
        () => [...toolPairs].reverse().find(p => !p.toolResult),
        [toolPairs]
    );

    const drawerContent = useCallback(
        () => (
            <ActivityToolsDrawer
                toolCalls={threadItem.toolCalls}
                toolResults={threadItem.toolResults}
                sources={sources}
                steps={steps}
            />
        ),
        [sources, steps, threadItem.toolCalls, threadItem.toolResults]
    );

    const openDrawer = useCallback(() => {
        openSideDrawer({
            id: 'research',
            title: () => <p className="text-sm font-medium">{label}</p>,
            badge: timelineEvents.length > 0 ? timelineEvents.length : undefined,
            renderContent: drawerContent,
        });
    }, [drawerContent, label, openSideDrawer, timelineEvents.length]);

    useEffect(() => {
        if (!sideDrawerOpen || sideDrawerId !== 'research') return;
        updateSideDrawer({
            badge: timelineEvents.length > 0 ? timelineEvents.length : undefined,
            renderContent: drawerContent,
        });
    }, [
        drawerContent,
        sideDrawerId,
        sideDrawerOpen,
        timelineEvents.length,
        updateSideDrawer,
    ]);

    if (!showCard) {
        return null;
    }

    if (multiAgent && !hasTools) {
        return (
            <div
                className={cn(
                    'text-muted-foreground flex min-h-10 w-full max-w-md items-center gap-2 px-2.5 py-1.5 text-sm'
                )}
                role="status"
                aria-live="polite"
            >
                {isLoading ? (
                    <IconLoader2 size={15} strokeWidth={2} className="shrink-0 animate-spin" />
                ) : (
                    <IconAtom size={15} strokeWidth={2} className="shrink-0 opacity-70" />
                )}
                <span className="min-w-0 flex-1 truncate">
                    {isLoading ? `${label}…` : label}
                </span>
            </div>
        );
    }

    const cardPrimary = isLoading
        ? pendingTool
            ? timelineTitleForTool(pendingTool.toolCall.toolName)
            : 'Searching'
        : sources.length > 0
          ? `${sources.length} ${sources.length === 1 ? 'result' : 'results'}`
          : 'Research';

    const cardSecondary =
        isLoading && hint
            ? hint
            : !isLoading && toolPairs.length > 0
              ? `${toolPairs.length} ${toolPairs.length === 1 ? 'step' : 'steps'}`
              : undefined;

    return (
        <button
            type="button"
            className={cn(
                'text-muted-foreground hover:text-foreground hover:bg-secondary/80 flex w-full max-w-md flex-col gap-0.5 rounded-lg px-2.5 py-2 text-left',
                'transition-colors active:scale-[0.98] motion-reduce:active:scale-100'
            )}
            onClick={openDrawer}
            aria-live="polite"
        >
            <span className="flex min-h-5 w-full items-center gap-2 text-sm">
                {isLoading ? (
                    <IconLoader2 size={15} strokeWidth={2} className="shrink-0 animate-spin" />
                ) : (
                    <IconSearch size={15} strokeWidth={2} className="shrink-0 opacity-70" />
                )}
                <span className="min-w-0 flex-1 truncate font-medium text-foreground/90">
                    {cardPrimary}
                </span>
                <IconChevronRight size={14} strokeWidth={2} className="shrink-0 opacity-50" />
            </span>
            {cardSecondary && (
                <span className="text-muted-foreground line-clamp-2 pl-[23px] text-xs leading-snug">
                    {cardSecondary}
                </span>
            )}
        </button>
    );
});
AgentActivityCard.displayName = 'AgentActivityCard';
