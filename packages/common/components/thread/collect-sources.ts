import { Source, ThreadItem } from '@repo/shared/types';
import {
    extractCitationUrlsFromText,
    mergeSourcesByIndex,
    sourceFromUnknownRow,
} from '@repo/shared/utils';
import { getHost, isValidUrl } from '@repo/shared/utils';

function sourcesFromCitationUrls(citationUrls: Record<number, string>): Source[] {
    return Object.entries(citationUrls)
        .map(([indexKey, link]) => {
            const index = Number.parseInt(indexKey, 10);
            if (Number.isNaN(index) || !isValidUrl(link)) return null;
            return {
                index,
                link,
                title: getHost(link) ?? link,
            } satisfies Source;
        })
        .filter((source): source is Source => source !== null);
}

/** Merge persisted sources, web-search step results, and inline citations from the answer. */
export function collectSourcesFromThreadItem(threadItem: ThreadItem): Source[] {
    const lists: Source[][] = [];

    const persisted = (threadItem.sources ?? []).filter(
        (source): source is Source => !!source?.link && isValidUrl(source.link)
    );
    if (persisted.length > 0) {
        lists.push(persisted);
    }

    const fromSteps: Source[] = [];
    for (const step of Object.values(threadItem.steps ?? {})) {
        const data = step.steps?.read?.data;
        if (!Array.isArray(data)) continue;

        data.forEach((row, i) => {
            if (!row || typeof row !== 'object') return;
            const source = sourceFromUnknownRow(row, i + 1);
            if (source && isValidUrl(source.link)) fromSteps.push(source);
        });
    }
    if (fromSteps.length > 0) {
        lists.push(fromSteps);
    }

    const answerText = threadItem.answer?.text ?? '';
    if (answerText.length > 0) {
        const { citationUrls } = extractCitationUrlsFromText(answerText);
        const fromText = sourcesFromCitationUrls(citationUrls);
        if (fromText.length > 0) {
            lists.push(fromText);
        }
    }

    return mergeSourcesByIndex(...lists);
}
