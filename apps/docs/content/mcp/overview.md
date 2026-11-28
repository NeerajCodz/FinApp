---
title: MCP overview
description: What Finapp's remote Model Context Protocol server is, how it is reached and how it talks to the backend.
order: 1
---

Finapp exposes a remote [Model Context Protocol](https://modelcontextprotocol.io) (MCP) server from the Next.js web app. AI clients such as ChatGPT and Claude call domain-specific tools, and the server talks to the Convex backend **as the signed-in user**.

A client connection always requires explicit OAuth consent. Being signed in to Finapp does not, by itself, give any AI app access to your data.

## At a glance

|                     |                                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------------- |
| Endpoint            | `https://<your-finapp-origin>/mcp`                                                                |
| Transport           | Stateless Streamable HTTP; JSON-RPC over `POST`                                                   |
| Authorization       | OAuth 2.1 authorization code with PKCE `S256`, refresh tokens                                     |
| Client registration | Dynamic Client Registration, Client ID Metadata Documents, or dashboard-issued client credentials |
| Scopes              | `finapp:read` (required) plus four opt-in write scopes                                            |
| Tools               | `finapp.catalog`, four `finapp.<domain>.parent` tools and 110 domain tools                        |
| Resources           | `finapp://catalog` (JSON capability document) and MCP Apps widgets (`ui://finapp/...`)            |
| Server version      | `2.0.0`                                                                                           |

The server does not maintain MCP sessions and does not provide a long-lived SSE stream. Each request is authorized independently.

## Routes

| Route                                       | Purpose                                                                                        |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `/mcp`                                      | The MCP endpoint. Send JSON-RPC with `POST`.                                                   |
| `/mcp/status`                               | Public, data-free health JSON used by the dashboard's live status.                             |
| `/mcp/dashboard`                            | Connect, Explore tools, In-chat widgets, Permissions and Activity workspace, plus OAuth setup. |
| `/mcp/login`                                | Finapp sign-in with MCP-specific context and return-path handling.                             |
| `/mcp/authorize`                            | Consent: review the registered client, return destination and requested scopes.                |
| `/oauth/register`                           | Dynamic registration for OAuth clients.                                                        |
| `/oauth/authorize`                          | Validates the authorization request and redirects to consent.                                  |
| `/oauth/token`                              | Exchanges an authorization code (with PKCE verifier) or a refresh token for tokens.            |
| `/.well-known/oauth-authorization-server`   | OAuth authorization server metadata (also served at `/.well-known/openid-configuration`).      |
| `/.well-known/oauth-protected-resource/mcp` | Path-specific protected-resource metadata.                                                     |
| `/.well-known/oauth-protected-resource`     | Protected-resource metadata at the origin root.                                                |
| `/.well-known/jwks.json`                    | Public signing keys; never contains a private key.                                             |
| `/.well-known/openai-apps-challenge`        | ChatGPT app domain verification token, when configured.                                        |

### Opening `/mcp` in a browser

`/mcp` is an API endpoint, but it is also the URL people paste into their AI app. A browser that opens it (a `GET` whose `Accept` header includes `text/html`) is redirected with `303` to `/mcp/dashboard`. Every other `GET` and `DELETE` gets the spec's `405` with `Allow: POST, OPTIONS`.

## How a request flows

1. The AI client sends a JSON-RPC request to `/mcp` with a bearer access token.
2. The web server validates the token (RS256, issuer, MCP resource audience, expiry) and checks that the grant behind it is still active.
3. It loads the grant's **current** scopes and your account's MCP access settings. Both can be changed in Finapp after the token was issued, and the change applies on the next request.
4. It mints a separate one-minute backend credential with audience `finapp-mcp-backend` and calls Convex with it. This credential never leaves the server.
5. Convex checks record ownership and group or conversation membership for every read and write, exactly as it does for the apps.
6. The tool result is returned as structured content plus a text summary, and, for clients that support MCP Apps, an in-chat widget.

Client-facing tokens are not Convex credentials: the MCP endpoint rejects backend tokens, and Convex rejects client-facing MCP tokens.

## Discovering tools

Clients should call `finapp.catalog` first. It describes the four domains, their parent tools, every tool's scope and read-only flag, the linked widgets, pagination, money and timestamp conventions. The same information is available as the `finapp://catalog` resource.

| Domain   | Parent tool              | Covers                                                                                                                                                    |
| -------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Finance  | `finapp.finance.parent`  | Transactions (search, detail, line items), accounts, categories and their monthly limits (budgets), goals, recurring rules, Trash, overview and analytics |
| Groups   | `finapp.groups.parent`   | Group settings, members and roles, ownership, invitations, expenses, balances, settle-up, settlements, reminders and chat                                 |
| Social   | `finapp.social.parent`   | Friends, friend requests, people search, profiles and activity, the people inbox and direct messages                                                      |
| Personal | `finapp.personal.parent` | Profile, avatars, defaults, notifications, privacy, security status, signed-in devices and FinAI settings                                                 |

Good starting points are `finapp.finance.overview`, `finapp.finance.transactions.list`, and `finapp.groups.list` followed by `finapp.groups.balances`.

The tool registry in `packages/mcp/src/tools/*` is the single source of truth: the catalog tool, parents, the catalog resource, `/mcp/status` and the dashboard's tool list are all generated from it, so they cannot drift apart.

## Where to go next

- [Connecting a client](/mcp/connecting): ChatGPT, Claude and other MCP clients.
- [Tools](/mcp/tools): the full tool list, results, money format, pagination and widgets.
- [Permissions and security](/mcp/permissions-and-security): scopes, consent, revocation, access controls and the authorization contract.
- [Deployment](/mcp/deployment): environment variables, keys, deployment order and verification.
- [Troubleshooting](/mcp/troubleshooting): common errors and what to check.

The in-app assistant is separate from MCP; see [FinAI assistant](/guide/finai).
