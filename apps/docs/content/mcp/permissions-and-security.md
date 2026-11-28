---
title: Permissions and security
description: OAuth scopes, consent, per-app permissions, account-wide access controls, revocation and the authorization contract behind Finapp's MCP server.
order: 4
---

Every MCP request is authorized three times: by the access token, by the grant behind it, and by Convex's own ownership and membership checks. This page describes each layer and the controls you have over it.

## Scopes

| Scope                   | Access through MCP                                                                                                                                                                                                                                                              |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `finapp:read`           | Every read tool: overview, transaction search and detail, accounts, categories and their limits, goals, analytics, groups, balances, history, people, messages, notifications, profile, privacy and security status, signed-in devices and FinAI settings. **Always required.** |
| `finapp:write:finance`  | Create, update and delete personal transactions (with line items), accounts, categories and their monthly limits (budgets), goals and contributions, recurring rules; restore, purge and empty Trash and set its retention.                                                     |
| `finapp:write:social`   | Send, answer and cancel friend requests, remove friends, start conversations, send direct messages, reactions, pins and read receipts.                                                                                                                                          |
| `finapp:write:groups`   | Create and update groups, invitations and links, member roles and removal, ownership transfer, leaving, adding, editing and deleting expenses, late joiners, recording and undoing settlements, payment reminders, and group chat (messages, pins, reactions, mark read).       |
| `finapp:write:personal` | Profile, default account and category, notification preferences, marking one or all notifications read, and privacy (presence, discoverability, friend requests, sign-in alerts).                                                                                               |

On the consent screen read access is required and every write scope starts **unchecked**, so an app gets write access only if you tick it.

## Changing an app's permissions

Under **Settings → AI → MCP connections** (web and mobile), tap a connected app to change which write scopes it has. Read access is always included. The new scopes apply on the app's next request, even though its access token was issued earlier, because the server reads the grant's current scopes on every call.

## Account access controls

The same settings screen has account-wide switches that apply to every connected app:

| Control            | Effect                                                                                       |
| ------------------ | -------------------------------------------------------------------------------------------- |
| **Allow AI apps**  | Off blocks every connected app at once without disconnecting them.                           |
| **Read-only mode** | Apps can read but every write tool is unavailable, whatever scopes they were granted.        |
| **Allow deletes**  | Off makes delete, remove and archive tools (the ones that need `confirm: true`) unavailable. |
| **Tool access**    | Block individual tools by name. Blocked tools are hidden from every app.                     |

A blocked tool tells the client why it is unavailable (for example _Finapp is in read-only mode for AI apps_) instead of running.

## Revoking access

Disconnect an app from **Settings → AI → MCP connections** or revoke its grant on the dashboard's **Permissions** tab. The next MCP request using that grant is rejected and its refresh token stops working. A request that is already running may finish. Revoked grants remain visible as history (_Recently disconnected_, or _Include revoked_ on the dashboard).

When a new app is authorized you get a **New app connected** security notification. If you don't recognise it, disconnect it.

## What Convex checks

After the web server validates the token and grant, it calls Convex with a short-lived backend credential for your user. Convex then applies the same rules as for the apps:

- you can read and change only your own records;
- group reads and writes require active membership, and admin-only actions require the admin role;
- direct messages require being a participant;
- read tools return safe projections, not raw database documents.

Browser origins are not credentials. Allowed origins are the canonical resource origin, `https://chatgpt.com`, `https://claude.ai`, `https://claude.com`, local MCP Inspector on port `6274`, and anything listed in `MCP_ALLOWED_ORIGINS`. Requests from them still need a valid token and grant; other browser origins get `403 Forbidden origin`.

## What is recorded

The dashboard's **Activity** tab keeps at most 100 recent tool names and outcomes per account. Tool arguments and financial results are never recorded. Recording is best-effort and is not an audit ledger.

## Authorization contract

This section is for client developers and operators.

### Clients

Finapp supports three ways for a client to exist:

| Registration                 | How                                                                                                            | Token endpoint auth                                                                                 |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Dynamic Client Registration  | `POST /oauth/register` (RFC 7591)                                                                              | `none` (public), `client_secret_basic`, `client_secret_post` or `private_key_jwt` with a `jwks_uri` |
| Client ID Metadata Document  | The `client_id` is an HTTPS URL to a metadata document, which Finapp fetches, validates and caches for an hour | `none` or `private_key_jwt`                                                                         |
| Dashboard client credentials | Created by a signed-in user on `/mcp/dashboard`                                                                | `client_secret_basic` or `client_secret_post`                                                       |

Redirect URIs must match a registered URI exactly. A metadata-document URL must be HTTPS on a public hostname with a path and no port, fragment or credentials. Client assertions for `private_key_jwt` are single-use.

### Authorization codes

- Authorization code flow with PKCE `S256` only, and an explicit `resource` parameter identifying the MCP endpoint.
- Codes expire after five minutes and are consumed atomically with grant creation. Neither a replay nor revoking the resulting grant makes a code reusable.
- Authorization responses include the RFC 9207 `iss` parameter.
- Declining a validated request navigates to the exact registered redirect URI with `error=access_denied` and the original `state`. Invalid requests never produce an external callback.

### Token endpoint

- Supports the `authorization_code` and `refresh_token` grant types.
- Request bodies are limited to 16,384 bytes while streaming, including requests without a reliable `Content-Length`.
- Signing configuration is prepared and validated **before** a code is consumed. Missing, malformed or undersized RSA keys return `503 server_error` without exchanging the code; retry after fixing the server. Signing errors are never reported as `invalid_grant`.

### Tokens

| Token              | Lifetime | Notes                                                                                                              |
| ------------------ | -------- | ------------------------------------------------------------------------------------------------------------------ |
| Access token       | 1 hour   | RS256 JWT identifying the user, grant, issuer, MCP resource audience and approved scopes. Not a Convex credential. |
| Refresh token      | 60 days  | Opaque, stored only as a hash, rotated on every use. Rejected once the grant is revoked or the user is deleted.    |
| Backend credential | 1 minute | Audience `finapp-mcp-backend`, created by the web server for its Convex calls. Never returned to the client.       |

The MCP endpoint rejects backend credentials, and Convex rejects client-facing access tokens. Convex trusts only the `finapp-mcp-backend` audience from the MCP issuer.

### Discovery

| Document                      | Path                                                                                    |
| ----------------------------- | --------------------------------------------------------------------------------------- |
| Authorization server metadata | `/.well-known/oauth-authorization-server` and `/.well-known/openid-configuration`       |
| Protected resource metadata   | `/.well-known/oauth-protected-resource/mcp` and `/.well-known/oauth-protected-resource` |
| Public keys                   | `/.well-known/jwks.json`                                                                |

An unauthenticated `POST /mcp` returns `401` with a `WWW-Authenticate` header that points to the protected-resource metadata.

## What MCP never exposes

Passwords, verification flows, two-factor and other sign-in security changes, app-lock secrets, media attachments and push-device registration are not available as tools. See [Security and privacy](/guide/security) for managing those in the app.
