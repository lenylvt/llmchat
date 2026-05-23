import { RecentThreads } from '@repo/common/components';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/recent/')({
    component: RecentPage,
});

function RecentPage() {
    return (
        <div className="flex h-full flex-1 flex-col overflow-y-auto p-8">
            <RecentThreads />
        </div>
    );
}
