---
title: Authentication
description: Personal access tokens, OAuth access tokens and how the API checks them.
order: 2
---

Every API request (except `GET /api/v1` and `GET /api/v1/openapi.json`) needs a bearer token in the `Authorization` header. There are two kinds.

## Personal access tokens

A personal access token (PAT) acts as **you**, limited to the scopes you pick. Use one for your own scripts, spreadsheets, home automations or server-side integrations.

### Create a token

1. Open **Settings → API & developer** in the FinApp web app.
2. Under **Personal access tokens**, choose **New token**.
3. Give it a name (up to 80 characters), choose when it expires and tick the [scopes](/developers/scopes) it needs.
4. Copy the token. It looks like `fa_pat_` followed by 43 characters and is **shown only once**.

| Expiry option       | Meaning                                    |
| ------------------- | ------------------------------------------ |
| In 7, 30 or 90 days | Stops working after that many days.        |
| On a date           | Any date from tomorrow up to a year ahead. |
| Never               | Works until you revoke it.                 |

You can have up to 25 active tokens. Revoked and expired tokens don't count.

:::warning
Treat tokens like passwords. Don't commit them to source control or put them in client-side JavaScript. FinApp stores only a SHA-256 hash of each token, so a lost token can't be shown again: regenerate it instead.
:::

### Manage tokens

The token list shows each token's prefix (for example `fa_pat_Ab3x…`), scopes, creation date, expiry, and when it was **last used**. Next to "last used" you'll see a short fingerprint of the caller's network address. It is a salted hash, not the address itself, so you can notice a token being used from somewhere new without FinApp storing IP addresses.

- **Regenerate** issues a new secret for the same token (same name and scopes, expiry restarted from today). The old value stops working immediately.
- **Revoke** disables the token immediately.

## OAuth access tokens

Third-party apps never see a user's password or personal tokens. Instead the user approves the app on a FinApp consent screen and the app receives:

- an **access token** (`fa_oat_…`) valid for **1 hour**, and
- a **refresh token** (`fa_ort_…`) valid for **90 days**, which is replaced on every use.

The app sends the access token exactly like a PAT:

```http
Authorization: Bearer fa_oat_…
```

See [OAuth apps](/developers/oauth-apps) for registering an app and the full PKCE walkthrough.

## What the API checks on every request

1. The header has the form `Bearer <token>` and the token has a known prefix.
2. The token's SHA-256 digest matches a stored token (compared in constant time).
3. The token isn't revoked or expired; for OAuth tokens, the user hasn't disconnected the app and the app still exists.
4. The account is active. Tokens of deleted or suspended accounts stop working.
5. The token has the scope the endpoint requires.
6. The token's [rate-limit bucket](/developers/rate-limits) has room.

After that the request runs as the token's owner, through the same permission checks as the app. A token can never do more than its owner could do in the app.

## Failures

| Status | `error.code`         | Meaning                                                                                                                   |
| ------ | -------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `401`  | `unauthorized`       | No token, unknown token, revoked, expired, or the account can't use the API. The response has `WWW-Authenticate: Bearer`. |
| `403`  | `insufficient_scope` | The token is valid but lacks the scope. `error.requiredScope` names it.                                                   |
| `429`  | `rate_limited`       | Too many requests. Wait `Retry-After` seconds.                                                                            |

```json
{
  "error": {
    "code": "insufficient_scope",
    "message": "This token is missing the 'transactions:read' scope.",
    "requestId": "req_5f0c…",
    "requiredScope": "transactions:read"
  }
}
```

## Developer activity

**Settings → API & developer → Activity** lists the last 30 days of token and app usage: tokens created, regenerated or revoked, apps connected or disconnected, webhook changes, and each API request's method, route template (for example `/transactions/{transactionId}`) and status code. Request bodies, query strings, tokens and IP addresses are never logged.
