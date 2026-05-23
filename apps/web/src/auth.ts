import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { emailOTP } from 'better-auth/plugins';
import { tanstackStartCookies } from 'better-auth/tanstack-start';
import { env, waitUntil } from 'cloudflare:workers';
import { createDb } from './db';
import { schema } from './db/schema';

let authInstance: ReturnType<typeof betterAuth> | null = null;

function maskEmail(email: string) {
    const [name = '', domain = ''] = email.split('@');
    const visibleName = name.length <= 2 ? name[0] : `${name[0]}***${name[name.length - 1]}`;
    return `${visibleName || '?'}@${domain || '?'}`;
}

export function getAuth() {
    if (!authInstance) {
        const db = createDb(env.DB);

        authInstance = betterAuth({
            database: drizzleAdapter(db, {
                provider: 'sqlite',
                schema,
            }),
            secret: env.BETTER_AUTH_SECRET,
            baseURL: env.BETTER_AUTH_URL,
            trustedOrigins: [
                env.BETTER_AUTH_URL,
                'http://localhost:5173',
                'http://localhost:5175',
                'http://127.0.0.1:5173',
                'http://127.0.0.1:5175',
            ],
            emailAndPassword: {
                enabled: false,
            },
            plugins: [
                emailOTP({
                    sendVerificationOTP({ email, otp, type }) {
                        const from = env.AUTH_FROM_EMAIL || 'auth@lenylvt.cc';
                        const maskedEmail = maskEmail(email);
                        const invocationId = crypto.randomUUID();

                        console.info('[auth] OTP email requested', {
                            invocationId,
                            email: maskedEmail,
                            type,
                            from,
                            hasEmailBinding: !!env.EMAIL,
                            betterAuthUrl: env.BETTER_AUTH_URL,
                        });

                        const sendPromise = env.EMAIL.send({
                            to: email,
                            from,
                            subject: 'Your verification code',
                            text: `Your verification code is: ${otp}`,
                            html: `<p>Your verification code is: <strong>${otp}</strong></p>`,
                        })
                            .then(response => {
                                console.info('[auth] OTP email send resolved', {
                                    invocationId,
                                    email: maskedEmail,
                                    type,
                                    from,
                                    messageId: response.messageId,
                                });
                            })
                            .catch(error => {
                                console.error('[auth] OTP email send failed', {
                                    invocationId,
                                    email: maskedEmail,
                                    type,
                                    from,
                                    error,
                                });
                            });

                        waitUntil(sendPromise);
                        console.info('[auth] OTP email waitUntil scheduled', {
                            invocationId,
                            email: maskedEmail,
                            type,
                        });
                    },
                }),
                tanstackStartCookies(),
            ],
        });
    }

    return authInstance;
}

/** @deprecated Use getAuth() — kept for gradual migration */
export const createAuth = getAuth;

export type Auth = ReturnType<typeof getAuth>;
