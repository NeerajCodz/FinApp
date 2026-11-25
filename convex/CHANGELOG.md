# Convex backend

Versions are tracked in the root `version.json`; see `docs/versioning.md`.

## 1.6.0

- `audio` message kind with `durationMs`; `groups.sendVoiceMessage`, `directMessages.sendVoice`
- Retention changes applied in batches (`applyMessageRetention`)

## 1.5.0

- FinAI replies record each tool call as `steps` (schema 5)
- Review fixes: payment matrix, unread slots, retry-only interrupted actions

## 1.4.0

Shipped in FinApp 1.4.0. See the root [CHANGELOG](../CHANGELOG.md) for highlights.
