import { describe, expect, test } from 'bun:test';
import { assertAllowedImagineMediaUrl, isAllowedImagineMediaUrl } from './media-url';

describe('assertAllowedImagineMediaUrl', () => {
    test('allows https public URLs', () => {
        expect(() =>
            assertAllowedImagineMediaUrl('https://example.com/image.png', 'test')
        ).not.toThrow();
    });

    test('allows data URLs', () => {
        expect(() =>
            assertAllowedImagineMediaUrl('data:image/png;base64,abc', 'test')
        ).not.toThrow();
    });

    test('blocks localhost', () => {
        expect(() => assertAllowedImagineMediaUrl('https://localhost/x', 'test')).toThrow();
        expect(isAllowedImagineMediaUrl('https://localhost/x')).toBe(false);
    });

    test('blocks non-https', () => {
        expect(() => assertAllowedImagineMediaUrl('http://example.com/x', 'test')).toThrow();
    });
});
