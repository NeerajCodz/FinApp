# Versioning

FinApp has four independently versioned components plus a product version that names a set of
components that shipped together.

| Component | Version lives in                | Released by                  |
| --------- | ------------------------------- | ---------------------------- |
| Product   | `version.json` → `version`      | a release (tags `finapp-vX`) |
| Web       | `components.web`                | Vercel production deploy     |
| Mobile    | `components.mobile` + `build.*` | EAS build / store submission |
| UI        | `components.ui`                 | used by web and mobile       |
| Backend   | `components.backend`            | `bunx convex deploy`         |

`version.json` is the **only** file edited by hand (or by the scripts). Everything else is
generated and checked in CI (`bun run version:check`):

- root and package `package.json` versions
- `apps/mobile/app.json` version, `android.versionCode`, `ios.buildNumber` (and `app.config.js`
  reads `version.json` directly at build time)
- `convex/shared/version.ts` — `PRODUCT_VERSION`, `COMPONENT_VERSIONS`, `BUILD_NUMBERS`,
  `BACKEND_INFO`
- `releases/v<product>.json` — archive of what shipped together, with its tags

## Day to day

```sh
bunx changeset                       # in a PR: which packages changed, patch/minor/major
bun run version:bump backend minor   # backend changes (not a workspace package)
```

## Cutting a release

```sh
bun run version:release              # apply changesets → adopt into version.json → regenerate
bun run version:bump product minor   # name the product release
bun run version:build android        # only when shipping a new store build without a version bump
```

Merge to `main`. The **Release** workflow tags `finapp-v…`, `web-v…`, `mobile-v…`, `ui-v…`,
`backend-v…` and publishes a GitHub release from the `CHANGELOG.md` section.

## SemVer rules

| Change                                    | Bump  |
| ----------------------------------------- | ----- |
| Bug fix, copy or style fix                | patch |
| New feature, new backward-compatible API  | minor |
| Removed/renamed API, breaking data change | major |

## Backend compatibility

`api.system.info` (and `GET /version` on the Convex site) returns `BACKEND_INFO`:
backend `version`, `apiVersion`, `schemaVersion`, `minimumMobileVersion`, `minimumWebVersion`.

- Mobile builds older than `minimumMobileVersion` show an **Update** notice.
- Web tabs older than `minimumWebVersion` show a **Reload** banner.
- Raise `apiVersion` for breaking client/server contract changes and `schemaVersion` for
  database shape changes; prefer backward-compatible, staged migrations (a backend rollback
  does not undo a migration).

The About screens (web `/about`, mobile About) list every version, the build, commit and
environment, with a diagnostics copy/share action for support.
