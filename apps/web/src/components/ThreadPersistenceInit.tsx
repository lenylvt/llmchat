import { useChatStore } from '@repo/common/store';
import { useSession } from '@repo/common/lib/auth-client';
import { registerAppThreadPersistence } from '../lib/register-thread-persistence';
import { unregisterThreadPersistence } from '@repo/common/store/thread-persistence';
import { ClientOnly } from '@tanstack/react-router';
import { useEffect } from 'react';

function ThreadPersistenceInitInner() {
    const { data: session } = useSession();
    const loadThreads = useChatStore(s => s.loadThreads);
    const clearAllThreads = useChatStore(s => s.clearAllThreads);

    useEffect(() => {
        if (session?.user) {
            registerAppThreadPersistence();
            void loadThreads();
            return;
        }

        unregisterThreadPersistence();
        clearAllThreads();
    }, [session?.user?.id, loadThreads, clearAllThreads]);

    return null;
}

export function ThreadPersistenceInit() {
    return (
        <ClientOnly fallback={null}>
            <ThreadPersistenceInitInner />
        </ClientOnly>
    );
}
