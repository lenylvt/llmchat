import { termsMdx } from '@repo/shared/config';
import { createFileRoute } from '@tanstack/react-router';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export const Route = createFileRoute('/terms/')({
    component: TermsPage,
});

function TermsPage() {
    return (
        <article className="prose prose-sm prose-prosetheme mx-auto max-w-3xl p-8 font-sans">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{termsMdx}</ReactMarkdown>
        </article>
    );
}
