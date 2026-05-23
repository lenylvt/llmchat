import { useSession } from '../lib/auth-client';
import { cn, Dialog, DialogContent } from '@repo/ui';
import { IconCircleCheckFilled } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { Logo } from './logo';

export const IntroDialog = () => {
    const [isOpen, setIsOpen] = useState(false);
    const { data: session } = useSession();
    const isSignedIn = !!session?.user;

    useEffect(() => {
        const hasSeenIntro = localStorage.getItem('hasSeenIntro');
        if (!hasSeenIntro) {
            setIsOpen(true);
        }
    }, []);

    const handleClose = () => {
        localStorage.setItem('hasSeenIntro', 'true');
        setIsOpen(false);
    };

    const icon = (
        <IconCircleCheckFilled className="text-muted-foreground/50 mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full" />
    );

    const points = [
        {
            icon,
            text: 'Conversations are stored securely on the server when you are signed in.',
        },
        {
            icon,
            text: 'Three modes: Normal chat, Pro (4 agents), and Deep research (16 agents).',
        },
        {
            icon,
            text: 'Sign in with email OTP — no password required.',
        },
        {
            icon,
            text: 'Powered by Grok 4.3 and Grok 4.20 multi-agent on xAI.',
        },
    ];

    if (isSignedIn) {
        return null;
    }

    return (
        <Dialog
            open={isOpen}
            onOpenChange={open => {
                if (open) {
                    setIsOpen(true);
                } else {
                    handleClose();
                }
            }}
        >
            <DialogContent
                ariaTitle="Introduction"
                className="flex max-w-[420px] flex-col gap-0 overflow-hidden p-0"
            >
                <div className="flex flex-col gap-8 p-5">
                    <div className="flex flex-col gap-2">
                        <div
                            className={cn(
                                'flex h-8 w-full cursor-pointer items-center justify-start gap-1.5 '
                            )}
                        >
                            <Logo className="text-brand size-5" />
                            <p className="font-clash text-foreground text-lg font-bold tracking-wide">
                                ia.lenylvt.cc
                            </p>
                        </div>
                        <p className="text-base font-semibold">Grok-powered AI chat</p>
                    </div>

                    <div className="flex flex-col gap-2">
                        <h3 className="text-sm font-semibold">What you get</h3>

                        <ul className="flex flex-col items-start gap-2">
                            {points.map((point, index) => (
                                <li key={index} className="flex items-start gap-2">
                                    {point.icon}
                                    <span className="text-muted-foreground text-sm leading-snug">
                                        {point.text}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};
