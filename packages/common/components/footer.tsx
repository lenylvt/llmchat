import { Link } from '@tanstack/react-router';

export const Footer = () => {
    const externalLinks = [
        { href: 'https://github.com/lenylvt/llmchat', label: 'GitHub' },
    ];

    return (
        <div className="flex w-full flex-row items-center justify-center gap-4 p-3">
            {externalLinks.map(link => (
                <a
                    key={link.href}
                    href={link.href}
                    target="_blank"
                    rel="noreferrer"
                    className="text-muted-foreground text-xs opacity-50 hover:opacity-100"
                >
                    {link.label}
                </a>
            ))}
            <Link
                to="/terms"
                className="text-muted-foreground text-xs opacity-50 hover:opacity-100"
            >
                Terms
            </Link>
            <Link
                to="/privacy"
                className="text-muted-foreground text-xs opacity-50 hover:opacity-100"
            >
                Privacy
            </Link>
        </div>
    );
};
