# AGENTS.md — Groot workspace guide

## Product

**Groot** ([ia.lenylvt.cc](https://ia.lenylvt.cc)) — AI chat with Grok (xAI), multi-agent deep research, web/X search. Conversations stored server-side on Cloudflare D1. Maintained by **leny** (forked from the archived trendy-design project).

| Aspect | Detail |
|--------|--------|
| **Framework** | TanStack Start v1 (Vite) on Cloudflare Workers |
| **Auth** | BetterAuth Email OTP (Cloudflare Email Service) |
| **DB** | Cloudflare D1 + Drizzle ORM |
| **AI** | xAI only (`grok-4.3`, `grok-4.20-multi-agent`) |
| **Monorepo** | Turborepo + Bun |

## Stack

| Layer | Technology |
|-------|------------|
| App | `apps/web` — TanStack Router (file routes in `src/routes/`) |
| UI packages | `@repo/common`, `@repo/ui`, `@repo/shared` |
| AI | `@repo/ai` — workflow in `workflow/`, worker in `worker/` |
| Orchestrator | `@repo/orchestrator` — generic task engine (no Langfuse) |

## Chat modes (`ChatMode`)

| Mode | Model / behavior |
|------|------------------|
| `standard` | Grok 4.3 + web/X search + code execution (image + video understanding) |
| `deep-4` | Grok 4.20 multi-agent, 4 agents (`reasoning.effort: medium`) + web/X search + code execution |
| `deep-16` | Grok 4.20 multi-agent, 16 agents (`reasoning.effort: high`) + web/X search + code execution |

## Key paths

```
apps/web/
  src/routes/          # TanStack file-based routes
  src/server/          # completion stream, thread server functions
  src/db/schema.ts     # D1 schema (auth + threads)
  src/auth.ts          # BetterAuth server config
  wrangler.jsonc       # Workers, D1, KV, send_email bindings
packages/ai/
  providers.ts              # xAI provider
  grok-stream.ts            # raw xAI Responses SSE (+ activity ingest)
  workflow/flow.ts            # runWorkflow (router → completion | deep-completion)
  workflow/activity.ts        # ActivityController → toolCalls / steps
  workflow/activity-stream.ts # ingestXaiActivityEvent from SSE
  xai-server-tools.ts         # server tool type/name mapping (no UI strings)
packages/common/
  store/chat.store.ts  # Zustand + D1 via thread-persistence injection
  lib/auth-client.ts   # BetterAuth client
```

## API

| Route | Role |
|-------|------|
| `POST /api/completion` | SSE workflow stream |
| `POST /api/files` | Upload file → xAI Files API (7d TTL) |
| `GET /api/files/:id/content` | File content (txt preview, etc.) |
| `DELETE /api/files/:id` | Delete file from xAI + D1 |
| `/api/auth/*` | BetterAuth handler |
| Server functions in `src/server/threads.ts` | Thread CRUD |

## Env (Workers / `.dev.vars`)

- `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`
- `XAI_API_KEY`
- `AUTH_FROM_EMAIL` (verified domain in Cloudflare Email Service)

## Scripts

```bash
bun install
bun dev                    # turbo dev
cd apps/web && bun run build
cd apps/web && bun run db:migrate:local
cd apps/web && wrangler dev
```

## Removed (do not reintroduce)

- Next.js, Clerk, Vercel KV/Blob, Sentry, PostHog, Langfuse, Prisma, Dexie, MCP proxy, credit limits, Resend

## Agent conventions

- Prefer server functions + D1 for persistence; client store is optimistic cache.
- OTP email: `void env.EMAIL.send(...)` — do not await (timing-attack mitigation).
- BetterAuth: `tanstackStartCookies()` must be last plugin.
- Deep multi-agent: do not send `max_tokens` to `grok-4.20-multi-agent`.
- Tool activity UI: `AgentActivityCard` + side drawer `id: 'research'`; labels in `@repo/shared/utils` (`displayNameForServerTool`).
- Imagine: client tools `image_creator` / `video_creator` → `packages/ai/xai-imagine.ts`; gallery on `threadItem.object.imagineMedia`.
- Thread document: client `artifact` function tool → `ActivityController` updates `threads.artifact` (D1 canonical); SSE `object` may include `artifact` for UI refresh only (not persisted on `thread_items.object`). UI `ArtifactCard` + drawer `id: 'artifact'` (Tiptap light editor).
- xAI activity: canonical `response.output_item.*` events; optional `tool_calls` chunks only when `id` / `call_id` is present (no synthetic tool ids).

## Files (xAI)

- Documents: upload via `POST /api/files` → attach with `file_id` in chat (`attachment_search` is automatic on xAI).
- Images in chat: still use base64 `imageAttachment` (unchanged UI).
- Max **48 MB** per file (xAI limit). Auto-delete: **7 days** (`expires_after`) and when thread/thread-item is deleted.
- Run migration: `cd apps/web && bun run db:migrate:local` (adds `thread_files`, `file_attachments`, `threads.artifact`, `thread_items.object`).
- Imagine media persists on `thread_items.object` (prompt + URL). Large chat `imageAttachment` is stripped on save so messages still persist.
