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

Account creation asks for email and password, followed by email verification. It
does not offer or submit a two-factor enrollment option. Onboarding retains display
name, username, and gender selection, with a live profile preview that reflects the
entered name and selected avatar.

Profile details are edited at `/profile/edit` on web and native, reachable from
both the Profile page and Settings. Profile name, username, phone, and avatar edits
use the existing offline-first sync flow. Notification and sync actions live in the
home header; they are not repeated across other screens.

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
The goals overview gives first-time users an illustrated empty state and a single creation action; dropdown menus use opaque themed surfaces.

The Activity page's right rail provides Add transaction, Transactions, and
Analytics actions. The web sidebar shows the signed-in profile name and avatar
at the bottom.

Account and category creation use `/accounts/new` and `/categories/new`.
Transactions use `/transactions`, `/transaction/new`, `/transaction/:id`, and
`/transaction/:id/edit`; recurring rules use `/recurring` and
`/recurring/:recurringId`. Goals use `/goals`, `/goals/new`, and
`/goals/:id[/edit|/analytics]`.

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
contribute shared expenses, chat and share bill images, and record settlements. Group balances
are shown only when the complete group ledger is available; unsupported
scheduled settlements are not inferred.

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

The public `/about` page and the About rows in Settings and Profile show version
`v1.0.0` and link the developer credit to GitHub.

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
