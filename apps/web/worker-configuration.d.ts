interface Env {
    DB: D1Database;
    KV: KVNamespace;
    EMAIL: SendEmail;
    BETTER_AUTH_SECRET: string;
    BETTER_AUTH_URL: string;
    XAI_API_KEY: string;
    AUTH_FROM_EMAIL: string;
}
