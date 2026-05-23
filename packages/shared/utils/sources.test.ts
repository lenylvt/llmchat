import { describe, expect, test } from 'bun:test';
import { mergeQueryStrings, sourcesFromXaiRecord } from './sources';

describe('sourcesFromXaiRecord', () => {
    test('reads action.sources', () => {
        const sources = sourcesFromXaiRecord({
            action: {
                sources: [{ url: 'https://example.com', title: 'Example' }],
            },
        });
        expect(sources).toHaveLength(1);
        expect(sources[0]?.link).toBe('https://example.com');
    });

    test('reads top-level sources', () => {
        const sources = sourcesFromXaiRecord({
            sources: [{ link: 'https://x.ai/news', title: 'News' }],
        });
        expect(sources[0]?.link).toBe('https://x.ai/news');
    });
});

describe('mergeQueryStrings', () => {
    test('deduplicates queries', () => {
        expect(mergeQueryStrings(['foo'], ['foo', 'bar'])).toEqual(['foo', 'bar']);
    });
});
