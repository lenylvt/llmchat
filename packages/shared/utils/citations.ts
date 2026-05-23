import type { Source } from '../types';
import { isValidUrl } from './utils';

export type CitationUrlMap = Record<number, string>;

export type PreparedAnswerContent = {
    markdown: string;
    citationUrls: CitationUrlMap;
    citedIndices: number[];
};

/** xAI inline: `[[1]](https://...)` */
const CITATION_XAI = /\[\[(\d+)\]\]\s*\((https?:\/\/[^)\s]+)\)/gi;

/** Legacy / single-bracket: `[1](https://...)` */
const CITATION_URL =
    /\[(\d+)\]\s*[(（]\s*(?!#citation-)(https?:\/\/[^)\s\\）]+)\s*[)）]/gi;

const CITATION_INTERNAL =
    /\[(\d+)\]\(#citation-\1\)(?:\s*[(（]?\s*(https?:\/\/[^)\s\\）]+)\s*[)）]?)?/gi;

const CITATION_INTERNAL_BROKEN = /(?<!\[)(\d+)\]\(#citation-(\d+)\)/gi;
const CITATION_PERIOD_BROKEN = /\.(\d+)\]\(#citation-(\d+)\)/gi;
const CITATION_SOURCE_TAG = /<Source>\s*(\d+)\s*<\/Source>/gi;
const CITATION_MULTI = /\[(\d+(?:,\s*\d+)+)\](?!\s*[(（])/g;
const CITATION_BARE = /\[(\d+)\](?!\s*[(（])/g;
const ORPHAN_URL_TAIL = /\]\s*[(（]\s*(https?:\/\/[^)\s\\）]+)\s*[)）]/gi;

/** Extract citation index → URL from raw answer text (no mutation). */
export function extractCitationUrlsFromText(text: string): {
    citationUrls: CitationUrlMap;
    citedIndices: number[];
} {
    const citationUrls: CitationUrlMap = {};
    const citedIndices = new Set<number>();

    const note = (index: string, url?: string) => {
        const n = Number.parseInt(index, 10);
        if (Number.isNaN(n)) return;
        citedIndices.add(n);
        if (url && isValidUrl(url)) {
            citationUrls[n] = url;
        }
    };

    for (const pattern of [CITATION_XAI, CITATION_URL]) {
        pattern.lastIndex = 0;
        for (const match of text.matchAll(pattern)) {
            note(match[1], match[2]);
        }
    }

    CITATION_INTERNAL.lastIndex = 0;
    for (const match of text.matchAll(CITATION_INTERNAL)) {
        note(match[1], match[2]);
    }

    return {
        citationUrls,
        citedIndices: [...citedIndices].sort((a, b) => a - b),
    };
}

function stripIncompleteCitationTail(markdown: string, isStreaming?: boolean) {
    if (!isStreaming) return markdown;
    return markdown
        .replace(/\[\[\d*$/g, '')
        .replace(/\[\[$/g, '')
        .replace(/\[\d*$/g, '')
        .replace(/\[$/g, '')
        .replace(/(?<!\[)\d*\]\(#citation-\d*$/g, '');
}

function collapseHorizontalWhitespace(markdown: string) {
    return markdown
        .split('\n')
        .map(line => line.replace(/[ \t]{2,}/g, ' ').trimEnd())
        .join('\n');
}

/** Only fix headings/lists glued after sentence punctuation (not arbitrary `#` in prose). */
function normalizeMarkdownBlocks(markdown: string) {
    return markdown
        .replace(/([.!?…])\s+(#{1,6}\s)/g, '$1\n\n$2')
        .replace(/([.!?…])\s+([-*]\s+)/g, '$1\n\n$2');
}

function tidyProseAfterCitationStrip(markdown: string) {
    return normalizeMarkdownBlocks(
        collapseHorizontalWhitespace(
            markdown
                .replace(/[ \t]+\./g, '.')
                .replace(/[ \t]+([,;:!?])/g, '$1')
                .replace(/\n{3,}/g, '\n\n')
        )
    ).trim();
}

/**
 * Strip inline citation markers for display, collect URLs/indices, preserve markdown structure.
 */
export function prepareAnswerContent(
    markdown: string,
    options?: { isStreaming?: boolean }
): PreparedAnswerContent {
    const citationUrls: CitationUrlMap = {};
    const citedIndices = new Set<number>();
    let result = markdown;

    const note = (index: string, url?: string) => {
        const n = Number.parseInt(index, 10);
        if (!Number.isNaN(n)) {
            citedIndices.add(n);
            if (url && isValidUrl(url)) {
                citationUrls[n] = url;
            }
        }
    };

    const strip = (index: string, url?: string) => {
        note(index, url);
        return '';
    };

    result = result.replace(CITATION_SOURCE_TAG, (_match, index) => strip(index));

    result = result.replace(CITATION_XAI, (_match, index, url) => strip(index, url));

    result = result.replace(CITATION_INTERNAL, (_match, index, url) => strip(index, url));

    result = result.replace(CITATION_PERIOD_BROKEN, (_match, _n, index) => {
        strip(index);
        return '.';
    });

    result = result.replace(CITATION_INTERNAL_BROKEN, (_match, _n, index) => strip(index));

    result = result.replace(CITATION_URL, (_match, index, url) => strip(index, url));

    result = result.replace(CITATION_MULTI, match => {
        const numbers = match.match(/\d+/g) || [];
        return numbers.map(num => strip(num)).join('');
    });

    if (!options?.isStreaming) {
        result = result.replace(CITATION_BARE, (_match, index) => strip(index));
    }

    result = result.replace(ORPHAN_URL_TAIL, '');
    result = tidyProseAfterCitationStrip(stripIncompleteCitationTail(result, options?.isStreaming));

    return {
        markdown: result,
        citationUrls,
        citedIndices: [...citedIndices].sort((a, b) => a - b),
    };
}

export function mergeSourcesByIndex(...lists: Source[][]): Source[] {
    const map = new Map<number, Source>();
    for (const list of lists) {
        for (const source of list) {
            if (source?.link && isValidUrl(source.link)) {
                map.set(source.index, source);
            }
        }
    }
    return [...map.values()].sort((a, b) => a.index - b.index);
}
