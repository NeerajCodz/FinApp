# Finapp MCP guide

Finapp exposes a remote Model Context Protocol (MCP) server from the Next.js web
app. AI clients call domain-specific tools, and the server communicates with the
Convex backend as the signed-in user. A client connection requires explicit
OAuth consent; signing into Finapp alone does not grant access.

## Routes and workspace

| Route                                       | Purpose                                                                 |
| ------------------------------------------- | ----------------------------------------------------------------------- |
| `/mcp`                                      | Stateless Streamable HTTP MCP endpoint; send JSON-RPC with `POST`.      |
| `/mcp/status`                               | Public, data-free health JSON used by the dashboard's live status.      |
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

`/mcp` is the API endpoint. A browser that opens it (a `GET` whose `Accept`
includes `text/html`) is redirected with `303` to `/mcp/dashboard`, so the
connector URL people paste is also a friendly landing page. Every other `GET`
and `DELETE` keeps the spec's `405` with `Allow: POST, OPTIONS`. The server does
not maintain MCP sessions or provide a long-lived SSE stream.

### Connect a client

The connector URL is the full endpoint, for example `https://fin.neeraj.fyi/mcp`.
The dashboard's **Connect** tab shows these steps with copy buttons and a live
server status check (tool count, widget count, response time).

**ChatGPT** (plans and workspace admins may restrict custom connectors):

1. Settings → **Apps & Connectors** → **Advanced settings** → enable
   **Developer mode**.
2. In Apps & Connectors choose **Create**, name it `FinApp`, paste the connector
   URL and keep authentication on **OAuth**.
3. ChatGPT opens FinApp: sign in, review permissions, approve.
4. In a new chat open **+** → **Developer mode** and enable FinApp. Try “Show my
   FinApp overview”.

**Claude** (web and desktop; on Team/Enterprise an owner adds it first):

1. Settings → **Connectors** → **Add custom connector**.
2. Name it `FinApp`, paste the connector URL and leave the OAuth client fields
   empty (FinApp supports dynamic client registration).
3. Select **Connect**, sign in to FinApp and approve.
4. Enable FinApp from the tools menu in the message box.

**Other MCP clients:** add a remote Streamable HTTP server; the client must
support MCP authorization (OAuth 2.1, dynamic registration, PKCE `S256`).

During consent, read access is required and write permissions start unchecked.
Approve only what you intend to grant. In a conversation the model discovers
tools with `finapp.catalog`.

Do not paste the server's signing keys into a client. Registering a client is
not an endorsement by Finapp; connect only clients you recognize and trust.

### Manage connections

- **Connect:** step-by-step ChatGPT/Claude/other guides with copy buttons, and
  a live server status card backed by `/mcp/status`.
- **Tools:** the full tool catalog (generated from the server registry, so it
  cannot drift) with search, domain and read/write filters, required scope,
  confirmation and widget badges.
- **In-chat widgets:** live previews of every widget, rendering the real widget
  HTML in a sandboxed iframe with fictional sample data.
- **Permissions:** sign in to review active grants (signed-out visitors see a
  clear sign-in prompt instead of data). Include revoked grants to
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

The token endpoint prepares and validates its signing configuration before
consuming a code. Missing, malformed, or undersized RSA keys return
`503 server_error` without exchanging the code; retry after correcting the
server configuration. Signing errors are not reported as `invalid_grant`.

Client-facing access tokens use RS256, expire after one hour, and identify the
user, grant, issuer, MCP resource audience, and approved scopes. They are not
Convex credentials. After token validation, the server uses a separate,
one-minute JWT with audience `finapp-mcp-backend` for its Convex calls. That
credential is never returned to the client; MCP rejects backend tokens, and
Convex rejects client-facing MCP tokens. The current implementation does not
issue refresh tokens; the client must reauthorize when necessary.

Declining a validated request uses non-prefetching navigation to the exact
registered client redirect URI with `error=access_denied` and the original
`state`. Invalid requests never produce an external denial callback.

| Scope                   | Access through MCP                                                                                                                                                                                    |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `finapp:read`           | Every read tool: overview, transaction search/detail, accounts, categories, budgets, goals, analytics, groups, balances, history, people, messages, profile. Required.                                |
| `finapp:write:finance`  | Create/update/delete personal transactions (with line items), accounts, categories and limits, budgets, goals and contributions, recurring rules.                                                     |
| `finapp:write:social`   | Send/answer/cancel friend requests, start conversations, send direct messages, reactions and pins.                                                                                                    |
| `finapp:write:groups`   | Create/update groups, invitations and links, member roles/removal, leave, add/edit/delete expenses, late joiners, record/undo settlements, payment reminders, group chat (messages, pins, reactions). |
| `finapp:write:personal` | Profile, default account/category, notification preferences, mark one/all notifications read, privacy.                                                                                                |

The endpoint validates the token and active grant before dispatch. Convex checks
record ownership and group/conversation membership. Tool annotations describe
read-only, destructive, and idempotency characteristics, but annotations are not
a substitute for the server's scope checks or the user's approval.

Allowed browser origins include the canonical resource origin, ChatGPT/Claude
origins, local MCP Inspector origins on port 6274, and explicitly configured
origins. Browser origins are not credentials. Requests still require a valid
token and grant.

## Tool discovery and feature coverage

The registry (`apps/web/lib/mcp/tools/*`) is the single source of truth:
`finapp.catalog`, the four `finapp.<domain>.parent` tools, the
`finapp://catalog` resource, `/mcp/status` and the dashboard catalog are all
generated from it. It currently holds `finapp.catalog`, 4 parents and 97 domain
tools (102 total).

Good starting points: `finapp.finance.overview`,
`finapp.finance.transactions.list`, `finapp.groups.list` →
`finapp.groups.balances`.

#### Finance

| Tool                                     | Purpose                            | Scope         | Notes                      |
| ---------------------------------------- | ---------------------------------- | ------------- | -------------------------- |
| `finapp.finance.overview`                | Financial overview                 | read          | widget: Financial overview |
| `finapp.finance.transactions.list`       | Search transactions                | read          | widget: Transactions       |
| `finapp.finance.transactions.get`        | Get transaction                    | read          | widget: Expense detail     |
| `finapp.finance.transactions.create`     | Create transaction                 | write:finance |                            |
| `finapp.finance.transactions.update`     | Update transaction                 | write:finance |                            |
| `finapp.finance.transactions.delete`     | Delete transaction                 | write:finance | confirm: true              |
| `finapp.finance.accounts.list`           | List accounts                      | read          |                            |
| `finapp.finance.accounts.get`            | Get account                        | read          |                            |
| `finapp.finance.accounts.create`         | Create account                     | write:finance |                            |
| `finapp.finance.accounts.rename`         | Rename account                     | write:finance |                            |
| `finapp.finance.accounts.update`         | Update account details             | write:finance |                            |
| `finapp.finance.accounts.archive`        | Archive account                    | write:finance | confirm: true              |
| `finapp.finance.categories.list`         | List categories                    | read          |                            |
| `finapp.finance.categories.get`          | Get category                       | read          |                            |
| `finapp.finance.categories.create`       | Create category                    | write:finance |                            |
| `finapp.finance.categories.rename`       | Rename category                    | write:finance |                            |
| `finapp.finance.categories.update`       | Update category preferences        | write:finance |                            |
| `finapp.finance.categories.set_limit`    | Set category monthly limit         | write:finance |                            |
| `finapp.finance.categories.archive`      | Archive category                   | write:finance | confirm: true              |
| `finapp.finance.budgets.list`            | List budgets with progress         | read          |                            |
| `finapp.finance.budgets.get`             | Get budget                         | read          |                            |
| `finapp.finance.budgets.create`          | Create budget                      | write:finance |                            |
| `finapp.finance.budgets.update`          | Update budget                      | write:finance |                            |
| `finapp.finance.budgets.archive`         | Archive budget                     | write:finance | confirm: true              |
| `finapp.finance.goals.list`              | List savings goals                 | read          |                            |
| `finapp.finance.goals.create`            | Create savings goal                | write:finance |                            |
| `finapp.finance.goals.update`            | Update savings goal                | write:finance |                            |
| `finapp.finance.goals.contribute`        | Contribute to goal                 | write:finance |                            |
| `finapp.finance.goals.archive`           | Archive savings goal               | write:finance | confirm: true              |
| `finapp.finance.goal_contributions.list` | List goal contributions            | read          |                            |
| `finapp.finance.recurring.list`          | List recurring rules               | read          |                            |
| `finapp.finance.recurring.create`        | Create recurring rule              | write:finance |                            |
| `finapp.finance.recurring.set_enabled`   | Pause or resume recurring rule     | write:finance |                            |
| `finapp.finance.analytics.summary`       | Spending analytics                 | read          |                            |
| `finapp.finance.dashboard.summary`       | Summarize one page of transactions | read          |                            |

#### Groups

| Tool                                     | Purpose                       | Scope        | Notes                  |
| ---------------------------------------- | ----------------------------- | ------------ | ---------------------- |
| `finapp.groups.list`                     | List my groups                | read         |                        |
| `finapp.groups.detail.get`               | Get group                     | read         |                        |
| `finapp.groups.create`                   | Create group                  | write:groups |                        |
| `finapp.groups.update`                   | Update group settings         | write:groups |                        |
| `finapp.groups.members.list`             | List group members            | read         |                        |
| `finapp.groups.members.invite`           | Invite member                 | write:groups |                        |
| `finapp.groups.members.set_role`         | Change member role            | write:groups |                        |
| `finapp.groups.members.remove`           | Remove member                 | write:groups | confirm: true          |
| `finapp.groups.leave`                    | Leave group                   | write:groups | confirm: true          |
| `finapp.groups.invitations.list`         | List my group invitations     | read         |                        |
| `finapp.groups.invitations.respond`      | Respond to group invitation   | write:groups |                        |
| `finapp.groups.invitation_links.create`  | Create invitation link        | write:groups |                        |
| `finapp.groups.invitation_links.revoke`  | Revoke invitation link        | write:groups | confirm: true          |
| `finapp.groups.invitation_links.preview` | Preview invitation link       | read         |                        |
| `finapp.groups.invitation_links.join`    | Join with invitation link     | write:groups |                        |
| `finapp.groups.balances`                 | Group balances                | read         | widget: Group balances |
| `finapp.groups.settle_up.prepare`        | Prepare settle-up             | read         | widget: Settle up      |
| `finapp.groups.nudge`                    | Send payment reminder         | write:groups |                        |
| `finapp.groups.expenses.list`            | List group expenses           | read         | widget: Transactions   |
| `finapp.groups.expenses.get`             | Get group expense             | read         | widget: Expense detail |
| `finapp.groups.expenses.history`         | Expense history               | read         |                        |
| `finapp.groups.expenses.create`          | Add group expense             | write:groups |                        |
| `finapp.groups.expenses.update`          | Edit group expense            | write:groups |                        |
| `finapp.groups.expenses.delete`          | Delete group expense          | write:groups | confirm: true          |
| `finapp.groups.expenses.add_members`     | Add late joiners to expenses  | write:groups |                        |
| `finapp.groups.settlements.list`         | List settlements              | read         |                        |
| `finapp.groups.settlements.create`       | Record settlement             | write:groups |                        |
| `finapp.groups.settlements.delete`       | Undo settlement               | write:groups | confirm: true          |
| `finapp.groups.messages.list`            | List group messages           | read         |                        |
| `finapp.groups.messages.send`            | Send group message            | write:groups |                        |
| `finapp.groups.messages.pinned`          | Pinned group messages         | read         |                        |
| `finapp.groups.messages.pin`             | Pin or unpin group message    | write:groups |                        |
| `finapp.groups.messages.react`           | React to group message        | write:groups |                        |
| `finapp.groups.unread_counts`            | Unread group chats            | read         |                        |
| `finapp.groups.shared_history`           | Shared expenses with a person | read         |                        |

#### Social

| Tool                                               | Purpose                     | Scope        | Notes |
| -------------------------------------------------- | --------------------------- | ------------ | ----- |
| `finapp.social.friends.list`                       | List friends                | read         |       |
| `finapp.social.requests.list`                      | List friend requests        | read         |       |
| `finapp.social.people.search`                      | Search people               | read         |       |
| `finapp.social.people.get`                         | Get person                  | read         |       |
| `finapp.social.people.suggestions`                 | Friend suggestions          | read         |       |
| `finapp.social.people.frequent`                    | Frequent people             | read         |       |
| `finapp.social.requests.send`                      | Send friend request         | write:social |       |
| `finapp.social.requests.respond`                   | Respond to friend request   | write:social |       |
| `finapp.social.requests.cancel`                    | Cancel friend request       | write:social |       |
| `finapp.social.direct_messages.conversations.list` | List conversations          | read         |       |
| `finapp.social.direct_messages.list`               | List direct messages        | read         |       |
| `finapp.social.direct_messages.start`              | Start conversation          | write:social |       |
| `finapp.social.direct_messages.send`               | Send direct message         | write:social |       |
| `finapp.social.direct_messages.react`              | React to message            | write:social |       |
| `finapp.social.direct_messages.pinned`             | Pinned direct messages      | read         |       |
| `finapp.social.direct_messages.pin`                | Pin or unpin direct message | write:social |       |

#### Personal

| Tool                                               | Purpose                         | Scope          | Notes |
| -------------------------------------------------- | ------------------------------- | -------------- | ----- |
| `finapp.personal.profile.get`                      | Get my profile                  | read           |       |
| `finapp.personal.profile.update`                   | Update profile                  | write:personal |       |
| `finapp.personal.default_account.set`              | Set default account             | write:personal |       |
| `finapp.personal.default_category.set`             | Set default category            | write:personal |       |
| `finapp.personal.notifications.list`               | List notifications              | read           |       |
| `finapp.personal.notifications.mark_read`          | Mark notification read          | write:personal |       |
| `finapp.personal.notifications.mark_all_read`      | Mark all notifications read     | write:personal |       |
| `finapp.personal.notifications.preferences.update` | Update notification preferences | write:personal |       |
| `finapp.personal.privacy.get`                      | Get privacy settings            | read           |       |
| `finapp.personal.privacy.update`                   | Update privacy settings         | write:personal |       |
| `finapp.personal.security.get`                     | Get security status             | read           |       |

Push-notification device registration is client-only and intentionally not a
tool. There is no bulk data-export endpoint in the backend, so none is exposed;
page through the list tools instead. Attachments, sign-in security changes and
app-lock secrets are not exposed.

### Results and money

Every tool returns `structuredContent.data` plus a text block (a one-line
summary for key tools, followed by the JSON) so clients without UI support get
the same information. Amounts stay exact: each `<name>Minor` integer string
(for example `amountMinor: "12550"`) gets a sibling `<name>Formatted` display
string in the nearest currency (`"₹125.50"`). Send amounts back as minor-unit
strings; never floats. Currencies with zero or three decimals are handled.

Errors return `isError: true`, text `CODE: guidance`, and
`structuredContent.error` `{ code, message, data? }`. Examples:
`MISSING_SCOPE`, `TRANSACTION_CHANGED` (re-read the expense and retry with the
new `expectedVersion`), `OUTSTANDING_BALANCE` (includes the formatted balance;
settle up before leaving or removing a member), `ITEMS_TOTAL_MISMATCH`,
`NOTHING_OWED`.

### Line items

`finapp.finance.transactions.create/update` and
`finapp.groups.expenses.create/update` accept optional `items`:
`[{ id?, title, amountMinor, quantity?, participantIds? }]`. On updates, omit
`items` to keep the current ones or pass `[]` to clear them. Item amounts must
sum exactly to `amountMinor` (checked locally, then by Convex) or the call fails
with `ITEMS_TOTAL_MISMATCH`. Omitted ids are generated; keep ids when editing.
A group split with method `itemized` shares each item equally among its
`participantIds` (empty = every participant) and needs non-empty `items`.
Transaction and expense outputs include `items`, and transaction
search also matches item titles.

### Group expenses

`finapp.groups.expenses.get` returns payers, each participant's share, items
and the `version`. Pass that as `expectedVersion` to `expenses.update` (which
also accepts `payers`) or `expenses.delete`. `expenses.history` returns the
audit trail; `expenses.add_members` includes late joiners;
`settlements.delete` undoes a settlement; `groups.nudge` sends a payment
reminder (once per member per day).

### In-chat widgets (MCP Apps)

Five widgets follow the MCP Apps extension (`io.modelcontextprotocol/ui`,
spec 2026-01-26), which both Claude and ChatGPT implement:

| Widget             | Resource URI                         | Tools                                                                |
| ------------------ | ------------------------------------ | -------------------------------------------------------------------- |
| Financial overview | `ui://finapp/overview.v1.html`       | `finapp.finance.overview`                                            |
| Transactions       | `ui://finapp/transactions.v1.html`   | `finapp.finance.transactions.list`, `finapp.groups.expenses.list`    |
| Group balances     | `ui://finapp/group-balances.v1.html` | `finapp.groups.balances` (Remind / Settle up actions)                |
| Expense detail     | `ui://finapp/expense.v1.html`        | `finapp.finance.transactions.get`, `finapp.groups.expenses.get`      |
| Settle up          | `ui://finapp/settle-up.v1.html`      | `finapp.groups.settle_up.prepare` (records via `settlements.create`) |

- Tools declare `_meta.ui.resourceUri` plus the ChatGPT alias
  `_meta["openai/outputTemplate"]` and `openai/toolInvocation/*` status text.
- Resources are served as `text/html;profile=mcp-app` with
  `_meta.ui.csp` (empty `connectDomains`/`resourceDomains`) and
  `prefersBorder`, plus the legacy `openai/widgetCSP` mirror.
- Widgets are single self-contained HTML documents: inline CSS/JS, no network
  access, no fonts or CDNs, no secrets. Data arrives only through the host
  bridge (`ui/initialize` → `ui/notifications/tool-result`); action buttons call
  tools through `tools/call`, so the normal OAuth scopes still apply (a
  read-only grant cannot record a settlement). `window.openai` globals are a
  fallback. User text is rendered with `textContent`, never `innerHTML`.
- Theme follows the host's `hostContext.theme` (or `window.openai.theme`,
  falling back to `prefers-color-scheme`); the palette is FinApp's (volt
  `#B7FF4A` accent on dark, Space Grotesk fallback stack), defined once as CSS
  variables in `apps/web/lib/mcp/widgets/runtime.ts`.
- Bump the `vN` in a URI after breaking template changes; hosts cache by URI.

### Bounded reads

- Default list limit: 25. Maximum page size: 100. Pass `nextCursor` back as
  `cursor` with the same filters; stop when `isDone` is true. A filtered page may
  hold fewer rows (even zero) and still return a cursor.
- Times are Unix epoch **milliseconds**: `startAt` inclusive, `endAt` exclusive,
  at most 366 days. Transaction search defaults to the last 30 days, group
  ledgers to the last 90 days.
- Transaction search filters: `accountId`, `categoryId`, `type`,
  `minAmountMinor`/`maxAmountMinor`, and `search` (title, merchant, note, item
  titles).

### Writes

Supply a UUID `clientMutationId` and reuse it when retrying the same logical
write (one is generated otherwise). Destructive tools (deletes, archives,
leaving a group, removing a member, undoing a settlement, revoking a link)
require `confirm: true` and are annotated `destructiveHint`; obtain the user's
approval first.

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
bun run --cwd apps/web test ../../tests/web/mcp-http.test.ts ../../tests/web/mcp-plugin.test.ts
```

`mcp-plugin.test.ts` covers the tool list and catalog accuracy, scope
enforcement, schema validation, error mapping, line-item forwarding, widget
resources, the browser redirect and `/mcp/status`.

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
| Opening `/mcp` gives `405`                 | Only non-HTML `GET`s get `405`; browsers are redirected to `/mcp/dashboard`.                                                               |
| Widget shows only text                     | The client does not support MCP Apps; the text and `structuredContent` carry the same data.                                                |
| `invalid_client`                           | Client registration and exact return URI matching. Restart connection after changing client metadata.                                      |
| `invalid_target` / token `invalid_request` | Exact `resource` URL, including `/mcp`, must agree with discovery and both deployments.                                                    |
| `invalid_grant`                            | Expired/consumed code, wrong verifier, client ID, or redirect URI. Restart authorization; do not reuse the code.                           |
| Missing write scope                        | Reconnect and explicitly approve the relevant requested permission.                                                                        |
| Empty results with a cursor                | Continue the same bounded query; filtering can reduce an individual page to zero results.                                                  |
| Web deployment is green, MCP still fails   | Convex needs its own schema/function/auth deployment and matching environment.                                                             |

## Implementation map and references

- `apps/web/app/mcp/route.ts`: protected Streamable HTTP transport.
- `apps/web/lib/mcp/server.ts`: registration, catalog/parents, scope checks, errors.
- `apps/web/lib/mcp/tools/`: tool definitions per domain (zod schemas, Convex calls).
- `apps/web/lib/mcp/toolkit.ts`, `money.ts`, `errors.ts`: shared schemas, line
  items, money formatting, error mapping.
- `apps/web/lib/mcp/widgets/`: MCP Apps widget HTML/runtime and resources.
- `apps/web/app/mcp/status/route.ts`: public status JSON.
- `apps/web/lib/mcp/oauth.ts`: issuer/resource helpers, JWTs, JWKS, Convex client.
- `apps/web/app/oauth/` and `apps/web/app/.well-known/`: OAuth/discovery endpoints.
- `convex/mcp.ts`: authenticated, bounded read projections (incl. transaction detail).
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
- [MCP Apps overview](https://modelcontextprotocol.io/extensions/apps/overview) and
  [specification](https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/2026-01-26/apps.mdx)
- [ChatGPT Apps SDK: UI](https://developers.openai.com/apps-sdk)
