'use client';
import { HistoryItem } from '@repo/common/components';
import { useRootContext } from '@repo/common/context';
import { useSession, signOut } from '../../lib/auth-client';
import { Thread, useChatStore } from '@repo/common/store';
import { Button, Kbd, cn } from '@repo/ui';
import {
    IconArrowBarLeft,
    IconArrowBarRight,
    IconChevronDown,
    IconPlus,
    IconSearch,
} from '@tabler/icons-react';
import { useNavigate, useParams, useRouterState } from '@tanstack/react-router';
import moment from 'moment';

export const Sidebar = () => {
    const { threadId: currentThreadId } = useParams({ strict: false });
    const pathname = useRouterState({ select: s => s.location.pathname });
    const { isSidebarOpen, setIsSidebarOpen, setIsCommandSearchOpen, setIsMobileSidebarOpen } =
        useRootContext();
    const navigate = useNavigate();
    const isChatPage = pathname.startsWith('/chat');
    const threads = useChatStore(state => state.threads);
    const startNewChat = useChatStore(state => state.startNewChat);
    const { data: session } = useSession();

    const sortThreads = (list: Thread[]) =>
        [...list].sort((a, b) => moment(b.createdAt).diff(moment(a.createdAt)));

    const groupedThreads: Record<string, Thread[]> = {
        today: [],
        yesterday: [],
        last7Days: [],
        last30Days: [],
        previousMonths: [],
    };

    sortThreads(threads)?.forEach(thread => {
        const createdAt = moment(thread.createdAt);
        const now = moment();
        if (createdAt.isSame(now, 'day')) groupedThreads.today.push(thread);
        else if (createdAt.isSame(now.clone().subtract(1, 'day'), 'day'))
            groupedThreads.yesterday.push(thread);
        else if (createdAt.isAfter(now.clone().subtract(7, 'days')))
            groupedThreads.last7Days.push(thread);
        else if (createdAt.isAfter(now.clone().subtract(30, 'days')))
            groupedThreads.last30Days.push(thread);
        else groupedThreads.previousMonths.push(thread);
    });

    const renderGroup = (title: string, groupThreads: Thread[]) => {
        if (groupThreads.length === 0) return null;
        return (
            <div className="flex w-full flex-col gap-2">
                <p className="text-muted-foreground px-2 text-xs">{title}</p>
                <div className="flex w-full flex-col gap-1">
                    {groupThreads.map(thread => (
                        <HistoryItem
                            thread={thread}
                            key={thread.id}
                            dismiss={() => setIsMobileSidebarOpen(false)}
                            isActive={thread.id === currentThreadId}
                        />
                    ))}
                </div>
            </div>
        );
    };

    const handleNewChat = () => {
        startNewChat();
        if (!isChatPage) {
            navigate({ to: '/chat' });
        } else {
            navigate({ to: '/chat', replace: true });
        }
        setIsMobileSidebarOpen(false);
    };

    return (
        <div
            className={cn(
                'relative bottom-0 left-0 top-0 z-[50] flex h-[100dvh] flex-shrink-0 flex-col py-2 transition-[width,box-shadow] duration-200',
                isSidebarOpen
                    ? 'shadow-xs top-0 h-full w-[230px] bg-[#f4f4f4]'
                    : 'w-[50px] bg-[#f4f4f4]'
            )}
        >
            <div className="flex w-full flex-1 flex-col overflow-hidden">
                <div
                    className={cn(
                        'mb-3 flex h-8 items-center px-3',
                        isSidebarOpen ? 'justify-between' : 'justify-center'
                    )}
                >
                    {isSidebarOpen && (
                        <div className="flex min-w-0 items-center gap-2">
                            <div className="flex size-5 shrink-0 items-center justify-center rounded-md bg-[#ff6b3d] text-[11px] font-semibold text-white">
                                ✱
                            </div>
                            <span className="truncate text-sm font-semibold text-[#222]">
                                Groot
                            </span>
                        </div>
                    )}
                    <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => setIsSidebarOpen(prev => !prev)}
                        className="text-muted-foreground"
                        tooltip={isSidebarOpen ? 'Close Sidebar' : 'Open Sidebar'}
                        tooltipSide={isSidebarOpen ? 'bottom' : 'right'}
                    >
                        {isSidebarOpen ? (
                            <IconArrowBarLeft size={16} strokeWidth={2} />
                        ) : (
                            <IconArrowBarRight size={16} strokeWidth={2} />
                        )}
                    </Button>
                </div>

                <div
                    className={cn(
                        'flex w-full gap-2 px-2',
                        isSidebarOpen ? 'flex-row items-center' : 'flex-col'
                    )}
                >
                    <Button
                        size={isSidebarOpen ? 'sm' : 'icon'}
                        variant="secondary"
                        tooltip={isSidebarOpen ? undefined : 'New Chat (⌘N)'}
                        tooltipSide="right"
                        className={cn(
                            'border-border/80 bg-background hover:bg-background h-9 min-w-0 rounded-lg border shadow-sm',
                            isSidebarOpen
                                ? 'flex-1 justify-start px-3'
                                : 'w-full justify-center px-0'
                        )}
                        onClick={handleNewChat}
                    >
                        <IconPlus
                            size={16}
                            strokeWidth={2}
                            className={cn(isSidebarOpen && 'mr-1 shrink-0')}
                        />
                        {isSidebarOpen && (
                            <>
                                <span className="text-sm">New</span>
                                <span className="ml-auto flex items-center gap-1">
                                    <Kbd className="h-5 min-w-5 px-1 text-[10px]">⌘</Kbd>
                                    <Kbd className="h-5 min-w-5 px-1 text-[10px]">N</Kbd>
                                </span>
                            </>
                        )}
                    </Button>
                    <Button
                        size="icon"
                        variant="secondary"
                        tooltip="Search (⌘K)"
                        tooltipSide="right"
                        className="border-border/80 bg-background hover:bg-background h-9 w-9 shrink-0 rounded-lg border shadow-sm"
                        onClick={() => setIsCommandSearchOpen(true)}
                    >
                        <IconSearch size={16} strokeWidth={2} />
                    </Button>
                </div>

                <div
                    className={cn(
                        'border-border/70 no-scrollbar mt-3 w-full flex-1 overflow-y-auto border-t border-dashed px-3 py-5',
                        isSidebarOpen ? 'flex flex-col gap-5' : 'hidden'
                    )}
                >
                    <div className="flex flex-col gap-5">
                        {renderGroup('Today', groupedThreads.today)}
                        {renderGroup('Yesterday', groupedThreads.yesterday)}
                        {renderGroup('Last 7 Days', groupedThreads.last7Days)}
                        {renderGroup('Last 30 Days', groupedThreads.last30Days)}
                        {renderGroup('Previous Months', groupedThreads.previousMonths)}
                    </div>
                </div>

                <div className="mt-auto w-full p-2">
                    <div
                        className={cn(
                            'border-border/80 bg-background flex h-10 items-center gap-2 rounded-lg border px-2 shadow-sm',
                            !isSidebarOpen && 'justify-center px-0'
                        )}
                    >
                        <div className="bg-muted border-border flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium">
                            {session?.user?.email?.[0]?.toUpperCase() ?? '?'}
                        </div>
                        {isSidebarOpen && (
                            <>
                                <span className="min-w-0 flex-1 truncate text-sm text-[#222]">
                                    {session?.user?.name || session?.user?.email || 'Account'}
                                </span>
                                <button
                                    type="button"
                                    className="text-muted-foreground hover:text-foreground rounded p-1"
                                    onClick={() =>
                                        signOut({
                                            fetchOptions: {
                                                onSuccess: () => navigate({ to: '/sign-in' }),
                                            },
                                        })
                                    }
                                    title="Sign out"
                                >
                                    <IconChevronDown size={14} strokeWidth={2} />
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
