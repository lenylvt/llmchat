'use client';
import { createContext, useCallback, useContext, useState } from 'react';

const SIDEBAR_OPEN_STORAGE_KEY = 'groot.sidebarOpen';

function readStoredSidebarOpen(): boolean {
    if (typeof window === 'undefined') return true;
    try {
        const stored = localStorage.getItem(SIDEBAR_OPEN_STORAGE_KEY);
        if (stored === 'false') return false;
        if (stored === 'true') return true;
    } catch {
        // ignore quota / private mode
    }
    return true;
}

export type RootContextType = {
    isSidebarOpen: boolean;
    setIsSidebarOpen: (value: boolean | ((prev: boolean) => boolean)) => void;
    isCommandSearchOpen: boolean;
    setIsCommandSearchOpen: (isCommandSearchOpen: boolean) => void;
    isMobileSidebarOpen: boolean;
    setIsMobileSidebarOpen: (isMobileSidebarOpen: boolean) => void;
};

export const RootContext = createContext<RootContextType | null>(null);

export const RootProvider = ({ children }: { children: React.ReactNode }) => {
    const [isSidebarOpen, setIsSidebarOpenState] = useState(() => readStoredSidebarOpen());
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
    const [isCommandSearchOpen, setIsCommandSearchOpen] = useState(false);

    const setIsSidebarOpen = useCallback((value: boolean | ((prev: boolean) => boolean)) => {
        setIsSidebarOpenState(prev => {
            const next = typeof value === 'function' ? value(prev) : value;
            try {
                localStorage.setItem(SIDEBAR_OPEN_STORAGE_KEY, String(next));
            } catch {
                // ignore
            }
            return next;
        });
    }, []);

    return (
        <RootContext.Provider
            value={{
                isSidebarOpen,
                setIsSidebarOpen,
                isCommandSearchOpen,
                setIsCommandSearchOpen,
                isMobileSidebarOpen,
                setIsMobileSidebarOpen,
            }}
        >
            {children}
        </RootContext.Provider>
    );
};

export const useRootContext = () => {
    const context = useContext(RootContext);
    if (!context) {
        throw new Error('useRootContext must be used within a RootProvider');
    }
    return context;
};
