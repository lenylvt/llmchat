import { ClientRootLayout } from '../components/ClientRootLayout';
import { ThreadPersistenceInit } from '../components/ThreadPersistenceInit';
import { ReactQueryProvider, RootProvider } from '@repo/common/context';
import { TooltipProvider, cn } from '@repo/ui';
import { createRootRouteWithContext, HeadContent, Outlet, Scripts } from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools';
import globalsCss from '../styles/globals.css?url';

export const Route = createRootRouteWithContext()({
    head: () => ({
        meta: [
            { charSet: 'utf-8' },
            {
                name: 'viewport',
                content: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no',
            },
            {
                title: 'ia.lenylvt.cc — Grok chat & deep research',
            },
            {
                name: 'description',
                content:
                    'AI chat powered by Grok — standard chat, web + X search, and multi-agent deep research.',
            },
        ],
        links: [
            { rel: 'stylesheet', href: globalsCss },
            { rel: 'icon', href: '/favicon.ico' },
        ],
    }),
    component: RootComponent,
});

function RootComponent() {
    return (
        <html lang="en" className="font-sans" suppressHydrationWarning>
            <head>
                <HeadContent />
            </head>
            <body className={cn('min-h-screen bg-background antialiased')}>
                <RootProvider>
                    <ThreadPersistenceInit />
                    <TooltipProvider>
                        <ReactQueryProvider>
                            <ClientRootLayout>
                                <Outlet />
                            </ClientRootLayout>
                        </ReactQueryProvider>
                    </TooltipProvider>
                </RootProvider>
                <Scripts />
                {import.meta.env.DEV && <TanStackRouterDevtools position="bottom-right" />}
            </body>
        </html>
    );
}
