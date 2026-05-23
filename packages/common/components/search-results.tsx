'use client';
import { LinkFavicon, LinkPreviewPopover } from '@repo/common/components';
import { Source } from '@repo/shared/types';
import { getHost, getHostname, sourceFromUnknownRow } from '@repo/shared/utils';
import { Badge, Flex } from '@repo/ui';

export type SearchResultsType = {
    sources: Source[];
};

export const SearchResultsList = ({ sources }: SearchResultsType) => {
    if (!Array.isArray(sources)) {
        return null;
    }

    const normalized = sources
        .map((row, index) => sourceFromUnknownRow(row, index + 1))
        .filter((source): source is Source => source !== null);

    if (normalized.length === 0) {
        return null;
    }

    return (
        <Flex direction="col" gap="md" className="w-full">
            {Array.isArray(sources) && (
                <Flex gap="xs" className="mb-4 w-full flex-wrap overflow-x-hidden" items="stretch">
                    {normalized.map((source, index) => (
                        <LinkPreviewPopover source={source} key={`source-${source.link}-${index}`}>
                            <Badge
                                size="md"
                                variant="default"
                                onClick={() => {
                                    window?.open(source?.link, '_blank');
                                }}
                            >
                                <LinkFavicon link={getHost(source.link)} />
                                {getHostname(source.link)}
                            </Badge>
                        </LinkPreviewPopover>
                    ))}
                </Flex>
            )}
        </Flex>
    );
};
