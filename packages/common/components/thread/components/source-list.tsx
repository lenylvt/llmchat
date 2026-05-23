import { LinkFavicon } from '@repo/common/components';
import { Source } from '@repo/shared/types';
import { getHost, isValidUrl } from '@repo/shared/utils';
import { cn } from '@repo/ui';

function sourceDisplayName(source: Source) {
    const host = getHost(source.link);
    if (source.title && source.title !== source.link && source.title !== host) {
        return source.title;
    }
    return host ?? source.link;
}

export const SourceList = ({ sources }: { sources: Source[] }) => {
    if (!sources || !Array.isArray(sources) || sources?.length === 0) {
        return null;
    }

    const sortedSources = [...sources]
        .filter(s => s?.link && isValidUrl(s.link))
        .sort((a, b) => a?.index - b?.index);

    return (
        <div className="flex min-h-full flex-col gap-3 py-3 pl-2 pr-4">
            {sortedSources.map(source => {
                const host = getHost(source.link);
                const name = sourceDisplayName(source);

                return (
                    <a
                        key={`${source.index}-${source.link}`}
                        href={source.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn(
                            'bg-quaternary/40 hover:bg-quaternary/80 flex w-full flex-col gap-2 rounded-lg border border-transparent p-3',
                            'transition-colors'
                        )}
                    >
                        <div className="flex w-full flex-row items-start gap-3">
                            <span className="bg-brand/15 text-brand inline-flex size-5 shrink-0 items-center justify-center rounded-md text-[10px] font-semibold">
                                {source.index}
                            </span>
                            <div className="min-w-0 flex-1">
                                <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                                    <LinkFavicon link={source.link} size="sm" />
                                    <span className="truncate">{host}</span>
                                </p>
                                <p className="text-foreground mt-1 line-clamp-2 text-sm font-medium leading-snug">
                                    {name}
                                </p>
                                {source.snippet ? (
                                    <p className="text-muted-foreground mt-1.5 line-clamp-3 text-xs leading-relaxed">
                                        {source.snippet}
                                    </p>
                                ) : null}
                            </div>
                        </div>
                    </a>
                );
            })}
        </div>
    );
};
