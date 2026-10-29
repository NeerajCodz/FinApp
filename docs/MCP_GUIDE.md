# Finapp MCP guide

Finapp exposes a remote Model Context Protocol (MCP) server from the Next.js web
app. AI clients call domain-specific tools, and the server communicates with the
Convex backend as the signed-in user. A client connection requires explicit
OAuth consent; signing into Finapp alone does not grant access.

## Routes and workspace

| Route                                       | Purpose                                                                 |
| ------------------------------------------- | ----------------------------------------------------------------------- |
| `/mcp`                                      | Stateless Streamable HTTP MCP endpoint; send JSON-RPC with `POST`.      |
| `/mcp/dashboard`                            | Connect, Explore tools, Permissions, and Activity workspace.            |
| `/mcp/login`                                | Finapp sign-in with MCP-specific context and return-path handling.      |
| `/mcp/authorize`                            | Review the registered client, return destination, and requested scopes. |
| `/oauth/register`                           | Dynamic registration for public OAuth clients.                          |
| `/oauth/authorize`                          | Validate the authorization request and redirect to consent.             |
| `/oauth/token`                              | Exchange a single-use authorization code and PKCE verifier for a token. |
| `/.well-known/oauth-authorization-server`   | OAuth server discovery.                                                 |
| `/.well-known/oauth-protected-resource/mcp` | Path-specific protected-resource discovery.                             |
| `/.well-known/oauth-protected-resource`     | Protected-resource discovery at the origin root.                        |
| `/.well-known/jwks.json`                    | Public signing keys; never contains a private key.                      |

`/mcp` is an API, not a browser landing page. A configured server returns `405`
for `GET` and `DELETE`; use `/mcp/dashboard` in a browser. It does not maintain
MCP sessions or provide a long-lived SSE stream.

### Connect a client

1. Open `/mcp/dashboard` and choose ChatGPT, Claude, or another remote MCP client.
2. Follow the linked client guide. Product plans and workspace administrators may
   limit custom integrations or write tools.
3. Add the full public endpoint, such as `https://your-finapp.example/mcp`.
4. Let the client open Finapp's OAuth flow. Sign in to Finapp, not to a form that
   asks you to paste your password into the AI client.
5. Check the client name and return destination. Read access is required;
   requested write permissions start unchecked.
6. Approve only the permissions you intend to grant. Start with read-only access.
7. In the AI conversation, discover tools with `finapp.catalog`, then inspect the
   relevant parent before retrieving records.

Do not paste the server's signing keys into a client. Registering a client is
not an endorsement by Finapp; connect only clients you recognize and trust.

### Manage connections

- **Connect:** client-specific setup instructions and a copyable server URL.
- **Explore tools:** search feature domains, inspect parent names and filters,
  and copy a parent tool or example prompt without reading account data.
- **Permissions:** sign in to review active grants. Include revoked grants to
  inspect history. Revoking a grant rejects subsequent MCP requests using it;
  an already-running request may finish.
- **Activity:** filter recent tool names and outcomes by domain, time, and
  success/failure. At most 100 recent events are retained per account, and the
  view returns at most 50 matching events. Arguments and financial results are
  not recorded. Activity recording is best-effort and is not a complete audit
  ledger.

A grant indicates authorization, not a currently connected client session.

## Deployment configuration

Use one canonical public HTTPS origin for the production MCP issuer and
resource. Keep preview and production configuration separate. The issuer must
match between the web app and Convex; the client-facing resource audience must
remain distinct from the backend-only audience. A successful hosting build
does not prove that OAuth or Convex functions are ready.

| Variable                  | Web deployment                                                                                   | Convex deployment                                                                     |
| ------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_CONVEX_URL`  | Required; target Convex deployment URL. Rebuild when changing it.                                | Not used by this integration.                                                         |
| `CONVEX_SITE_URL`         | Existing authentication setup may use its own related settings.                                  | Required by the existing Convex auth provider; preserve the correct deployment value. |
| `MCP_ISSUER_URL`          | Required; canonical web HTTPS origin, no route path.                                             | Required to enable the MCP JWT provider; use the same issuer.                         |
| `MCP_RESOURCE_URL`        | Recommended explicit value: `https://your-finapp.example/mcp`. Defaults to `/mcp` on the issuer. | Not used by the Convex provider; its backend-only audience is fixed separately.       |
| `MCP_SIGNING_KEY_ID`      | Required stable key ID, also exposed as JWKS `kid`.                                              | Not required.                                                                         |
| `MCP_SIGNING_PRIVATE_KEY` | Required PKCS#8 RSA private key; server-only secret.                                             | Not required; do not distribute the private key.                                      |
| `MCP_SIGNING_PUBLIC_KEY`  | Required SPKI public key matching the private key.                                               | Not required; Convex reads public JWKS from the issuer.                               |
| `MCP_ALLOWED_ORIGINS`     | Optional comma-separated exact browser origins.                                                  | Not required.                                                                         |

The Next server accepts PEM values with real newlines or escaped `\n` sequences.
Use the hosting provider's secret manager; never commit private keys, tokens,
Convex deploy keys, or environment files.

For a new deployment, generate a matching RSA key pair with OpenSSL:

```sh
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:3072 -out mcp-private.pem
openssl pkey -in mcp-private.pem -pubout -out mcp-public.pem
```

Store the private file securely outside the repository. Set the PEM contents,
not file paths, in the web environment. Choose a unique key ID and deploy both
matching keys together. The current server publishes one key; coordinate key
replacement with clients because existing one-hour tokens use the previous key.

### Deployment order

1. Configure the web issuer, resource, key pair, key ID, and Convex URL.
2. Deploy the web app and verify that public JWKS and discovery metadata are
   reachable without hosting-provider login or deployment protection.
3. Configure the same issuer in the target Convex deployment.
4. Deploy the updated Convex schema, functions, and `convex/auth.config.ts` to
   that deployment. The web deployment alone does not deploy these functions.
5. Complete the verification sequence below using a dedicated account.
6. Confirm the production alias targets the intended Git commit, not just a
   successful preview deployment.

When upgrading the original MCP provider, deploy the new Convex auth
configuration before the web cutover. It removes acceptance of client-facing
resource tokens and allows only `finapp-mcp-backend`. A brief MCP interruption
while the web deployment catches up is preferable to leaving the direct-token
bypass active. Existing non-MCP Convex authentication is unchanged.

The existing email/password and email verification/two-factor flow is reused.
This MCP feature does not configure Google, Apple, or other social sign-in
providers. Those require separate identity-provider configuration.

## Authorization contract

The server uses OAuth authorization-code flow with PKCE `S256`, public clients
(`token_endpoint_auth_method: none`), exact registered redirect matching, and an
explicit `resource` parameter identifying the MCP endpoint. Authorization codes
expire after five minutes and are consumed atomically with grant creation;
neither a replay nor revoking the resulting grant can make a code reusable.
Verifiers accept the full RFC 7636 unreserved alphabet at lengths 43–128.
Token request bodies are limited to 16,384 bytes while streaming, including
requests without a reliable `Content-Length`.

Client-facing access tokens use RS256, expire after one hour, and identify the
user, grant, issuer, MCP resource audience, and approved scopes. They are not
Convex credentials. After token validation, the server uses a separate,
one-minute JWT with audience `finapp-mcp-backend` for its Convex calls. That
credential is never returned to the client; MCP rejects backend tokens, and
Convex rejects client-facing MCP tokens. The current implementation does not
issue refresh tokens; the client must reauthorize when necessary.

Declining a validated request returns to the exact registered client redirect
URI with `error=access_denied` and the original `state`. Invalid requests never
produce an external denial callback.

| Scope                   | Access through MCP                                                                                                                            |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `finapp:read`           | Read bounded finance, planning, social, group, profile, notification, and privacy results. Required for a connection.                         |
| `finapp:write:finance`  | Create/update supported finance records, contribute to goals, archive supported entities, and delete personal transactions with confirmation. |
| `finapp:write:social`   | Manage friend requests and start/send direct conversations.                                                                                   |
| `finapp:write:groups`   | Create groups, manage invitations, add expenses/settlements, and send group messages.                                                         |
| `finapp:write:personal` | Update supported profile, privacy/default-account/notification settings and mark notifications read.                                          |

The endpoint validates the token and active grant before dispatch. Convex checks
record ownership and group/conversation membership. Tool annotations describe
read-only, destructive, and idempotency characteristics, but annotations are not
a substitute for the server's scope checks or the user's approval.

Allowed browser origins include the canonical resource origin, ChatGPT/Claude
origins, local MCP Inspector origins on port 6274, and explicitly configured
origins. Browser origins are not credentials. Requests still require a valid
token and grant.

## Tool discovery and feature coverage

The catalog is the source of truth for registered names. The current registry
contains `finapp.catalog`, four parent tools, and 58 domain child tools. The JSON
resource `finapp://catalog` also describes parents, children, and limits.

| Parent                   | Feature domains                                                                                                         |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| `finapp.finance.parent`  | Transactions, accounts, categories, budgets, goals, contributions, recurring rules, dashboard/analytics page summaries. |
| `finapp.social.parent`   | Friends, incoming/outgoing requests, public username search, direct conversations, and direct messages.                 |
| `finapp.groups.parent`   | Joined groups, safe group metadata, members, invitations, expenses, settlements, and messages.                          |
| `finapp.personal.parent` | Profile, default account, privacy preferences, notifications, and notification preferences.                             |

Example prompts:

- “Start with `finapp.finance.parent`. Show my expenses for the last 30 days,
  at most 25 records at a time. Ask before changing anything.”
- “Inspect `finapp.groups.parent` and list up to 25 of my groups. Ask which
  group to inspect before retrieving its expenses.”
- “Inspect `finapp.personal.parent`, explain my privacy settings, and ask before
  changing them.”

### Bounded reads

- Default list limit: 25. Maximum list page size: 100.
- Pass `nextCursor` back as `cursor` to continue; stop when `isDone` is true.
- Keep the same filters while continuing a cursor.
- A filtered page may contain fewer records than requested, including zero,
  while still returning a continuation cursor. Do not treat an empty page as
  proof that there are no later matches.
- Times are Unix epoch **milliseconds**: `startAt` is inclusive, `endAt` exclusive.
- Transactions, group expenses/settlements/messages, direct messages, and
  dashboard/analytics reads require explicit time windows no longer than 366
  days. Read each child's schema for its exact required filters.
- Filters vary by child tool; not every list accepts account/category/search.
- Dashboard and analytics summaries aggregate bounded pages, not an unlimited
  historical ledger. Respect partial/pagination fields before reporting totals.
- Relationship tools may require both indexed sides or lookup modes; follow
  their descriptions rather than assuming one call is a complete result.

For example, `finapp.finance.transactions.list` accepts:

```json
{
  "startAt": 1790812800000,
  "endAt": 1793491200000,
  "type": "expense",
  "limit": 25
}
```

MCP results include text JSON and `structuredContent.data`. Read `items`,
`nextCursor`, and `isDone` inside the returned data for list tools.

### Writes and amounts

Send monetary values as decimal integer strings in minor currency units, such
as `"1250"` for 12.50 in a two-decimal currency. Do not send floating-point major
units. Values must fit signed 64-bit integers and satisfy the child tool's
validation. Do not assume every currency uses two decimals.

Where supported, supply a caller-generated UUID `clientMutationId` and reuse it
for the same retried logical write. Do not invent idempotency guarantees for
mutations without backend receipt support. Destructive transaction deletes and
supported archive tools require `confirm: true`; obtain the user's approval
before supplying confirmation.

Message writes are text-only. Attachments, authentication-security settings,
password/verification flows, and device app-lock secrets are not exposed as AI
tools. The dashboard is a web control plane, not an embedded MCP Apps UI
resource. The server currently exposes tools and a JSON resource, not MCP Apps
HTML or every internal Convex function.

## Verify a deployment

Use the exact deployed URL. Discovery/JWKS must not redirect to a Vercel login
screen. Replace `https://your-finapp.example` in these examples:

```sh
curl -i https://your-finapp.example/.well-known/oauth-protected-resource/mcp
curl -i https://your-finapp.example/.well-known/oauth-authorization-server
curl -i https://your-finapp.example/.well-known/jwks.json
curl -i -X POST https://your-finapp.example/mcp -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" --data '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-25","capabilities":{},"clientInfo":{"name":"deployment-check","version":"1.0.0"}}}'
```

Expected evidence:

1. Dashboard and login render on desktop and mobile; invalid consent requests
   show a recoverable error without approving access.
2. Discovery returns JSON with the intended issuer/resource and endpoint URLs.
3. JWKS returns only a public RSA key matching the deployed signing key ID.
4. Unauthenticated MCP `POST` returns `401` and a `WWW-Authenticate` header
   pointing to protected-resource metadata. This alone does **not** prove an
   authorized tool call works.
5. With MCP Inspector or a supported client, complete registration, login,
   consent, and token exchange. Confirm initialization and `tools/list` work.
6. Call `finapp.catalog`, a domain parent, and a bounded read using a dedicated
   account. Verify the next cursor, filters, and timestamp boundaries.
7. A read-only grant must reject a finance write tool. Verify isolation using
   separately owned records and group membership without mutating production
   financial data.
8. Revoke the grant from Permissions; its next MCP request should be rejected.
9. Observe tool activity without arguments or result data being recorded.

A production deployment is not fully verified until the authenticated steps
pass against its intended Convex backend. Do not substitute fixture-based UI
checks or an in-memory MCP test for a real OAuth/Convex deployment test.

For the HTTP dispatch regression check from the repository root:

```sh
bun run --cwd apps/web test ../../tests/web/mcp-http.test.ts
```

This test uses the real MCP HTTP client/transport with an isolated authorization
fixture. It catches an endpoint that never connects its MCP server to the
transport, and checks missing-token/revoked-grant rejection. It does not verify
production credentials or database records.

## Troubleshooting

| Symptom                                    | Check                                                                                                                                      |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `503 server_not_configured` from `/mcp`    | Missing/invalid issuer or resource URL in the web environment; redeploy after fixing it.                                                   |
| Metadata/JWKS request fails                | Web environment, matching PEM keys/key ID, and deployment protection; inspect provider logs without exposing secrets.                      |
| MCP `POST` returns `401`                   | Token expiry, issuer/audience, required read scope, revoked grant, user deletion, Convex JWT configuration, and deployed functions/schema. |
| `403 Forbidden origin`                     | Exact browser origin and `MCP_ALLOWED_ORIGINS`; do not solve by disabling authentication.                                                  |
| Opening `/mcp` gives `405`                 | Expected for browser `GET`; use `/mcp/dashboard` for the UI.                                                                               |
| `invalid_client`                           | Client registration and exact return URI matching. Restart connection after changing client metadata.                                      |
| `invalid_target` / token `invalid_request` | Exact `resource` URL, including `/mcp`, must agree with discovery and both deployments.                                                    |
| `invalid_grant`                            | Expired/consumed code, wrong verifier, client ID, or redirect URI. Restart authorization; do not reuse the code.                           |
| Missing write scope                        | Reconnect and explicitly approve the relevant requested permission.                                                                        |
| Empty results with a cursor                | Continue the same bounded query; filtering can reduce an individual page to zero results.                                                  |
| Web deployment is green, MCP still fails   | Convex needs its own schema/function/auth deployment and matching environment.                                                             |

## Implementation map and references

- `apps/web/app/mcp/route.ts`: protected Streamable HTTP transport.
- `apps/web/lib/mcp/server.ts`: tool schemas, parent catalog, and scope checks.
- `apps/web/lib/mcp/oauth.ts`: issuer/resource helpers, JWTs, JWKS, Convex client.
- `apps/web/app/oauth/` and `apps/web/app/.well-known/`: OAuth/discovery endpoints.
- `convex/mcp.ts`: authenticated, bounded read projections.
- `convex/mcpOAuth.ts`: client registration, authorization codes, grants, activity.
- `convex/auth.config.ts`: existing auth and MCP custom-JWT provider.
- `packages/ui/src/mcp/`: interactive shared workspace components.
- `apps/web/app/mcp/`: dashboard, login, consent, and auth styles.

Official references:

- [MCP authorization specification](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization)
- [MCP transports](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports)
- [ChatGPT custom MCP connections](https://help.openai.com/en/articles/12584461-connecting-custom-mcp-servers-in-chatgpt)
- [Claude remote MCP connectors](https://support.claude.com/en/articles/11175166-getting-started-with-custom-connectors-using-remote-mcp)
- [Convex custom JWT authentication](https://docs.convex.dev/auth/advanced/custom-jwt)
