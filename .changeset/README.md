# Changesets

Every PR that changes shipped behaviour adds a changeset:

```sh
bunx changeset          # pick @finapp/web, @finapp/mobile and/or @finapp/ui, then patch/minor/major
```

The Convex backend is not a workspace package, so bump it in `version.json` directly:

```sh
bun run version:bump backend minor
```

To cut a release, run `bun run version:release`. It applies the pending changesets (versions and
CHANGELOGs), copies the new versions into `version.json`, and regenerates
`app.json` and `convex/shared/version.ts`. Shipped manifests are attached to each GitHub release as `version.json`. See `docs/versioning.md`.
