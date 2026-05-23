import { describe, expect, test } from 'bun:test';
import { stableToolCallIdFromChunk } from './activity-stream';

describe('stableToolCallIdFromChunk', () => {
    test('prefers id over call_id', () => {
        expect(stableToolCallIdFromChunk({ id: 'a', call_id: 'b' })).toBe('a');
    });

    test('uses call_id when id missing', () => {
        expect(stableToolCallIdFromChunk({ call_id: 'call-1' })).toBe('call-1');
    });

    test('returns null without stable id', () => {
        expect(stableToolCallIdFromChunk({ index: 0 })).toBeNull();
    });
});
