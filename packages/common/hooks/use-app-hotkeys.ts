'use client';

import { useRootContext } from '@repo/common/context';
import { useChatStore } from '@repo/common/store';
import { useNavigate, useRouterState } from '@tanstack/react-router';
import { useEffect } from 'react';

function isTypingTarget(target: EventTarget | null) {
    if (!(target instanceof HTMLElement)) return false;
    if (target.isContentEditable) return true;
    const tag = target.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

export function useAppHotkeys() {
    const { setIsCommandSearchOpen, setIsMobileSidebarOpen } = useRootContext();
    const startNewChat = useChatStore(state => state.startNewChat);
    const navigate = useNavigate();
    const isChatPage = useRouterState({
        select: s => s.location.pathname.startsWith('/chat'),
    });

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            const mod = e.metaKey || e.ctrlKey;
            if (!mod) return;

            if (e.key.toLowerCase() === 'k') {
                e.preventDefault();
                setIsCommandSearchOpen(true);
                return;
            }

            if (e.key.toLowerCase() === 'n' && !e.shiftKey && !isTypingTarget(e.target)) {
                e.preventDefault();
                startNewChat();
                if (isChatPage) {
                    navigate({ to: '/chat', replace: true });
                } else {
                    navigate({ to: '/chat' });
                }
                setIsMobileSidebarOpen(false);
            }
        };

        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [
        isChatPage,
        navigate,
        setIsCommandSearchOpen,
        setIsMobileSidebarOpen,
        startNewChat,
    ]);
}
