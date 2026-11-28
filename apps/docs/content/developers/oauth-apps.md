---
title: OAuth apps
description: Register an app and let any FinApp user connect it with OAuth 2.1, PKCE and rotating refresh tokens.
order: 3
---

If you're building something other people will use, register an **OAuth app**. Users approve your app on a FinApp consent screen, choose which of its requested permissions to grant, and can disconnect it at any time. Your app never sees their password.

FinApp implements the OAuth 2.1 **authorization code flow with PKCE (S256)**. PKCE is required for every app, including confidential ones.

## Register an app

In **Settings → API & developer → Your OAuth apps**, choose **Register an app** and fill in:

| Field             | Notes                                                                                                                                                        |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Name              | Shown on the consent screen (up to 80 characters).                                                                                                           |
| Description       | Optional, up to 300 characters, shown on the consent screen.                                                                                                 |
| Logo URL, website | Optional, HTTPS only.                                                                                                                                        |
| Redirect URIs     | One per line, up to 12. HTTPS, or `http://localhost` / `127.0.0.1` for development. No fragments. The `redirect_uri` in each request must match one exactly. |
| Client type       | **Confidential** for server-side apps (gets a client secret) or **Public** for mobile and single-page apps (PKCE only, no secret).                           |
| Maximum scopes    | The most your app may ever request. Narrowing this later also narrows every existing authorization.                                                          |

You get a **client ID** (`fa_app_` + 24 hex characters) and, for confidential apps, a **client secret** (`fa_cs_…`) shown once. You can rotate the secret (the old one stops working immediately) or delete the app (every user's connection ends). Each account can register up to 10 apps.

## Endpoints

These live on the FinApp **web app's** domain (the same authorization server that serves MCP clients):

| Endpoint               | Purpose                                                         |
| ---------------------- | --------------------------------------------------------------- |
| `GET /oauth/authorize` | Starts authorization; redirects the user to the consent screen. |
| `POST /oauth/token`    | Exchanges a code, or refreshes tokens.                          |
| `POST /oauth/revoke`   | Revokes a token (RFC 7009).                                     |

## Walkthrough

### 1. Create a PKCE verifier and challenge

:::tabs

```javascript title="JavaScript"
import { createHash, randomBytes } from 'node:crypto';

const codeVerifier = randomBytes(32).toString('base64url'); // 43 characters
const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');
const state = randomBytes(16).toString('base64url');
```

```python title="Python"
import base64, hashlib, secrets

code_verifier = secrets.token_urlsafe(32)  # 43 characters
code_challenge = base64.urlsafe_b64encode(
    hashlib.sha256(code_verifier.encode()).digest()
).rstrip(b"=").decode()
state = secrets.token_urlsafe(16)
```

:::

Keep `codeVerifier` and `state` in the user's session.

### 2. Send the user to the authorize endpoint

```text
https://<your-finapp-web>/oauth/authorize
  ?response_type=code
  &client_id=fa_app_0123456789abcdef01234567
  &redirect_uri=https%3A%2F%2Fapp.example.com%2Fcallback
  &scope=profile%3Aread%20transactions%3Aread
  &state=<state>
  &code_challenge=<codeChallenge>
  &code_challenge_method=S256
```

- `scope` is space-separated and must be within your app's maximum scopes. Omit it to request all of them.
- `state` is required (up to 1024 characters).

The user signs in if needed and sees your app's name, logo, description, developer, redirect address and each requested scope. **Read scopes start selected, write scopes start off**, and the user may grant fewer than you asked for.

### 3. Handle the callback

On approval FinApp redirects to your `redirect_uri` with `code`, your `state` and `iss` (the issuer, RFC 9207). Check that `state` matches. If the user declines you get `error=access_denied`. Codes expire after **5 minutes** and work once.

### 4. Exchange the code

:::tabs

```bash title="curl"
curl -X POST https://<your-finapp-web>/oauth/token \
  -u "$CLIENT_ID:$CLIENT_SECRET" \
  -d grant_type=authorization_code \
  -d code="$CODE" \
  -d redirect_uri=https://app.example.com/callback \
  -d code_verifier="$CODE_VERIFIER"
```

```javascript title="JavaScript"
const response = await fetch('https://<your-finapp-web>/oauth/token', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
  },
  body: new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: 'https://app.example.com/callback',
    code_verifier: codeVerifier,
  }),
});
const tokens = await response.json();
```

```python title="Python"
import requests

tokens = requests.post(
    "https://<your-finapp-web>/oauth/token",
    auth=(client_id, client_secret),
    data={
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": "https://app.example.com/callback",
        "code_verifier": code_verifier,
    },
).json()
```

:::

Confidential apps authenticate with HTTP Basic (`client_secret_basic`) or with `client_id` and `client_secret` form fields (`client_secret_post`). Public apps send only `client_id`. The response:

```json
{
  "access_token": "fa_oat_…",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "fa_ort_…",
  "scope": "profile:read transactions:read"
}
```

`scope` is what the user actually granted. Check it before calling endpoints that need more.

### 5. Call the API

```bash
curl https://<deployment>.convex.site/api/v1/transactions \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

### 6. Refresh

Access tokens last an hour. Refresh before or after they expire:

```bash
curl -X POST https://<your-finapp-web>/oauth/token \
  -u "$CLIENT_ID:$CLIENT_SECRET" \
  -d grant_type=refresh_token \
  -d refresh_token="$REFRESH_TOKEN"
```

Each refresh returns a **new** access token and a **new** refresh token, and the previous access token stops working. Store the new refresh token every time.

:::warning
Refresh tokens are single-use. If an old refresh token is presented again, FinApp treats it as a sign the token leaked and **revokes the whole authorization**. The user must approve your app again. Make sure only one process refreshes at a time.
:::

### 7. Revoke

```bash
curl -X POST https://<your-finapp-web>/oauth/revoke \
  -u "$CLIENT_ID:$CLIENT_SECRET" \
  -d token="$REFRESH_TOKEN"
```

Revoking either token ends the authorization. The endpoint returns `200` even for unknown tokens.

## Errors

The token endpoint uses standard OAuth error codes: `invalid_request`, `invalid_client` (`401`, wrong or missing credentials), `invalid_grant` (expired, used or mismatched code, wrong verifier, or an invalid refresh token) and `unsupported_grant_type`. The authorize endpoint reports `invalid_client` directly (it never redirects to an unregistered address) and redirects with `invalid_request`, `invalid_scope` or `unsupported_response_type` otherwise.

## What users see

- A notification "New app connected" when they approve an app.
- **Settings → API & developer → Connected apps** lists each app with its scopes, when it was connected and last used, and a **Disconnect** button.
- Their activity log records the connection and every request your app makes (method, route, status).

## MCP clients

AI assistants that speak MCP (ChatGPT, Claude) use the same `/oauth/*` endpoints with their own client registration and `finapp:*` scopes. That flow is described in [Connecting MCP clients](/mcp/connecting). API apps and MCP clients don't share tokens.
