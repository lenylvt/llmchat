'use client';

import { LinkFavicon } from '@repo/common/components';
import { useAppStore } from '@repo/common/store';
import { Source } from '@repo/shared/types';
import { getHost, isValidUrl } from '@repo/shared/utils';
import { cn } from '@repo/ui';
import { SourceList } from './source-list';

const INLINE_PREVIEW_COUNT = 5;

type CitationFooterProps = {
    sources: Source[];
    className?: string;
};

function sourceLabel(source: Source) {
    if (source.title && source.title !== source.link) {
        const host = getHost(source.link);
        if (host && source.title.toLowerCase().includes(host.toLowerCase())) {
            return host;
        }
        if (source.title && source.title.length <= 48) return source.title;
    }
    return getHost(source.link) ?? source.link;
}

function CitationChip({ source }: { source: Source }) {
    const label = sourceLabel(source);

    return (
        <a
            href={source.link}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
                'bg-quaternary/70 hover:bg-quaternary inline-flex max-w-[11rem] items-center gap-1 rounded-full py-0.5 pl-0.5 pr-2',
                'text-muted-foreground hover:text-foreground transition-colors'
            )}
            title={source.snippet || source.title || source.link}
        >
            <LinkFavicon link={source.link} size="sm" className="size-4 shrink-0 rounded-full" />
            <span className="truncate text-[10px] font-medium leading-none">{label}</span>
        </a>
    );
}

export function CitationFooter({ sources = [], className }: CitationFooterProps) {
    const openSideDrawer = useAppStore(state => state.openSideDrawer);

    const linked = (sources ?? []).filter(s => s?.link && isValidUrl(s.link));
    if (linked.length === 0) return null;

    const sorted = [...linked].sort((a, b) => a.index - b.index);
    const preview = sorted.slice(0, INLINE_PREVIEW_COUNT);
    const remaining = sorted.length - preview.length;

    return (
        <div className={cn('flex flex-wrap items-center gap-1.5 pt-2', className)}>
            {preview.map(source => (
                <CitationChip key={`${source.index}-${source.link}`} source={source} />
            ))}
            {remaining > 0 && (
                <button
                    type="button"
                    onClick={() => {
                        openSideDrawer({
                            title: 'Sources',
                            badge: sorted.length,
                            renderContent: () => <SourceList sources={sorted} />,
                        });
                    }}
                    className="text-muted-foreground hover:text-foreground bg-quaternary/50 hover:bg-quaternary inline-flex items-center rounded-full px-2 py-1 text-[10px] font-medium transition-colors"
                >
                    +{remaining} source{remaining > 1 ? 's' : ''}
                </button>
            )}
            {remaining === 0 && sorted.length > 1 && (
                <button
                    type="button"
                    onClick={() => {
                        openSideDrawer({
                            title: 'Sources',
                            badge: sorted.length,
                            renderContent: () => <SourceList sources={sorted} />,
                        });
                    }}
                    className="text-muted-foreground hover:text-foreground text-[10px] font-medium underline-offset-2 hover:underline"
                >
                    Voir tout
                </button>
            )}
        </div>
    );
}
