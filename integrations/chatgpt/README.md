# Finapp for ChatGPT

The ChatGPT app/plugin package for the Finapp MCP server (`https://fin.neeraj.fyi/mcp`).
Zip the contents of this folder (`plugin.json`, `mcp.json`, `assets/`) to upload it.

## Authentication: every registration method works

The authorization server (`https://fin.neeraj.fyi`) advertises all of these in
`/.well-known/oauth-authorization-server` (also served at `/.well-known/openid-configuration`):

| ChatGPT setting                                   | What to enter                                                                                                                                                                                                                                                |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **CIMD** (recommended; the default in `mcp.json`) | Nothing. Finapp fetches and validates ChatGPT's client document and verifies its `private_key_jwt` assertions.                                                                                                                                               |
| **Dynamic Client Registration**                   | Nothing. ChatGPT registers at `/oauth/register`.                                                                                                                                                                                                             |
| **Your client credentials**                       | Create a client on <https://fin.neeraj.fyi/mcp/dashboard> → _OAuth setup_. Paste the client ID and secret, set the token auth method to the one you picked (`client_secret_basic` by default), and add ChatGPT's callback URL to the client's redirect URIs. |

Common to all methods:

- PKCE `S256` and the `resource` parameter (`https://fin.neeraj.fyi/mcp`).
- Refresh tokens (rotating, 60 days).
- RFC 9207 `iss` on every authorization response, so ChatGPT uses its stable callback
  `https://chatgpt.com/connector_platform_oauth_redirect`.

Scopes: `finapp:read` (always requested) plus `finapp:write:finance`, `finapp:write:social`,
`finapp:write:groups` and `finapp:write:personal`.

## Domain verification

Set `OPENAI_APPS_CHALLENGE_TOKEN` in the web app's environment to the token ChatGPT shows. It's
served as plain text at `https://fin.neeraj.fyi/.well-known/openai-apps-challenge`.

## Icons

`assets/logo.png` and `assets/composer-icon.png` are both 1024×1024 PNGs, inside the 48–4096 px
square limit.
