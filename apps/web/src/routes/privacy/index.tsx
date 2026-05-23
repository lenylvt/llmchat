import { privacyPolicy } from '@repo/shared/config';
import { createFileRoute } from '@tanstack/react-router';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export const Route = createFileRoute('/privacy/')({
    component: PrivacyPage,
});

function PrivacyPage() {
    return (
        <article className="prose prose-sm prose-prosetheme mx-auto max-w-3xl p-8 font-sans">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{privacyPolicy}</ReactMarkdown>
        </article>
    );
}
