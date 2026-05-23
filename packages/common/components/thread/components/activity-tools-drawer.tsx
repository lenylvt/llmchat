import type { Source, Step, ToolCall, ToolResult } from '@repo/shared/types';
import { memo, useMemo } from 'react';
import { ActivityTimeline } from './activity-timeline';
import { buildActivityTimeline } from './tool-activity-utils';

type ActivityToolsDrawerProps = {
    toolCalls?: Record<string, ToolCall>;
    toolResults?: Record<string, ToolResult>;
    sources?: Source[];
    steps?: Step[];
};

export const ActivityToolsDrawer = memo(
    ({ toolCalls, toolResults, sources, steps }: ActivityToolsDrawerProps) => {
        const events = useMemo(
            () =>
                buildActivityTimeline(
                    { toolCalls, toolResults },
                    steps ?? [],
                    sources ?? []
                ),
            [toolCalls, toolResults, sources, steps]
        );

        return <ActivityTimeline events={events} />;
    }
);
ActivityToolsDrawer.displayName = 'ActivityToolsDrawer';
