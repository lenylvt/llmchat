import { getAuth } from '../auth';
import { env } from 'cloudflare:workers';

export type SessionContext = {
    userId: string;
    apiKey: string;
};

export async function requireSessionFromRequest(
    request: Request
): Promise<SessionContext | Response> {
    const auth = getAuth();
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user?.id) {
        return jsonError('Unauthorized', 401);
    }

    const apiKey = env.XAI_API_KEY;
    if (!apiKey) {
        return jsonError('XAI_API_KEY not configured', 500);
    }

    return { userId: session.user.id, apiKey };
}

export function jsonError(message: string, status: number): Response {
    return new Response(JSON.stringify({ error: message }), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}
