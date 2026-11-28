---
title: Troubleshooting
description: Common MCP connection, OAuth and tool errors and what to check for each.
order: 6
---

Start with the dashboard's live status at `/mcp/dashboard` (or `GET /mcp/status`). It reports whether the server is online, degraded, unreachable or not configured, along with tool and widget counts and response time.

## Connection and OAuth

| Symptom                                     | Check                                                                                                                                                                                     |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `503 server_not_configured` from `/mcp`     | The issuer or resource URL is missing or invalid in the web environment. Fix it and redeploy.                                                                                             |
| Metadata or JWKS request fails              | Web environment, matching PEM keys and key ID, and deployment protection. Inspect the hosting logs without exposing secrets.                                                              |
| `503 server_error` from `/oauth/token`      | Signing keys are missing, malformed or under 2048 bits. The code was not consumed; fix the keys and retry.                                                                                |
| MCP `POST` returns `401`                    | Token expiry, issuer and audience, the required read scope, a revoked grant, a deleted user, the Convex JWT configuration (`MCP_ISSUER_URL` on Convex) and deployed functions and schema. |
| `403 Forbidden origin`                      | The exact browser origin and `MCP_ALLOWED_ORIGINS`. Don't work around it by disabling authentication.                                                                                     |
| Opening `/mcp` gives `405`                  | Only non-HTML `GET`s get `405`; browsers are redirected to `/mcp/dashboard`.                                                                                                              |
| `invalid_client`                            | Client registration, client secret or assertion, and exact redirect URI matching. Restart the connection after changing client metadata.                                                  |
| `invalid_target` or token `invalid_request` | The exact `resource` URL, including `/mcp`, must agree with discovery and both deployments.                                                                                               |
| `invalid_grant`                             | Expired or already used code, wrong PKCE verifier, client ID or redirect URI, or an expired, rotated or revoked refresh token. Restart authorization; never reuse a code.                 |
| Web deployment is green but MCP still fails | Convex needs its own schema, function and auth deployment, and a matching `MCP_ISSUER_URL`.                                                                                               |

## Permissions

| Symptom                                                     | Check                                                                                                                          |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `MISSING_SCOPE` on a write                                  | Grant the write scope under **Settings → AI → MCP connections** (tap the app), or reconnect and tick it on the consent screen. |
| A tool says it's blocked, read-only or that deletes are off | An account access control is on. See [Account access controls](/mcp/permissions-and-security#account-access-controls).         |
| Every tool says MCP access is turned off                    | **Allow AI apps** is off in Settings → AI → MCP connections.                                                                   |
| A destructive tool refuses to run                           | Pass `confirm: true`, but only after the user has explicitly agreed.                                                           |

## Tool results

| Symptom                                   | Check                                                                                                                   |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Empty results with a cursor               | Keep paging with the same filters. Filtering can reduce an individual page to zero rows.                                |
| `INVALID_DATE_RANGE` or `INVALID_FILTERS` | `endAt` must be after `startAt`, the window at most 366 days, and `limit` between 1 and 100. Times are in milliseconds. |
| `TRANSACTION_CHANGED`                     | Re-read the expense and retry with the new `expectedVersion`.                                                           |
| `ITEMS_TOTAL_MISMATCH`                    | Line-item amounts must add up exactly to `amountMinor`.                                                                 |
| `OUTSTANDING_BALANCE`                     | Settle up before leaving the group or removing that member.                                                             |
| Amounts look 100 times too big            | They are minor units: `"12550"` means 125.50. Use the `…Formatted` field for display.                                   |
| Widget shows only text                    | The client doesn't support MCP Apps. The text and `structuredContent` carry the same data.                              |

## Still stuck

- Use MCP Inspector (`npx @modelcontextprotocol/inspector`) against the endpoint to see each OAuth and JSON-RPC step. Its local origin on port `6274` is allowed by default.
- Check the dashboard's **Activity** tab for the tool name and whether it succeeded. Arguments and results aren't recorded there.
- See [Deploying the MCP server](/mcp/deployment#verifying-a-deployment) for the full verification checklist.
