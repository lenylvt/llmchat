import { describe, expect, test } from 'bun:test';
import {
    applyArtifactToolAction,
    extractArtifactBodyFromAnswer,
    formatArtifactContextBlock,
    isIncompleteArtifactToolArgs,
    tryArtifactFallbackFromAnswer,
} from './artifact';

describe('applyArtifactToolAction', () => {
    test('create sets title and content', () => {
        const result = applyArtifactToolAction(null, {
            action: 'create',
            title: 'Draft',
            content: 'Hello',
        });
        expect(result?.title).toBe('Draft');
        expect(result?.content).toBe('Hello');
        expect(result?.updatedBy).toBe('assistant');
    });

    test('create mid-thread without content keeps existing body', () => {
        const result = applyArtifactToolAction(
            {
                title: 'Apple letter',
                content: 'keep me',
                updatedAt: '1',
                updatedBy: 'assistant',
            },
            { action: 'create', title: 'Google letter' }
        );
        expect(result?.title).toBe('Google letter');
        expect(result?.content).toBe('keep me');
    });

    test('replace sets new content', () => {
        const result = applyArtifactToolAction(
            {
                title: 'Old',
                content: 'old body',
                updatedAt: '1',
                updatedBy: 'assistant',
            },
            { action: 'replace', title: 'Refund', content: 'new body' }
        );
        expect(result?.content).toBe('new body');
    });

    test('delete clears document', () => {
        const result = applyArtifactToolAction(
            {
                title: 'T',
                content: 'x',
                updatedAt: '1',
                updatedBy: 'user',
            },
            { action: 'delete' }
        );
        expect(result).toBeNull();
    });
});

describe('isIncompleteArtifactToolArgs', () => {
    test('detects raw partial args', () => {
        expect(isIncompleteArtifactToolArgs({ raw: '{"action":' })).toBe(true);
        expect(
            isIncompleteArtifactToolArgs({
                action: 'replace',
                content: 'ok',
            })
        ).toBe(false);
    });
});

describe('extractArtifactBodyFromAnswer', () => {
    test('extracts letter after preamble', () => {
        const answer = `Done. Doc mis à jour.

Objet: Demande de remboursement – Google Play

Bonjour,

Je vous contacte concernant l'achat suivant:
Produit: [Nom]

Cordialement, Jean`;

        const body = extractArtifactBodyFromAnswer(answer);
        expect(body).toContain('Objet:');
        expect(body).toContain('Bonjour');
    });
});

describe('tryArtifactFallbackFromAnswer', () => {
    test('mirrors letter when tool was not called', () => {
        const answer = `Objet: Test

Bonjour,

Corps de la lettre assez long pour dépasser le seuil minimum de quatre-vingts caractères dans ce test unitaire automatisé.`;

        const next = tryArtifactFallbackFromAnswer(null, answer, 'change pour google', false);
        expect(next?.content).toContain('Objet:');
        expect(next?.title).toContain('Google');
    });

    test('skips when artifact tool already applied', () => {
        const current = {
            title: 'Doc',
            content: 'keep',
            updatedAt: '1',
            updatedBy: 'assistant' as const,
        };
        const next = tryArtifactFallbackFromAnswer(
            current,
            'Objet: New\n\nBonjour,\n\n' + 'x'.repeat(90),
            'crée un doc',
            true
        );
        expect(next?.content).toBe('keep');
    });
});

describe('formatArtifactContextBlock', () => {
    test('includes title and body', () => {
        const block = formatArtifactContextBlock({
            title: 'Notes',
            content: 'Line one',
            updatedAt: '1',
            updatedBy: 'user',
        });
        expect(block).toContain('Notes');
        expect(block).toContain('Line one');
    });
});
