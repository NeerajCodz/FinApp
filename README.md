# FinApp

## Landing and authentication

The public web landing page lives at `/` and renders without a Convex deployment URL.
Its black-and-volt layout includes an interactive sample spending preview, savings and
shared-money sections, FAQs, and a final-section WebGL coin. `/welcome`, `/sign-in`,
and `/sign-up` retain the app's authentication entry points; these routes require
`NEXT_PUBLIC_CONVEX_URL` in `apps/web/.env.local`.

Web and mobile authentication use a scoped dark theme without changing the user's
saved appearance preference. Mobile forms use a keyboard-aware scrollable scaffold,
password visibility controls, and responsive verification-code fields.

Account creation asks for email and password, followed by email verification. It
does not offer or submit a two-factor enrollment option. Onboarding retains display
name, username, gender, and avatar selection from the current application.

Profile details are edited at `/profile/edit` on web and native, reachable from
both the Profile page and Settings. Profile name, username, phone, and avatar edits
use the existing offline-first sync flow. Notification and sync actions live in the
home header; they are not repeated across other screens.

### Coin implementation

- `packages/ui/src/coin/geometry.ts`: flat volt faces, a thin beveled/reeded edge,
  shallow circular grooves, and a recessed black F. Earcut triangulates the face
  around the engraving rather than drawing a letter on top of an uncut face.
- `packages/ui/src/coin/renderer.ts`: shared browser WebGL / Expo GLView renderer
  with a fixed pose. Its only animated transform is vertical translation.
- `packages/ui/src/coin/motion.ts`: Anime.js object animation sampled by each
  platform's rendering loop; no DOM dependency or global engine modification.
- Platform `CoinLogo` components stop animation for reduced motion and when hidden
  or unfocused, dispose GPU resources on teardown, and retain the existing app icon
  when WebGL is unavailable.

The native coin requires a build containing `expo-gl`.

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
