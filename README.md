# Groot

**Groot** is a Grok-powered AI chat app at [ia.lenylvt.cc](https://ia.lenylvt.cc). Maintained by [leny](https://github.com/lenylvt). Source: [github.com/lenylvt/llmchat](https://github.com/lenylvt/llmchat) (fork of archived [trendy-design/llmchat](https://github.com/trendy-design/llmchat); detach fork in GitHub Settings → Danger Zone → **Leave fork network**).

## Stack

- **App**: TanStack Start on Cloudflare Workers (`apps/web`)
- **Auth**: BetterAuth (email OTP)
- **DB**: Cloudflare D1 + Drizzle
- **AI**: xAI Grok (`grok-4.3`, `grok-4.20-multi-agent`) with web/X search and file attachments

## Development

```bash
bun install
bun dev
```

```bash
cd apps/web
bun run build
bun run db:migrate:local   # local D1
wrangler dev
```

See [AGENTS.md](./AGENTS.md) for architecture, env vars, and conventions.

## Deploy

```bash
cd apps/web
bun run db:migrate:remote
bun run deploy
```

## License

See [LICENSE](./LICENSE).
