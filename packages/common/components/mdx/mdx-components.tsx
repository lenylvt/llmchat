import { CodeBlock } from '@repo/common/components';
import { isValidUrl } from '@repo/shared/utils';
import { ReactElement } from 'react';
import type { Components } from 'react-markdown';

export const mdxComponents: Components = {
    a: ({ href, children, ...props }) => {
        if (href && isValidUrl(href)) {
            return (
                <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand underline-offset-2 hover:underline"
                    {...props}
                >
                    {children}
                </a>
            );
        }

        return (
            <a href={href} {...props}>
                {children}
            </a>
        );
    },

    pre: ({ children }) => {
        if (typeof children === 'string') {
            return <CodeBlock code={children.replace(/<FadeEffect \/>$/, '')} />;
        }
        const codeElement = children as ReactElement;
        const className = codeElement?.props?.className || '';
        const lang = className.replace('language-', '');
        const code = codeElement?.props?.children;

        return <CodeBlock code={String(code).replace(/<FadeEffect \/>$/, '')} lang={lang} />;
    },
    code: ({ children, className }) => {
        if (!className) {
            return (
                <code className="border-brand/20 !bg-brand/10 text-brand rounded-md border px-1.5 py-0.5 font-mono text-sm">
                    {children}
                </code>
            );
        }
        const lang = className.replace('language-', '');
        return <CodeBlock code={String(children).replace(/<FadeEffect \/>$/, '')} lang={lang} />;
    },
};
