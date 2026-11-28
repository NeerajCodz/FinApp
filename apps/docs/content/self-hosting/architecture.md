---
title: Architecture
description: How the Finapp monorepo is laid out and how the web app, mobile app, MCP server and public API talk to the Convex backend.
order: 1
---

Finapp is a Bun monorepo with two client apps, three shared packages and a Convex backend. Every client talks to the same Convex deployment, which holds all data, authentication and business rules.

```text
                ┌───────────────────────────┐
  Browser ──────┤ apps/web (Next.js)        ├──┐  Convex client (WebSocket)
                │  ├─ finance UI + IndexedDB │  │
  AI clients ───┤  └─ /mcp + /oauth (server) ├──┤  HTTP, 1-minute backend JWT
                └───────────────────────────┘  │
                                                ▼
  Phone ─────── apps/mobile (Expo) ──────────► convex/  (functions, schema, auth, crons, storage)
                 └─ SQLite / SQLCipher            ▲
                                                  │  HTTP actions on the Convex site URL
  Integrations ───────────────────────────────────┘  (/version, auth routes, /api/v1)
```

## Repository layout

| Path                   | What it is                                                                                                                                                |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web`             | Next.js web app (App Router): landing page, finance app, settings, MCP server and OAuth endpoints                                                         |
| `apps/mobile`          | Expo / React Native app (Expo Router) for Android and iOS                                                                                                 |
| `packages/ui`          | Shared UI: finance screens with separate web and native presentations, chat, charts, FinAI components, the MCP dashboard, illustrations and design tokens |
| `packages/mcp`         | The MCP server: tool registry, scope and access checks, OAuth and JWT helpers, discovery metadata                                                         |
| `packages/widgets`     | Self-contained MCP Apps widgets rendered inside ChatGPT and Claude                                                                                        |
| `convex/`              | The backend: schema, queries, mutations, actions, HTTP routes, cron jobs and auth configuration                                                           |
| `infra/docker`         | Dockerfiles for local development containers                                                                                                              |
| `integrations/chatgpt` | ChatGPT app package for the MCP server                                                                                                                    |
| `scripts/`             | Versioning, release notes and avatar asset scripts                                                                                                        |
| `tests/`               | Cross-package tests (web, mobile, Convex, widgets, integration)                                                                                           |
| `docs/`                | Repository docs (MCP guide, MCP coverage, versioning)                                                                                                     |
| `version.json`         | The single source of truth for product and component versions                                                                                             |

The workspaces are declared in the root `package.json` (`apps/mobile`, `apps/web`, `packages/ui`, `packages/widgets`, `packages/mcp`). The Convex functions are not a workspace package; both apps import their generated API from `convex/_generated`.

## The Convex backend

`convex/` is organised by domain:

| Module                                                                                             | Responsibility                                                                                   |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `accounts`, `transactions`, `categories`, `goals`, `recurring`, `analytics`, `dashboard`, `search` | Personal finance                                                                                 |
| `groups`, `splits`, `settlements`                                                                  | Shared groups, expense splitting, balances and settle-up                                         |
| `social`, `directMessages`, `presence`, `activity`                                                 | Friends, direct messages, presence and activity feeds                                            |
| `notifications`                                                                                    | Inbox records, preferences, Expo push delivery and payment reminders                             |
| `sync`                                                                                             | Bootstrap, range and change-feed queries used by the offline clients                             |
| `ai`                                                                                               | FinAI assistant, `@finai` mentions, receipt scanning, attachments, spreadsheet import, BYOK keys |
| `users`, `avatars`, `files`                                                                        | Profiles, avatars and file storage                                                               |
| `auth.ts`, `auth.config.ts`, `mfa.ts`, `security.ts`                                               | Convex Auth (email and password with verification), two-factor, sessions and privacy             |
| `mcp.ts`, `mcpOAuth.ts`, `mcpOAuthActions.ts`                                                      | MCP read projections, OAuth clients, codes, grants and activity                                  |
| `trash.ts`                                                                                         | Trash, restore, purge and retention                                                              |
| `http.ts`                                                                                          | HTTP routes: Convex Auth routes and `GET /version`                                               |
| `crons.ts`                                                                                         | Daily Trash purge (03:15 UTC) and hourly FinAI attachment cleanup                                |
| `shared/`                                                                                          | Code shared with the clients: money, versions, settings shapes, provider lists                   |

A Convex deployment exposes two URLs: the **cloud URL** that clients connect to (`NEXT_PUBLIC_CONVEX_URL`, `EXPO_PUBLIC_CONVEX_URL`) and the **site URL** that serves HTTP actions (`CONVEX_SITE_URL`, `EXPO_PUBLIC_CONVEX_SITE_URL`).

### Public REST API

The Convex deployment also serves a public REST API under `/api/v1` on its **site URL**. It requires two extra Convex environment variables, `PUBLIC_API_IP_SALT` and `WEBHOOK_SECRET_KEY`; see [Deployment](/self-hosting/deployment#convex-environment-variables). The API itself is documented in the [developer docs](/developers/overview).

## How the clients talk to Convex

### Web

The web app creates a `ConvexReactClient` with `NEXT_PUBLIC_CONVEX_URL` and wraps the app in the Convex Auth provider. Finance screens read and write through a local-first layer in `apps/web/lib/offline`:

- an IndexedDB database (`finapp-web-local`) stores records, an outbox of pending writes, id mappings, sync state, conflicts and range coverage;
- `BrowserSyncProvider` bootstraps from the `sync` queries, follows the change feed and replays the outbox through the normal mutations, each with a `clientMutationId` so a retried write is applied once.

Live-only features (chat, invitations, FinAI, security settings) call Convex directly.

### Mobile

The Expo app uses the same Convex client and auth, with a local SQLite database (SQLCipher-encrypted in installed builds) and an outbox in `apps/mobile/local`, coordinated by `providers/LocalSyncProvider.tsx`. Push notifications use Expo push tokens registered through `notifications.push.registerDevice`; Convex sends them via the Expo push service.

### MCP server

The MCP endpoint runs on the Next.js server (`apps/web/app/mcp/route.ts`), not in Convex. It validates the client's OAuth access token, then calls Convex over HTTP as that user with a one-minute JWT for the `finapp-mcp-backend` audience. Convex trusts that audience through a custom JWT provider in `convex/auth.config.ts`, which reads the web app's public JWKS. See [MCP overview](/mcp/overview).

### AI providers

FinAI and receipt scanning run in Convex actions. They call Google's Gemini API with the server's `GEMINI_API_KEY`, or the user's own provider key (BYOK), which is stored encrypted with `AI_KEYS_SECRET` and decrypted only for the duration of one request.

## Versions

`version.json` holds the product version and the web, mobile, UI and backend component versions. `bun run version:sync` writes them into the package files, the mobile app config and `convex/shared/version.ts`, and CI checks they match. The backend publishes its version and the minimum supported client versions; older mobile builds show an _update required_ notice. `GET /version` on the Convex site URL returns the running backend's version information.
