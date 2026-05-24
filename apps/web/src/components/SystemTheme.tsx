'use client';

import { useEffect } from 'react';

function applySystemTheme() {
    document.documentElement.classList.toggle(
        'dark',
        window.matchMedia('(prefers-color-scheme: dark)').matches
    );
}

/** Syncs Tailwind `dark` class with the OS / browser color scheme. */
export function SystemTheme() {
    useEffect(() => {
        applySystemTheme();
        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        const onChange = () => applySystemTheme();
        mq.addEventListener('change', onChange);
        return () => mq.removeEventListener('change', onChange);
    }, []);

    return null;
}
