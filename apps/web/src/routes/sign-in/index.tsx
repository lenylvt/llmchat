import { SignIn } from '@repo/common/components';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/sign-in/')({
    component: SignInPage,
});

function SignInPage() {
    return (
        <div className="flex h-full flex-1 items-center justify-center">
            <SignIn />
        </div>
    );
}
