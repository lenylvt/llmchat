import type { Source } from '@repo/shared/types';
import {
    extractCitationUrlsFromText,
    mergeSourcesByIndex,
    type CitationUrlMap,
} from '@repo/shared/utils';
import { getHost, isValidUrl } from '@repo/shared/utils';

function urlsToSources(citationUrls: CitationUrlMap): Source[] {
    return Object.entries(citationUrls)
        .map(([indexKey, link]) => {
            const index = Number.parseInt(indexKey, 10);
            if (Number.isNaN(index) || !isValidUrl(link)) return null;
            return {
                index,
                link,
                title: getHost(link) || link,
            } satisfies Source;
        })
        .filter((source): source is Source => source !== null)
        .sort((a, b) => a.index - b.index);
}

export function sourcesFromAnswerText(text: string): Source[] {
    const { citationUrls } = extractCitationUrlsFromText(text);
    return urlsToSources(citationUrls);
}

function sourcesFromAnnotations(response: Record<string, unknown>): Source[] {
    const map = new Map<number, Source>();
    const output = response.output;
    if (!Array.isArray(output)) return [];

    for (const item of output) {
        if (!item || typeof item !== 'object') continue;
        const row = item as Record<string, unknown>;
        if (row.type !== 'message') continue;

        const content = row.content;
        if (!Array.isArray(content)) continue;

        for (const block of content) {
            if (!block || typeof block !== 'object') continue;
            const textBlock = block as Record<string, unknown>;
            if (textBlock.type !== 'output_text') continue;

            const annotations = textBlock.annotations;
            if (!Array.isArray(annotations)) continue;

            for (const annotation of annotations) {
                if (!annotation || typeof annotation !== 'object') continue;
                const ann = annotation as Record<string, unknown>;
                if (ann.type !== 'url_citation') continue;

                const url = typeof ann.url === 'string' ? ann.url : '';
                if (!url || !isValidUrl(url)) continue;

                const titleField = ann.title;
                const index =
                    typeof titleField === 'string' || typeof titleField === 'number'
                        ? Number.parseInt(String(titleField), 10)
                        : map.size + 1;

                if (Number.isNaN(index) || index < 1) continue;

                map.set(index, {
                    index,
                    link: url,
                    title: getHost(url) || url,
                });
            }
        }
    }

    return [...map.values()];
}

/** Extract numbered sources from an xAI Responses API payload. */
export function sourcesFromXaiResponse(
    response: Record<string, unknown>,
    answerText?: string
): Source[] {
    const lists: Source[][] = [sourcesFromAnnotations(response)];

    const text =
        answerText ??
        (typeof response.output_text === 'string' ? response.output_text : undefined);

    if (typeof text === 'string' && text.length > 0) {
        lists.push(sourcesFromAnswerText(text));
    }

    const merged = mergeSourcesByIndex(...lists);

    if (merged.length === 0 && Array.isArray(response.citations)) {
        const fromList: Source[] = [];
        response.citations.forEach((entry, i) => {
            if (typeof entry === 'string' && isValidUrl(entry)) {
                fromList.push({
                    index: i + 1,
                    link: entry,
                    title: getHost(entry) || entry,
                });
            }
        });
        return fromList;
    }

    return merged;
}

export { mergeSourcesByIndex as mergeSources };
