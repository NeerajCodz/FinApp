---
title: Running locally
description: Run Finapp's Convex backend, web app and Expo dev server with Docker Compose or directly with Bun.
order: 2
---

You can run the whole stack in Docker with one command, or run the web app with Bun against a Convex deployment of your choice.

## Prerequisites

- [Bun](https://bun.sh) 1.3.14 (the version pinned in `packageManager`)
- Docker with Docker Compose, for the containerised setup
- For the mobile app: an Android emulator or device with a Finapp development build, or Expo Go (see [Mobile](#mobile))

Install dependencies from the repository root:

```bash
bun install
```

## Docker Compose

`docker-compose.yml` defines four services:

| Service            | Image or build                        | Host port(s)                               | Purpose                                                             |
| ------------------ | ------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------- |
| `convex`           | `ghcr.io/get-convex/convex-backend`   | `2608` (API), `2610` (site / HTTP actions) | Self-hosted Convex backend, data in the `finapp_convex_data` volume |
| `convex-dashboard` | `ghcr.io/get-convex/convex-dashboard` | `2611`                                     | Convex dashboard for the local backend                              |
| `web`              | `infra/docker/web.Dockerfile`         | `3000`                                     | Next.js dev server with the repo mounted                            |
| `mobileexpo`       | `infra/docker/mobileexpo.Dockerfile`  | `2609` (Metro), `8081`, `2612` to `2614`   | Expo dev server for development builds (`--dev-client --host lan`)  |

The `web` and `mobileexpo` services wait for the Convex backend's health check before starting, then run `bun install --frozen-lockfile` inside the container.

### 1. Configure the environment

Copy the example file to `.env` in the repository root, which Compose reads automatically:

```bash
cp docker.env.example .env
```

| Variable                                                                       | Default                 | Meaning                                                 |
| ------------------------------------------------------------------------------ | ----------------------- | ------------------------------------------------------- |
| `FINAPP_CONVEX_PORT`                                                           | `2608`                  | Host port for the Convex API                            |
| `FINAPP_CONVEX_SITE_PORT`                                                      | `2610`                  | Host port for Convex HTTP actions                       |
| `FINAPP_CONVEX_DASHBOARD_PORT`                                                 | `2611`                  | Host port for the Convex dashboard                      |
| `FINAPP_EXPO_PORT`                                                             | `2609`                  | Host port for Metro                                     |
| `FINAPP_EXPO_COMPAT_PORT`                                                      | `8081`                  | Extra Metro port for tools that expect 8081             |
| `FINAPP_EXPO_DEVTOOLS_PORT`, `FINAPP_EXPO_LAN_PORT`, `FINAPP_EXPO_TUNNEL_PORT` | `2612`, `2613`, `2614`  | Expo dev tools ports                                    |
| `EXPO_PUBLIC_APP_ENV`                                                          | `docker`                | App environment label for the mobile build              |
| `EXPO_PUBLIC_CONVEX_URL`                                                       | `http://10.0.2.2:2608`  | Convex URL as seen from the phone                       |
| `EXPO_PUBLIC_METRO_URL`                                                        | `http://10.0.2.2:2609`  | Metro URL as seen from the phone                        |
| `EXPO_HOSTNAME`                                                                | `10.0.2.2`              | Hostname Metro advertises                               |
| `INSTANCE_NAME`                                                                | `finapp-local`          | Convex instance name                                    |
| `INSTANCE_SECRET`                                                              | placeholder             | Convex instance secret: **64 lowercase hex characters** |
| `NEXT_PUBLIC_CONVEX_URL`                                                       | `http://127.0.0.1:2608` | Convex URL used by the web app                          |

Generate a real instance secret:

```bash
openssl rand -hex 32
```

:::note
`10.0.2.2` is how the Android emulator reaches your computer. For a physical phone, replace it in `EXPO_PUBLIC_CONVEX_URL`, `EXPO_PUBLIC_METRO_URL` and `EXPO_HOSTNAME` with your computer's LAN IP address. Compose also accepts `CONVEX_CLOUD_ORIGIN`, `CONVEX_SITE_ORIGIN`, `CONVEX_SITE_URL` and `EXPO_PUBLIC_CONVEX_SITE_URL` overrides; they default to the same `10.0.2.2` addresses.
:::

### 2. Start the stack

:::tabs

```bash title="Everything"
bun run dev            # docker compose up --build
```

```bash title="Backend only"
bun run dev:convex     # convex + convex-dashboard
```

```bash title="Mobile only"
bun run dev:mobile     # mobileexpo (starts convex too)
```

:::

Stop it with `bun run compose:down`, and check the merged configuration with `bun run compose:config`.

The web app is at `http://localhost:3000` and the Convex dashboard at `http://localhost:2611`.

### 3. Push the Convex functions

The `convex` container starts an empty backend. Deploy the schema and functions in `convex/` to it with the Convex CLI's self-hosted mode. Generate an admin key from the running container and point the CLI at it, as described in Convex's self-hosting guide:

```bash
docker compose exec convex ./generate_admin_key.sh
export CONVEX_SELF_HOSTED_URL=http://127.0.0.1:2608
export CONVEX_SELF_HOSTED_ADMIN_KEY='<key printed above>'
bunx convex dev
```

The same admin key signs you in to the dashboard on port `2611`.

### 4. Set backend environment variables

Set these on the local Convex deployment (dashboard **Settings → Environment Variables**, or `bunx convex env set NAME value`):

| Variable                  | Needed for                                                                                                                                                          |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `JWT_PRIVATE_KEY`, `JWKS` | Convex Auth session tokens. Generate them with Convex Auth's setup (`npx @convex-dev/auth`).                                                                        |
| `AUTH_RESEND_KEY`         | Sending verification, password-reset, two-factor and app-lock reset codes through Resend. Sign-up requires email verification, so you need this to create accounts. |
| `AUTH_EMAIL_FROM`         | Optional sender, default `Finapp <onboarding@resend.dev>`                                                                                                           |
| `GEMINI_API_KEY`          | Optional: FinAI's built-in model and receipt scanning                                                                                                               |
| `AI_KEYS_SECRET`          | Optional: 32 random bytes, base64. Enables BYOK keys and authenticator-app two-factor                                                                               |
| `EXPO_ACCESS_TOKEN`       | Optional: authenticates push requests to the Expo push service                                                                                                      |

`CONVEX_SITE_URL` is provided by the backend (Compose sets it). The MCP variables are only needed if you want to test MCP locally; see [Deploying the MCP server](/mcp/deployment).

## Running the web app with Bun

To run Next.js directly on your machine (for example against a cloud Convex dev deployment), create `apps/web/.env.local`:

```bash
NEXT_PUBLIC_CONVEX_URL=https://<your-deployment>.convex.cloud
```

Then, from the repository root:

```bash
bun run dev:web
```

The public landing page at `/` renders without a Convex URL; `/welcome`, `/sign-in`, `/sign-up` and the app need `NEXT_PUBLIC_CONVEX_URL`.

## Mobile

The Expo app reads `EXPO_PUBLIC_CONVEX_URL` (required) and `EXPO_PUBLIC_CONVEX_SITE_URL` (optional) at build time; `app.config.js` fails fast if the Convex URL is missing or not HTTP(S).

- **Development build:** the `mobileexpo` service runs `expo start --dev-client`, so install a Finapp development build on the emulator or phone and connect it to Metro.
- **Expo Go:** from `apps/mobile`, run `bunx expo start --go --tunnel`. Expo CLI and Expo Go must be signed in to the same account and the dev server must stay online. In Expo Go the local database is kept in memory with encrypted snapshots instead of SQLCipher, and push notifications and scheduled reminders are skipped.

## Checks

| Command                   | What it runs                                 |
| ------------------------- | -------------------------------------------- |
| `bun run typecheck`       | TypeScript for mobile, web, widgets and MCP  |
| `bun run test`            | Mobile and web test suites                   |
| `bun run lint`            | ESLint for both apps and the shared packages |
| `bun run format:check`    | Prettier                                     |
| `bun run expo:doctor`     | Expo dependency checks                       |
| `bun run version:check`   | Versions match `version.json`                |
| `bun run validate`        | All of the above                             |
| `bun run build:web`       | Production build of the web app              |
| `bun run widgets:preview` | Preview the MCP Apps widgets                 |

CI runs these on every pull request, plus `docker compose config --quiet` and a Convex codegen check.
