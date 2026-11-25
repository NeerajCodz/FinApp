# Convex backend

Versions are tracked in the root `version.json`; see `docs/versioning.md`.

## 1.9.0

- `finaiSettings` (`ai.settings.get/update/clearHistory`) applied to prompts, tools, mentions and
  receipt categorisation
- BYOK: `aiProviderKeys` (AES-256-GCM, `AI_KEYS_SECRET`), `ai.keys.*`, provider adapters for
  OpenAI-compatible, Anthropic and Gemini APIs with tool calling

## 1.8.0

- MCP OAuth: client registration kinds (`dcr` / `static` / `cimd`), token endpoint auth methods,
  hashed client secrets, `resolveClient` (CIMD fetch and validation),
  `exchangeWithClientAssertion` / `refreshWithClientAssertion`, rotating refresh tokens,
  `mcpOAuthAssertionJtis`

## 1.7.1

- `users.publicProfile` includes the user id

## 1.7.0

- `social.peopleHub` and `social.personAnalytics`

## 1.6.0

- `audio` message kind with `durationMs`; `groups.sendVoiceMessage`, `directMessages.sendVoice`
- Retention changes applied in batches (`applyMessageRetention`)

## 1.5.0

- FinAI replies record each tool call as `steps` (schema 5)
- Review fixes: payment matrix, unread slots, retry-only interrupted actions

## 1.4.0

Shipped in FinApp 1.4.0. See the root [CHANGELOG](../CHANGELOG.md) for highlights.
