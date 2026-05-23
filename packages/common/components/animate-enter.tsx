'use client';

import { cn } from '@repo/ui';
import type { CSSProperties, ReactNode } from 'react';

type AnimateEnterProps = {
    stagger: number;
    /** Multiplier per stagger step (skill default: 100ms sections, 80ms words) */
    delayMs?: number;
    className?: string;
    children: ReactNode;
};

export function AnimateEnter({
    stagger,
    delayMs = 100,
    className,
    children,
}: AnimateEnterProps) {
    return (
        <div
            className={cn('animate-enter', className)}
            style={
                {
                    '--stagger': stagger,
                    '--delay': `${delayMs}ms`,
                } as CSSProperties
            }
        >
            {children}
        </div>
    );
}

type AnimateEnterWordsProps = {
    text: string;
    /** Stagger index of the first word */
    staggerStart?: number;
    className?: string;
    wordClassName?: string;
};

/** Title-style enter: one span per word, 80ms between each. */
export function AnimateEnterWords({
    text,
    staggerStart = 1,
    className,
    wordClassName,
}: AnimateEnterWordsProps) {
    const words = text.trim().split(/\s+/).filter(Boolean);

    return (
        <span className={className}>
            {words.map((word, index) => (
                <span
                    key={`${word}-${index}`}
                    className={cn('animate-enter animate-enter-individual inline', wordClassName)}
                    style={
                        {
                            '--stagger': staggerStart + index,
                            '--delay': '80ms',
                        } as CSSProperties
                    }
                >
                    {word}
                    {index < words.length - 1 ? ' ' : null}
                </span>
            ))}
        </span>
    );
}
