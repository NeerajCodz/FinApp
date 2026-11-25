# Convex backend

Versions are tracked in the root `version.json`; see `docs/versioning.md`.

## 1.10.1

- `mfa`: TOTP authenticator apps (secret encrypted with the key vault, replay protection) and
  hashed single-use recovery codes; enrollment actions; security notifications
- Sign-in: `requestEmailTwoFactor` returns the available methods and skips the email when an
  authenticator app is on; `sendTwoFactorEmailCode`; `twoFactorVerification` accepts
  `method: totp | email | recovery`
- QR codes as SVG paths from qrcode's core encoder

## 1.10.0

- Trash: list, restore with companions, purge with cascades, empty, daily retention purge;
  category delete with transactions; recurring delete
- Friend and MCP-connection notifications; consistent notification copy
- FinAI management tools and confirmed actions (create, edit, delete, restore, purge); bulk
  spreadsheet import (`transaction.import`)
- FinAI streaming: non-blocking 80ms live writes; connect, first-chunk and idle timeouts; thought
  summaries; stall retry; lite fallback model; background reply state (`ai.assistant.activity`,
  `markRead`)
- `finaiAttachments` (10MB images, PDFs, xlsx/csv/tsv, text), inline model input, BYOK media
  parts, retention setting with hourly purge
- MCP access policy (`mcpSettings`, per-grant scopes) enforced by the MCP server
- `security`: discoverability and friend-request controls, sign-in alerts, `sessionDevices` with
  sign out per device or everywhere else, account deletion requests

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
