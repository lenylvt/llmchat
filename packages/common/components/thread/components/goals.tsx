import { Step, ThreadItem } from '@repo/shared/types';
import { AgentActivityCard } from './agent-activity-card';

/** Thread activity card + side drawer (steps, tools, multi-agent). */
export const Steps = ({ steps, threadItem }: { steps: Step[]; threadItem: ThreadItem }) => (
    <AgentActivityCard steps={steps} threadItem={threadItem} />
);
