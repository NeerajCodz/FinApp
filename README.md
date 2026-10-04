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

The web Groups page also includes joined groups from the authenticated membership query when an
existing browser's local group cache is incomplete.

### People and messaging

The People tab on mobile combines friend discovery, incoming and outgoing requests,
direct conversations, and existing group management. Web exposes `/people` alongside
the Groups workspace. Public `/@username` profiles expose safe identity fields without
sign-in; shared group activity appears only when both the profile owner and viewer are
active members of that group.

Accepted friends can start direct conversations from People or a profile. Direct and
group chats use dedicated chat screens with image attachments, live typing and presence
indicators, and participant-scoped read receipts. Settings expose controls for showing
active status and last-seen time; hiding active status also hides typing indicators.

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

The native and web About screens show `v1.1.5` with the centered 3D `CoinLogo` and a
GitHub developer link. Native coin drift uses browser-independent math, avoiding the
Android startup error `ReferenceError: document is not defined`; GPU-unavailable
surfaces use the app icon fallback.
The Finapp wordmark and “Back in your corner” tagline appear on sign-in and sign-up,
alongside the public web landing page and signed-in Home surfaces. Welcome uses a centered
interactive 3D coin; About uses the centered interactive coin. Privacy and other screens
omit the wordmark.
Mobile Activity links directly to Analytics and Transactions.
The Convex deployment exposes `GET /version`, returning `{ "version": "v1.1.5" }`.
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
