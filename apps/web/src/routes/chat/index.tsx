import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/chat/')({
    component: ChatIndexPage,
});

function ChatIndexPage() {
    return (
        <div className="flex h-full flex-1 flex-col items-center justify-center p-4">
            <p className="text-muted-foreground text-sm">Start a new conversation</p>
        </div>
    );
}
