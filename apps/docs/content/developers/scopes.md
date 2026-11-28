---
title: Scopes
description: The fine-grained permissions a token or app can hold, and which endpoints need them.
order: 4
---

Scopes limit what a token can do. They are fine-grained: read or write, per resource. Pick the fewest your integration needs.

## The scopes

| Scope                | Allows                                                                           |
| -------------------- | -------------------------------------------------------------------------------- |
| `profile:read`       | Read your profile (name, username, default currency, timezone, default account). |
| `accounts:read`      | List and read accounts and balances.                                             |
| `accounts:write`     | Create, update and archive accounts.                                             |
| `transactions:read`  | List, search and read transactions.                                              |
| `transactions:write` | Create, update and delete transactions.                                          |
| `categories:read`    | List and read categories.                                                        |
| `categories:write`   | Create, update and archive categories.                                           |
| `budgets:read`       | Read category limits (budgets) and this month's spending.                        |
| `budgets:write`      | Set or remove category limits.                                                   |
| `goals:read`         | List goals and contributions.                                                    |
| `goals:write`        | Create, update, archive and contribute to goals.                                 |
| `groups:read`        | List your groups, their members and balances.                                    |
| `groups:write`       | Create groups.                                                                   |
| `splits:read`        | Read shared group expenses and settlements.                                      |
| `splits:write`       | Add or delete shared expenses; record or undo settlements.                       |
| `recurring:read`     | List recurring rules.                                                            |
| `recurring:write`    | Create, pause, resume and delete recurring rules.                                |
| `notifications:read` | List your notifications.                                                         |
| `analytics:read`     | Read spending and income analytics.                                              |
| `export:read`        | Export raw records you own.                                                      |
| `webhooks:manage`    | Create, change and delete webhook endpoints and read their delivery logs.        |

## Rules

- **Write implies read** for the same resource: a token with `transactions:write` can also call `transactions:read` endpoints. Nothing else is implied: `transactions:write` does not grant `accounts:read`.
- **Unknown scopes are rejected**, never silently dropped.
- **Scopes never widen permissions.** Even with `splits:write`, deleting a group expense still requires being its creator or a group admin, exactly as in the app.
- The required scope for each endpoint is listed in the [API reference](/api-reference) and in the OpenAPI document as `x-required-scope` and under the `oauth2` security requirement.

## Scopes for OAuth apps

An app registers its **maximum scopes**. In the authorization request it can ask for any subset (or all of them by omitting `scope`). The user can then untick any of them on the consent screen. The token response's `scope` field lists what was actually granted.

If you narrow your app's maximum scopes later, existing authorizations lose the removed scopes on their next request.

## Webhooks and scopes

Endpoints created with a personal access token or in Settings receive any event you subscribe them to. Endpoints created **by an OAuth app** only receive events the app's authorization can read: for example `transaction.*` events require `transactions:read`, `settlement.*` requires `splits:read` and `budget.*` requires `budgets:read`. If the user disconnects the app, its endpoints stop receiving events.
