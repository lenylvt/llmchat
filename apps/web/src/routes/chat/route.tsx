import { ChatInput } from '@repo/common/components';
import { createFileRoute, Outlet } from '@tanstack/react-router';

export const Route = createFileRoute('/chat')({
    component: ChatLayout,
});

function ChatLayout() {
    return (
        <div className="relative flex h-full w-full flex-col">
            <Outlet />
            <ChatInput />
        </div>
    );
}
