# FinApp

## Landing and authentication

The public web landing page lives at `/` and renders without a Convex deployment URL.
Its black-and-volt layout features an interactive sample spending preview, savings
and shared-money sections, FAQs, and an interactive 3D WebGPU coin in the closing section.
`/welcome`, `/sign-in`, and `/sign-up` retain the app's authentication entry points; these routes require
`NEXT_PUBLIC_CONVEX_URL` in `apps/web/.env.local`.

Web and mobile authentication use a scoped dark theme without changing the user's
saved appearance preference. Mobile forms use a keyboard-aware scrollable scaffold,
password visibility controls, and responsive verification-code fields.

Verification, password-reset, email sign-in, and app-lock reset messages use the same
responsive black-and-volt email layout with Finapp’s inline PNG mark. Each message includes
purpose-specific safety guidance and a six-digit code that expires in ten minutes.

Account creation asks for email and password, followed by email verification. It
does not offer or submit a two-factor enrollment option. Onboarding retains display
name, username, and gender selection, with a live profile preview that reflects the
entered name and selected avatar.

Profile details are edited at `/profile/edit` on web and native, reachable from
both the Profile page and Settings. Profile name, phone, and avatar edits use the existing
offline-first sync flow. Username changes require a live Convex connection and stay unchanged
offline. Notification and sync actions live in the home header; they are not repeated across
other screens.

The 101 built-in avatars ship as transparent 384px, 192px, and 96px WebP variants
under `assets/avatar/{high,medium,low}`. Run `bun run generate:avatars` to rebuild
them from the source PNGs; native and web components select high above 64px,
medium above 32px, and low at 32px or below. `bun run cleanup:avatar-storage`
removes only storage objects referenced by the built-in catalog and preserves
user-uploaded profile photos and other Convex Storage objects.

An unverified existing account returns to email verification, then completes
onboarding before entering the app. Group-invitation links keep their destination
through sign-in, verification, and onboarding.

### Finance workspaces

Finance screens are shared from `packages/ui/src/finance`, with separate web and
native presentations. Account and category editors, transaction forms and details,
recurring-payment views, goal editors and analytics, budget views, and group
experiences use the apps' live Convex/offline-first records.
Shared entity pickers provide popup color palettes with custom hue and hex controls,
emoji skin-tone choices, and compact Lucide/Phosphor icon grids across web and native.
Page-specific illustrated empty states cover finance, activity, analytics, groups,
notifications, and goal workflows on both web and native. Shared states distinguish
no data from loading, error, and unavailable conditions.

The Activity page's right rail provides Add transaction, Transactions, and
Analytics actions. The web sidebar shows the signed-in profile name and avatar
at the bottom.

Account and category creation use `/accounts/new` and `/categories/new`.
Transactions use `/transactions`, `/transaction/new`, `/transaction/:id`, and
`/transaction/:id/edit`; recurring rules use `/recurring` and
`/recurring/:recurringId`. Goals use `/goals`, `/goals/new`, and
`/goals/:id[/edit|/analytics]`.
Personal transactions can be soft-deleted from their detail page or selected
in batches from the Transactions list on web and mobile; local deletions sync
through the offline-first flow. New transactions prefer an account matching the
profile's default currency before falling back to the configured account.
Creation actions remain pending and block duplicate submissions while writes
are in progress.
Transfer forms explain when no other account in the selected currency can receive
a transfer, with an account-creation action on both web and native.

On narrow screens, analytics charts with long ranges scroll within their panel,
and category creation stays inside the viewport.

Budgets use `/budgets` and `/budgets/new`; an individual budget uses
`/budget/:id`, `/budget/:id/edit`, and `/budget/:id/analytics`. Budget details
and analytics derive merchant, account, category, daily, and forecast summaries
from posted expenses. Forecasts use only transactions dated through the current
time; future-dated expenses remain visible in full-period totals. Groups use
`/groups`, `/groups/new`, `/group/:id`, `/group/:id/edit`, `/group/:id/chat`,
and `/group/:id/new`. Incoming invitations can be accepted or declined from the
Groups inbox or directly from their notification. Group metadata, settings,
member management, and invitation-link creation are admin-only. Public
`/group/invite?token=...` links show a safe group preview, require sign-in before explicit
acceptance, and expire after a configurable 1, 7 (default), or 30 days; generating another link
invalidates the previous one, and admins can revoke links at any time. Accepted members can
contribute shared expenses, chat and share bill images, and record settlements. Group balances are
shown only when the complete group ledger is available; integer minor-unit values saved as safe
numbers or integer strings are normalized without guessing missing splits. Async buttons remain
pending until their action settles to prevent duplicate submissions. Unsupported scheduled
settlements are not inferred.
Personal-finance changes and supported group-ledger writes persist to the local database and
durable sync outbox before they are sent to the server. They remain visible offline and replay
when connected. Group invitations, membership and role changes, chat and bill uploads, username
lookup, authentication, and server-managed security controls require a live connection; device
app-lock controls remain local.

Installed native builds keep the existing SQLCipher database. Expo Go cannot load SQLCipher, so its
SQLite connection stays in memory and v1.3.0 stores project-scoped AES-256-GCM-authenticated
snapshots using an encryption key held in SecureStore. Existing plaintext Expo Go databases are
encrypted before the source file is removed; unreadable or unauthenticated data fails closed.

To preview in Expo Go over WAN, run `bunx expo start --go --tunnel` from `apps/mobile`; Expo CLI and Expo Go must be signed into the same account, and the development server must stay online. Expo Go skips device notification handlers and scheduling because SDK 57's notifications package attempts unsupported push registration at import time. New native EAS builds include `expo-updates`, use the app-version runtime and the `production` channel; publish compatible JavaScript/assets with `npx eas-cli@latest update --channel production --environment production --message "<message>"`. EAS Updates do not load in Expo Go, which continues to use Metro. Native builds retain SQLCipher.

Web Groups and mobile Groups/Home screens also include joined groups from the authenticated
membership query when the local group cache is incomplete.

### People and messaging

The People & Groups Home screen on mobile links to dedicated People and Groups workspaces.
Mobile and web People pages support friend discovery, username search, incoming and outgoing
requests, and recent conversations. Requests and group invitations are managed from a popup;
suggestion lists surface mutual friend counts. Public `/@username` profiles expose safe identity
fields without sign-in; shared group activity appears only when both the profile owner and viewer
are active members of that group.

Profile links use `/@username` on both web and mobile. Legacy web `/user/...` and `/people/...` URLs permanently redirect to this canonical path.

Accepted friends can start direct conversations from People or a profile. Direct and
group chats use dedicated chat screens with image attachments, live typing and presence
indicators, participant-scoped read receipts, and direct-message reactions. Each participant
has one reaction per message; selecting the same reaction removes it, and selecting another
replaces it. Settings expose controls for showing active status and last-seen time; hiding
active status also hides typing indicators.

### MCP integrations

See [the MCP guide](docs/MCP_GUIDE.md) for deployment setup, client connection
steps, tool/filter contracts, verification, and troubleshooting.

The remote Model Context Protocol server is exposed at `/mcp`. The
`/mcp/dashboard` workspace separates client setup, searchable domain exploration
with copyable parent tools/prompts, account permissions, and filtered activity
into keyboard-accessible tabs. Setup guidance covers ChatGPT, Claude, and other
OAuth-capable remote MCP clients. Signed-in users can review active/revoked
grants and revoke access; subsequent MCP requests using that grant are rejected.
`/mcp/login` uses the existing Finapp sign-in flow with integration-specific
context. `/mcp/authorize` separates required read access from optional writes
and shows the registered client and return destination before approval.
OAuth authorization-code + PKCE (S256), dynamic client registration, protected-resource
metadata, and JWKS are available from the web app. ChatGPT and Claude connect as remote MCP
clients; their connection UI and available MCP Apps features vary by product, plan, and
workspace configuration.
Configure the following values in the web deployment:

- `MCP_ISSUER_URL`: canonical public HTTPS origin of the web app.
- `MCP_RESOURCE_URL`: `https://<web-origin>/mcp`.
- `MCP_SIGNING_KEY_ID`: stable key identifier used in JWT headers and JWKS.
- `MCP_SIGNING_PRIVATE_KEY` and `MCP_SIGNING_PUBLIC_KEY`: matching RS256 PEM
  key pair. Store the private key only in the server environment; never commit it.
- `MCP_ALLOWED_ORIGINS`: optional comma-separated browser origins for additional
  MCP clients. ChatGPT and Claude origins are allowed by default.

Set `MCP_ISSUER_URL` and `MCP_RESOURCE_URL` in the Convex deployment environment
as well, then deploy the updated Convex auth configuration and schema. Its MCP
JWT provider validates the resource URL as the token audience. MCP access tokens
are user-scoped, expire after one hour, and carry explicit `finapp:read`,
`finapp:write:finance`, `finapp:write:social`, `finapp:write:groups`, and
`finapp:write:personal` scopes. The consent screen grants read access by
default; each write scope is opt-in.

Call `finapp.catalog` first, then the matching `finapp.{finance,social,groups,personal}.parent`
tool. List operations use cursors and a maximum page size of 100. Transaction,
group expense, settlement, message, dashboard, and analytics reads require a
date window no longer than 366 days; dashboard and analytics summaries report
page-level totals until all cursors are consumed. Group membership and ownership
are checked in Convex for each request. Read tools return safe projections, not
database documents. Amounts sent to write tools are decimal integer strings in
minor currency units; mutation tools accept caller-generated UUID idempotency
keys where the backend supports mutation receipts.

MCP message writes are text-only; media attachments, password/verification
flows, app-lock secrets, and authentication-security controls are not exposed
as AI tools. The dashboard keeps at most 100 recent tool names/outcomes per
account for its filterable activity view; tool arguments and result data are
never recorded.

The MCP dashboard is a web control plane, not an embedded MCP Apps UI resource.
The server currently exposes tools and the JSON capability resource
`finapp://catalog`; clients that support MCP Apps can continue to use the
tool-only integration.

### Coin implementation

- `packages/ui/src/coin/geometry.ts`: volt faces, a beveled/reeded edge, shallow
  circular grooves, and an F-shaped cavity with a chamfered inner bevel. Earcut
  removes the letter from each face; its dark floor sits below the beveled rim.
- `packages/ui/src/coin/renderer.ts`: shared WebGL / Expo GLView renderer with
  interactive rotation and cursor- or touch-responsive lighting.
- `apps/web/components/brand/createVgpuCoinRenderer.ts`: WebGPU lighting and a
  cursor-responsive shadow masked behind the coin silhouette, with the shared
  WebGL renderer as a fallback.
- Platform `CoinLogo` components support drag-to-spin with release momentum that
  eases to rest, plus arrow-key rotation on web. They respect reduced motion and
  visibility, dispose GPU resources on teardown, and retain the app icon fallback.

The native coin requires a build containing `expo-gl`.

The native and web About screens show `v1.3.0` with the centered 3D `CoinLogo` and a
GitHub developer link. Native coin drift uses browser-independent math, avoiding the
Android startup error `ReferenceError: document is not defined`; GPU-unavailable
surfaces use the app icon fallback.
Native sign-in and sign-up use the Finapp wordmark and “Back in your corner” tagline. Web
sign-in and sign-up show an interactive 3D coin above the “Less noise. More clarity.” story.
The web welcome page pairs that story and local lifestyle photography with an interactive coin and
direct create-account/sign-in actions. The native welcome and About screens use the centered
interactive 3D coin. Privacy and other screens omit the wordmark.
Mobile Activity links directly to Analytics and Transactions.
The Convex deployment exposes `GET /version`, returning `{ "version": "v1.3.0" }`.
The About rows in Settings and Profile open those screens.
On mobile, the shared navigation header is shown only on Home.

### Development

```sh
bun install
bun run dev:web
bun run typecheck
bun run build:web
```

Landing photography is stored locally under `apps/web/public/landing`:
[restaurant](https://images.unsplash.com/photo-1517248135467-4c7edcad34c4) and
[mountains](https://images.unsplash.com/photo-1506905925346-21bda4d32df4).
