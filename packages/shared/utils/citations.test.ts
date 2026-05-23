import { describe, expect, test } from 'bun:test';
import { extractCitationUrlsFromText, prepareAnswerContent } from './citations';

describe('prepareAnswerContent', () => {
    test('strips xAI [[n]](url) and records URL', () => {
        const { markdown, citationUrls, citedIndices } = prepareAnswerContent(
            'Hello [[1]](https://x.ai/news) world.'
        );
        expect(markdown).toBe('Hello world.');
        expect(citationUrls[1]).toBe('https://x.ai/news');
        expect(citedIndices).toEqual([1]);
    });

    test('fixes heading glued after punctuation', () => {
        const { markdown } = prepareAnswerContent(
            "C'est passionnant! ### Actualités IA\n\nOpenAI annonce."
        );
        expect(markdown).toContain("C'est passionnant!\n\n### Actualités IA");
    });

    test('strips mangled 1](#citation-1)', () => {
        const { markdown, citedIndices } = prepareAnswerContent('Anthropic.1](#citation-1)');
        expect(markdown).toBe('Anthropic.');
        expect(citedIndices).toEqual([1]);
    });

    test('returns empty citedIndices for empty input', () => {
        const result = prepareAnswerContent('');
        expect(result.citedIndices).toEqual([]);
        expect(result.markdown).toBe('');
    });

    test('preserves newlines between paragraphs', () => {
        const { markdown } = prepareAnswerContent('Line one.\n\nLine two.\n\n### Title');
        expect(markdown).toContain('\n\nLine two.');
        expect(markdown).toContain('\n\n### Title');
    });
});

describe('extractCitationUrlsFromText', () => {
    test('reads URLs without mutating text', () => {
        const text = 'See [[2]](https://example.com/page)';
        const { citationUrls, citedIndices } = extractCitationUrlsFromText(text);
        expect(text).toContain('[[2]]');
        expect(citationUrls[2]).toBe('https://example.com/page');
        expect(citedIndices).toEqual([2]);
    });
});
