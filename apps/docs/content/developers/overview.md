---
title: API overview
description: What the FinApp REST API is, where it lives and how requests and responses look.
order: 1
---

The FinApp API lets your own scripts and third-party apps read and change FinApp data over HTTPS. It is a JSON REST API versioned under `/api/v1`, and every request runs through the same backend functions the FinApp web and mobile apps use. Validation rules, permissions and side effects (balances, notifications, group ledgers, sync to your devices) are exactly the same as in the app.

## Base URL

The API runs as HTTP actions on your FinApp Convex deployment:

```text
https://<deployment>.convex.site/api/v1
```

The web app also forwards `/api/v1/*` to the same API, so on a hosted FinApp you can use the app's own domain instead:

```text
https://<your-finapp-web>/api/v1
```

Both behave identically. `GET /api/v1` returns the version, and `GET /api/v1/openapi.json` returns the full OpenAPI 3.1 description (no authentication needed). The [API reference](/api-reference) on this site is generated from the same source.

## Authentication at a glance

Every endpoint except the two above needs a bearer token:

```http
Authorization: Bearer fa_pat_…
```

| Token                 | Prefix    | Who uses it                                         | How you get it                                          |
| --------------------- | --------- | --------------------------------------------------- | ------------------------------------------------------- |
| Personal access token | `fa_pat_` | You, for your own scripts and integrations          | **Settings → API & developer → Personal access tokens** |
| OAuth access token    | `fa_oat_` | A third-party app acting for a user who approved it | The [OAuth 2.1 flow](/developers/oauth-apps)            |

Each token carries [scopes](/developers/scopes), such as `transactions:read` or `accounts:write`. See [Authentication](/developers/authentication).

## Your first request

:::tabs

```bash title="curl"
curl https://<deployment>.convex.site/api/v1/me \
  -H "Authorization: Bearer $FINAPP_TOKEN"
```

```javascript title="JavaScript"
const response = await fetch('https://<deployment>.convex.site/api/v1/me', {
  headers: { Authorization: `Bearer ${process.env.FINAPP_TOKEN}` },
});
const { data } = await response.json();
console.log(data.displayName, data.defaultCurrency);
```

```python title="Python"
import os
import requests

response = requests.get(
    "https://<deployment>.convex.site/api/v1/me",
    headers={"Authorization": f"Bearer {os.environ['FINAPP_TOKEN']}"},
)
response.raise_for_status()
print(response.json()["data"])
```

:::

The token needs the `profile:read` scope for `/me`.

## Requests and responses

- Request bodies are JSON (`Content-Type: application/json`) and at most 256 KB.
- Single objects come back as `{ "data": { … } }`.
- Lists come back as `{ "data": [ … ], "hasMore": true, "nextCursor": "…" }`. See [Pagination](/developers/pagination).
- Errors always have the same shape: `{ "error": { "code", "message", "requestId", … } }`. See [Errors](/developers/errors).
- Unknown query parameters are rejected with `400`, so a typo can't quietly widen a listing.

### Money and time

- **Amounts are integer strings in minor units.** `"12550"` is 125.50 INR or USD. Fields that hold money end in `Minor` (`amountMinor`, `openingBalanceMinor`, `limitMinor`). Never send floats; the API rejects them.
- **Currencies** are ISO 4217 codes (`"INR"`, `"usd"` is accepted and upper-cased). A transaction's currency must match its account's currency.
- **Times** are Unix epoch milliseconds (`occurredAt: 1764288000000`).
- **IDs** are opaque strings. Don't parse them.

## Resources

| Resource                  | Read scope           | Write scope          | Endpoints                                   |
| ------------------------- | -------------------- | -------------------- | ------------------------------------------- |
| Profile                   | `profile:read`       | —                    | `/me`                                       |
| Accounts                  | `accounts:read`      | `accounts:write`     | `/accounts`                                 |
| Transactions              | `transactions:read`  | `transactions:write` | `/transactions`                             |
| Categories                | `categories:read`    | `categories:write`   | `/categories`                               |
| Budgets (category limits) | `budgets:read`       | `budgets:write`      | `/budgets`                                  |
| Goals                     | `goals:read`         | `goals:write`        | `/goals`, `/goal-contributions`             |
| Groups                    | `groups:read`        | `groups:write`       | `/groups`, members, balances                |
| Splits and settlements    | `splits:read`        | `splits:write`       | group expenses, `/expenses`, `/settlements` |
| Recurring rules           | `recurring:read`     | `recurring:write`    | `/recurring`                                |
| Notifications             | `notifications:read` | —                    | `/notifications`                            |
| Analytics                 | `analytics:read`     | —                    | `/analytics/summary`                        |
| Export                    | `export:read`        | —                    | `/export/{resource}`                        |
| Webhooks                  | `webhooks:manage`    | `webhooks:manage`    | `/webhooks`                                 |

Budgets are FinApp's monthly **category limits**: the API exposes them as `/budgets/{categoryId}`.

## Behaviour you can rely on

- **Same rules as the app.** The API never bypasses ownership or group permission checks. A token for one account can't see another user's records: they come back as `404`.
- **Idempotent writes.** Send an `Idempotency-Key` header on `POST` requests to make retries safe. See [Idempotency](/developers/idempotency).
- **Rate limits** are per token: a burst of 120 requests, refilling at 2 per second. See [Rate limits](/developers/rate-limits).
- **Every response** has an `X-Request-Id` header. Quote it when you report a problem.
- **CORS** is open (`Access-Control-Allow-Origin: *`) because authentication is by bearer token only, never cookies. Don't ship a personal access token in a public web page.
- **Webhooks** push changes to you instead of polling. See [Webhooks](/developers/webhooks).

## What the API doesn't cover (yet)

The API focuses on money data. Friends, direct messages, group chat, FinAI, receipts and the app's security settings (2FA, devices) are available in the apps and, for AI assistants, through [MCP](/mcp/overview), but not through `/api/v1`.
