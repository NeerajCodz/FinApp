# FinApp

## Landing and authentication

The public web landing page lives at `/` and renders without a Convex deployment URL.
Its black-and-volt layout includes an interactive sample spending preview, savings and
shared-money sections, FAQs, and an interactive 3D WebGPU coin. `/welcome`, `/sign-in`,
and `/sign-up` retain the app's authentication entry points; these routes require
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

### Coin implementation

- `packages/ui/src/coin/geometry.ts`: volt faces, a beveled/reeded edge, shallow
  circular grooves, and an F-shaped cavity with a chamfered inner bevel. Earcut
  removes the letter from each face; its dark floor sits below the beveled rim.
- `packages/ui/src/coin/renderer.ts`: shared WebGL / Expo GLView renderer with
  interactive rotation and cursor- or touch-responsive lighting.
- `apps/web/components/brand/createVgpuCoinRenderer.ts`: WebGPU lighting and a
  cursor-responsive shadow masked behind the coin silhouette, with the shared
  WebGL renderer as a fallback.
- Platform `CoinLogo` components support pointer drag and arrow-key rotation on
  web, touch drag on native, and stop animation for reduced motion or when hidden.
  They dispose GPU resources on teardown and retain the app icon when WebGL is
  unavailable.

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
