import { RootLayout } from '@repo/common/components';
import { ClientOnly } from '@tanstack/react-router';

type ClientRootLayoutProps = {
    children: React.ReactNode;
};

/** RootLayout uses Better Auth `useSession` and browser-only UI; skip during SSR. */
export function ClientRootLayout({ children }: ClientRootLayoutProps) {
    return (
        <ClientOnly
            fallback={
                <div className="bg-background flex min-h-[100dvh] w-full items-center justify-center">
                    <p className="text-muted-foreground text-sm">Loading…</p>
                </div>
            }
        >
            <RootLayout>{children}</RootLayout>
        </ClientOnly>
    );
}
