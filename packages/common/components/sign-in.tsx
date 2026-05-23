'use client';
import { authClient, signIn } from '../lib/auth-client';
import { Button, Input, InputOTP, InputOTPGroup, InputOTPSlot } from '@repo/ui';
import { useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';

const OTP_FLOW_KEY = 'groot:sign-in-otp';

function readOtpFlow(): { email: string; verifying: boolean } {
    if (typeof window === 'undefined') return { email: '', verifying: false };
    try {
        const raw = sessionStorage.getItem(OTP_FLOW_KEY);
        if (!raw) return { email: '', verifying: false };
        const parsed = JSON.parse(raw) as { email?: string; verifying?: boolean };
        return {
            email: typeof parsed.email === 'string' ? parsed.email : '',
            verifying: parsed.verifying === true && !!parsed.email,
        };
    } catch {
        return { email: '', verifying: false };
    }
}

function clearOtpFlow() {
    if (typeof window !== 'undefined') sessionStorage.removeItem(OTP_FLOW_KEY);
}

function maskEmail(email: string) {
    const [name = '', domain = ''] = email.split('@');
    const visibleName = name.length <= 2 ? name[0] : `${name[0]}***${name[name.length - 1]}`;
    return `${visibleName || '?'}@${domain || '?'}`;
}

type CustomSignInProps = {
    onClose?: () => void;
};

export const CustomSignIn = ({ onClose }: CustomSignInProps) => {
    const [email, setEmail] = useState(() => readOtpFlow().email);
    const [error, setError] = useState('');
    const [verifying, setVerifying] = useState(() => readOtpFlow().verifying);
    const [code, setCode] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        if (!verifying || !email) {
            clearOtpFlow();
            return;
        }
        sessionStorage.setItem(OTP_FLOW_KEY, JSON.stringify({ email, verifying: true }));
    }, [email, verifying]);

    const handleSendOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);
        try {
            console.info('[auth-client] Requesting OTP email', {
                email: maskEmail(email),
                type: 'sign-in',
            });
            const result = await authClient.emailOtp.sendVerificationOtp({
                email,
                type: 'sign-in',
            });
            console.info('[auth-client] OTP request completed', {
                email: maskEmail(email),
                error: result.error?.message,
            });
            if (result.error) {
                setError(result.error.message || 'Failed to send verification code.');
                return;
            }
            setVerifying(true);
        } catch (error) {
            console.error('[auth-client] OTP request threw', {
                email: maskEmail(email),
                error,
            });
            setError('Failed to send verification code. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleVerify = async () => {
        if (code.length !== 6) {
            setError('Please enter the complete 6-digit code');
            return;
        }
        setIsLoading(true);
        setError('');
        try {
            const result = await signIn.emailOtp({ email, otp: code });
            if (result.error) {
                setError(result.error.message || 'Invalid code');
                return;
            }
            clearOtpFlow();
            onClose?.();
            navigate({ to: '/chat' });
        } catch {
            setError('Invalid or expired code. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    if (verifying) {
        return (
            <div className="flex w-full max-w-sm flex-col gap-4 p-6">
                <p className="text-muted-foreground text-sm">
                    Enter the 6-digit code sent to <strong>{email}</strong>
                </p>
                <InputOTP maxLength={6} value={code} onChange={setCode}>
                    <InputOTPGroup>
                        {Array.from({ length: 6 }).map((_, i) => (
                            <InputOTPSlot key={i} index={i} />
                        ))}
                    </InputOTPGroup>
                </InputOTP>
                {error && <p className="text-destructive text-sm">{error}</p>}
                <Button onClick={handleVerify} disabled={isLoading}>
                    {isLoading ? 'Verifying...' : 'Verify'}
                </Button>
                <Button
                    variant="ghost"
                    onClick={() => {
                        clearOtpFlow();
                        setVerifying(false);
                        setCode('');
                    }}
                >
                    Use a different email
                </Button>
            </div>
        );
    }

    return (
        <form onSubmit={handleSendOtp} className="flex w-full max-w-sm flex-col gap-4 p-6">
            <h2 className="text-lg font-semibold">Sign in with email</h2>
            <Input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
            />
            {error && <p className="text-destructive text-sm">{error}</p>}
            <Button type="submit" disabled={isLoading || !email}>
                {isLoading ? 'Sending...' : 'Send verification code'}
            </Button>
        </form>
    );
};

export const SignIn = CustomSignIn;
