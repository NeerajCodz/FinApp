---
title: Tools
description: Every Finapp MCP tool with its scope, plus the conventions for results, money, pagination, writes, line items and in-chat widgets.
order: 3
---

The server registers `finapp.catalog`, one parent tool per domain (`finapp.finance.parent`, `finapp.groups.parent`, `finapp.social.parent`, `finapp.personal.parent`) and 110 domain tools. The lists below are generated from the registry in `packages/mcp/src/tools/*`.

In the tables, **Scope** is the OAuth scope a tool needs (`read` is `finapp:read`, `write:finance` is `finapp:write:finance`, and so on). **needs `confirm`** marks destructive tools that refuse to run unless the caller passes `confirm: true` after the user has explicitly agreed. **Widget** marks tools whose result also renders an in-chat widget in clients that support MCP Apps.

## Discovery tools

| Tool                     | Purpose                                                                                                                   | Scope  |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------- | ------ |
| `finapp.catalog`         | Domains, parent tools, every tool's scope and read-only flag, linked widgets, pagination, money and timestamp conventions | `read` |
| `finapp.<domain>.parent` | The tools and filters of one domain                                                                                       | `read` |

The same catalog is available as the JSON resource `finapp://catalog`.

## Domain tools

### Finance

| Tool                                     | Purpose                            | Scope           | Notes           |
| ---------------------------------------- | ---------------------------------- | --------------- | --------------- |
| `finapp.finance.overview`                | Financial overview                 | `read`          | widget          |
| `finapp.finance.transactions.list`       | Search transactions                | `read`          | widget          |
| `finapp.finance.transactions.get`        | Get transaction                    | `read`          | widget          |
| `finapp.finance.transactions.create`     | Create transaction                 | `write:finance` |                 |
| `finapp.finance.transactions.update`     | Update transaction                 | `write:finance` |                 |
| `finapp.finance.transactions.delete`     | Delete transaction (to Trash)      | `write:finance` |                 |
| `finapp.finance.accounts.list`           | List accounts                      | `read`          | widget          |
| `finapp.finance.accounts.get`            | Get account                        | `read`          |                 |
| `finapp.finance.accounts.create`         | Create account                     | `write:finance` |                 |
| `finapp.finance.accounts.rename`         | Rename account                     | `write:finance` |                 |
| `finapp.finance.accounts.update`         | Update account details             | `write:finance` |                 |
| `finapp.finance.accounts.set_appearance` | Set account icon or colour         | `write:finance` |                 |
| `finapp.finance.accounts.archive`        | Archive account                    | `write:finance` | needs `confirm` |
| `finapp.finance.categories.list`         | List categories                    | `read`          | widget          |
| `finapp.finance.categories.get`          | Get category                       | `read`          |                 |
| `finapp.finance.categories.create`       | Create category                    | `write:finance` |                 |
| `finapp.finance.categories.rename`       | Rename category                    | `write:finance` |                 |
| `finapp.finance.categories.update`       | Update category preferences        | `write:finance` |                 |
| `finapp.finance.categories.set_limit`    | Set category monthly limit         | `write:finance` |                 |
| `finapp.finance.categories.archive`      | Delete category (to Trash)         | `write:finance` | needs `confirm` |
| `finapp.finance.category_limits.list`    | List category limits with usage    | `read`          | widget          |
| `finapp.finance.goals.list`              | List savings goals                 | `read`          | widget          |
| `finapp.finance.goals.create`            | Create savings goal                | `write:finance` |                 |
| `finapp.finance.goals.update`            | Update savings goal                | `write:finance` |                 |
| `finapp.finance.goals.contribute`        | Contribute to goal                 | `write:finance` |                 |
| `finapp.finance.goals.archive`           | Archive savings goal               | `write:finance` | needs `confirm` |
| `finapp.finance.goal_contributions.list` | List goal contributions            | `read`          | widget          |
| `finapp.finance.recurring.list`          | List recurring rules               | `read`          | widget          |
| `finapp.finance.recurring.create`        | Create recurring rule              | `write:finance` |                 |
| `finapp.finance.recurring.set_enabled`   | Pause or resume recurring rule     | `write:finance` |                 |
| `finapp.finance.recurring.delete`        | Delete recurring rule (to Trash)   | `write:finance` | needs `confirm` |
| `finapp.finance.trash.list`              | List Trash                         | `read`          | widget          |
| `finapp.finance.trash.restore`           | Restore from Trash                 | `write:finance` |                 |
| `finapp.finance.trash.purge`             | Delete from Trash for good         | `write:finance` | needs `confirm` |
| `finapp.finance.trash.empty`             | Empty Trash                        | `write:finance` | needs `confirm` |
| `finapp.finance.trash.set_retention`     | Set Trash retention                | `write:finance` |                 |
| `finapp.finance.analytics.summary`       | Spending analytics                 | `read`          |                 |
| `finapp.finance.dashboard.summary`       | Summarize one page of transactions | `read`          | widget          |

### Groups

| Tool                                     | Purpose                       | Scope          | Notes           |
| ---------------------------------------- | ----------------------------- | -------------- | --------------- |
| `finapp.groups.list`                     | List my groups                | `read`         | widget          |
| `finapp.groups.detail.get`               | Get group                     | `read`         | widget          |
| `finapp.groups.create`                   | Create group                  | `write:groups` |                 |
| `finapp.groups.update`                   | Update group settings         | `write:groups` |                 |
| `finapp.groups.members.list`             | List group members            | `read`         | widget          |
| `finapp.groups.members.invite`           | Invite member                 | `write:groups` |                 |
| `finapp.groups.members.set_role`         | Change member role            | `write:groups` |                 |
| `finapp.groups.members.remove`           | Remove member                 | `write:groups` | needs `confirm` |
| `finapp.groups.leave`                    | Leave group                   | `write:groups` | needs `confirm` |
| `finapp.groups.transfer_ownership`       | Transfer group ownership      | `write:groups` | needs `confirm` |
| `finapp.groups.invitations.list`         | List my group invitations     | `read`         | widget          |
| `finapp.groups.invitations.respond`      | Respond to group invitation   | `write:groups` |                 |
| `finapp.groups.invitation_links.create`  | Create invitation link        | `write:groups` |                 |
| `finapp.groups.invitation_links.revoke`  | Revoke invitation link        | `write:groups` | needs `confirm` |
| `finapp.groups.invitation_links.preview` | Preview invitation link       | `read`         |                 |
| `finapp.groups.invitation_links.join`    | Join with invitation link     | `write:groups` |                 |
| `finapp.groups.balances`                 | Group balances                | `read`         | widget          |
| `finapp.groups.settle_up.prepare`        | Prepare settle-up             | `read`         | widget          |
| `finapp.groups.nudge`                    | Send payment reminder         | `write:groups` |                 |
| `finapp.groups.expenses.list`            | List group expenses           | `read`         | widget          |
| `finapp.groups.expenses.get`             | Get group expense             | `read`         | widget          |
| `finapp.groups.expenses.history`         | Expense history               | `read`         | widget          |
| `finapp.groups.expenses.create`          | Add group expense             | `write:groups` |                 |
| `finapp.groups.expenses.update`          | Edit group expense            | `write:groups` |                 |
| `finapp.groups.expenses.delete`          | Delete group expense          | `write:groups` | needs `confirm` |
| `finapp.groups.expenses.add_members`     | Add late joiners to expenses  | `write:groups` |                 |
| `finapp.groups.settlements.list`         | List settlements              | `read`         | widget          |
| `finapp.groups.settlements.create`       | Record settlement             | `write:groups` |                 |
| `finapp.groups.settlements.delete`       | Undo settlement               | `write:groups` | needs `confirm` |
| `finapp.groups.messages.list`            | List group messages           | `read`         | widget          |
| `finapp.groups.messages.send`            | Send group message            | `write:groups` |                 |
| `finapp.groups.messages.pinned`          | Pinned group messages         | `read`         |                 |
| `finapp.groups.messages.pin`             | Pin or unpin group message    | `write:groups` |                 |
| `finapp.groups.messages.react`           | React to group message        | `write:groups` |                 |
| `finapp.groups.messages.mark_read`       | Mark group chat read          | `write:groups` |                 |
| `finapp.groups.unread_counts`            | Unread group chats            | `read`         |                 |
| `finapp.groups.shared_history`           | Shared expenses with a person | `read`         |                 |

### Social

| Tool                                               | Purpose                     | Scope          | Notes           |
| -------------------------------------------------- | --------------------------- | -------------- | --------------- |
| `finapp.social.friends.list`                       | List friends                | `read`         | widget          |
| `finapp.social.requests.list`                      | List friend requests        | `read`         | widget          |
| `finapp.social.people.search`                      | Search people               | `read`         | widget          |
| `finapp.social.people.get`                         | Get person                  | `read`         |                 |
| `finapp.social.people.suggestions`                 | Friend suggestions          | `read`         |                 |
| `finapp.social.people.frequent`                    | Frequent people             | `read`         |                 |
| `finapp.social.requests.send`                      | Send friend request         | `write:social` |                 |
| `finapp.social.requests.respond`                   | Respond to friend request   | `write:social` |                 |
| `finapp.social.requests.cancel`                    | Cancel friend request       | `write:social` |                 |
| `finapp.social.friends.remove`                     | Remove friend               | `write:social` | needs `confirm` |
| `finapp.social.inbox`                              | People inbox                | `read`         | widget          |
| `finapp.social.people.analytics`                   | Activity with a person      | `read`         | widget          |
| `finapp.social.direct_messages.conversations.list` | List conversations          | `read`         | widget          |
| `finapp.social.direct_messages.list`               | List direct messages        | `read`         | widget          |
| `finapp.social.direct_messages.start`              | Start conversation          | `write:social` |                 |
| `finapp.social.direct_messages.send`               | Send direct message         | `write:social` |                 |
| `finapp.social.direct_messages.react`              | React to message            | `write:social` |                 |
| `finapp.social.direct_messages.pinned`             | Pinned direct messages      | `read`         |                 |
| `finapp.social.direct_messages.pin`                | Pin or unpin direct message | `write:social` |                 |
| `finapp.social.direct_messages.mark_read`          | Mark conversation read      | `write:social` |                 |

### Personal

| Tool                                               | Purpose                         | Scope            | Notes           |
| -------------------------------------------------- | ------------------------------- | ---------------- | --------------- |
| `finapp.personal.profile.get`                      | Get my profile                  | `read`           | widget          |
| `finapp.personal.profile.update`                   | Update profile                  | `write:personal` |                 |
| `finapp.personal.default_account.set`              | Set default account             | `write:personal` |                 |
| `finapp.personal.default_category.set`             | Set default category            | `write:personal` |                 |
| `finapp.personal.notifications.list`               | List notifications              | `read`           | widget          |
| `finapp.personal.notifications.mark_read`          | Mark notification read          | `write:personal` |                 |
| `finapp.personal.notifications.mark_all_read`      | Mark all notifications read     | `write:personal` |                 |
| `finapp.personal.notifications.preferences.update` | Update notification preferences | `write:personal` |                 |
| `finapp.personal.notifications.summary`            | Notification status             | `read`           | widget          |
| `finapp.personal.privacy.get`                      | Get privacy settings            | `read`           |                 |
| `finapp.personal.privacy.update`                   | Update privacy settings         | `write:personal` |                 |
| `finapp.personal.security.get`                     | Get security status             | `read`           |                 |
| `finapp.personal.sessions.list`                    | List signed-in devices          | `read`           | widget          |
| `finapp.personal.finai_settings.get`               | Get FinAI settings              | `read`           | widget          |
| `finapp.personal.avatars.list`                     | List avatars                    | `read`           | needs `confirm` |

### Deliberately not exposed

- Push-notification device registration is client-only and is not a tool.
- There is no bulk data-export endpoint in the backend, so none is exposed. Page through the list tools instead.
- Media attachments (message writes are text-only), password and verification flows, sign-in security changes and app-lock secrets are not exposed.

## Results

Every tool returns `structuredContent.data` plus a text block (a one-line summary for key tools, followed by the JSON), so clients without UI support get the same information.

### Money

Amounts stay exact. Each `<name>Minor` integer string (for example `amountMinor: "12550"`) gets a sibling `<name>Formatted` display string in the right currency (`"₹125.50"`). Send amounts back as minor-unit integer strings, never as floats. Currencies with zero or three decimal places are handled.

### Errors

Errors return `isError: true`, text in the form `CODE: guidance`, and `structuredContent.error` as `{ code, message, data? }`. Common codes:

| Code                                    | Meaning                                                                                    |
| --------------------------------------- | ------------------------------------------------------------------------------------------ |
| `MISSING_SCOPE`                         | The grant lacks the write scope this tool needs                                            |
| `TRANSACTION_CHANGED`                   | The expense changed since you read it. Re-read it and retry with the new `expectedVersion` |
| `OUTSTANDING_BALANCE`                   | Includes the formatted balance. Settle up before leaving or removing a member              |
| `ITEMS_TOTAL_MISMATCH`                  | Line items don't add up to the amount                                                      |
| `NOTHING_OWED`                          | A payment reminder was sent to someone who doesn't owe you                                 |
| `INVALID_DATE_RANGE`                    | `endAt` must be after `startAt` and the window at most 366 days                            |
| `INSUFFICIENT_PERMISSION`, `NOT_MEMBER` | The record or group isn't yours to change                                                  |

A tool hidden by your account's [access controls](/mcp/permissions-and-security#account-access-controls) explains why it is unavailable instead of running.

## Bounded reads

- The default list limit is 25 and the maximum page size is 100. Pass `nextCursor` back as `cursor` with the same filters, and stop when `isDone` is true. A filtered page may hold fewer rows, even zero, and still return a cursor.
- Times are Unix epoch **milliseconds**: `startAt` inclusive, `endAt` exclusive, at most 366 days apart.
- Transaction search defaults to the last 30 days; group ledgers default to the last 90 days.
- Transaction search filters: `accountId`, `categoryId`, `type`, `minAmountMinor` and `maxAmountMinor`, and `search` (title, merchant, note and line-item titles).
- Dashboard and analytics summaries report page-level totals until all cursors are consumed.

## Writes

- Supply a UUID `clientMutationId` and reuse it when retrying the same logical write. One is generated if you omit it. Retrying with the same id never applies the write twice.
- Destructive tools (archiving accounts and goals, moving categories and recurring rules to Trash, purging or emptying Trash, deleting group expenses, undoing settlements, removing members or friends, leaving a group, transferring ownership, revoking invitation links) require `confirm: true` and are annotated with `destructiveHint`. Obtain the user's approval first.
- `finapp.finance.transactions.delete` does **not** need `confirm`: the transaction moves to Trash and can be restored with `finapp.finance.trash.restore`.

Tool annotations describe read-only, destructive and idempotent behaviour, but they are not a substitute for the server's scope checks or the user's approval.

## Line items

`finapp.finance.transactions.create` / `update` and `finapp.groups.expenses.create` / `update` accept optional `items`:

```json
[
  {
    "id": "optional",
    "title": "Paneer tikka",
    "amountMinor": "32000",
    "quantity": 1,
    "participantIds": []
  }
]
```

- On updates, omit `items` to keep the current ones, or pass `[]` to clear them.
- Item amounts must add up exactly to `amountMinor` (checked locally, then by Convex), or the call fails with `ITEMS_TOTAL_MISMATCH`.
- Omitted ids are generated; keep ids when editing.
- A group split with method `itemized` shares each item equally among its `participantIds` (empty means every participant) and needs non-empty `items`.
- Transaction and expense outputs include `items`, and transaction search also matches item titles.

## Group expenses

- `finapp.groups.expenses.get` returns payers, each participant's share, items and the `version`.
- Pass that `version` as `expectedVersion` to `finapp.groups.expenses.update` (which also accepts `payers`) or `finapp.groups.expenses.delete`.
- `finapp.groups.expenses.history` returns the audit trail of edits.
- `finapp.groups.expenses.add_members` includes late joiners in existing expenses.
- `finapp.groups.settlements.delete` undoes a settlement.
- `finapp.groups.nudge` sends a payment reminder, at most once per member per day.

## In-chat widgets (MCP Apps)

Widgets follow the MCP Apps extension (`io.modelcontextprotocol/ui`, spec 2026-01-26), which Claude and ChatGPT implement. They live in the `@finapp/widgets` package (`packages/widgets`); every widget there is registered as a UI resource, and 37 tools link to one. The core widgets are:

| Widget             | Resource URI                         | Tools                                                                                  |
| ------------------ | ------------------------------------ | -------------------------------------------------------------------------------------- |
| Financial overview | `ui://finapp/overview.v1.html`       | `finapp.finance.overview`                                                              |
| Transactions       | `ui://finapp/transactions.v1.html`   | `finapp.finance.transactions.list`, `finapp.groups.expenses.list`                      |
| Group balances     | `ui://finapp/group-balances.v1.html` | `finapp.groups.balances` (Remind and Settle up actions)                                |
| Expense detail     | `ui://finapp/expense.v1.html`        | `finapp.finance.transactions.get`, `finapp.groups.expenses.get`                        |
| Settle up          | `ui://finapp/settle-up.v1.html`      | `finapp.groups.settle_up.prepare` (records through `finapp.groups.settlements.create`) |

Other linked widgets cover accounts, category limits, goals and contributions, recurring rules, Trash, period summaries, groups and members, invitations, expense history, settlements, group chat, friends, friend requests, people search, conversations, the people inbox, activity with a person, notifications, profile, signed-in devices and FinAI settings. The dashboard's **In-chat widgets** tab previews all of them with fictional sample data.

How widgets behave:

- Tools declare `_meta.ui.resourceUri`, plus the ChatGPT alias `_meta["openai/outputTemplate"]` and `openai/toolInvocation/*` status text.
- Resources are served as `text/html;profile=mcp-app` with `_meta.ui.csp` (empty `connectDomains` and `resourceDomains`) and `prefersBorder`, plus the legacy `openai/widgetCSP` mirror.
- Widgets are single self-contained HTML documents: inline CSS and JS, no network access, no fonts or CDNs, no secrets. Data arrives only through the host bridge (`ui/initialize`, then `ui/notifications/tool-result`).
- Action buttons call tools through `tools/call`, so normal OAuth scopes still apply. A read-only grant cannot record a settlement.
- User text is rendered with `textContent`, never `innerHTML`.
- The theme follows the host's `hostContext.theme` (or `window.openai.theme`, falling back to `prefers-color-scheme`).
- The `vN` in a URI is bumped after breaking template changes, because hosts cache by URI.

If a client doesn't support MCP Apps, the widget simply doesn't render; the text and `structuredContent` carry the same data.
