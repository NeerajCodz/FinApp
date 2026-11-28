---
title: Sync and offline
description: How Finapp keeps a local copy of your data on web and mobile, works offline and syncs your changes.
order: 13
---

Finapp is local-first. The web app and the mobile app keep a copy of your data on the device, so screens open quickly and keep working without a connection. Your changes are saved on the device first and sent to the server when you're online.

## How it works

1. **Download.** After you sign in, Finapp downloads your recent history to the device and then follows live changes from the server.
2. **Save locally first.** When you add or edit something, the change is written to the local database and to a durable _outbox_ before anything is sent. It shows up immediately, even offline.
3. **Send.** When you're connected, queued changes are sent in order. Changes that depend on each other (for example a transaction in an account you just created offline) wait until the first one has synced.
4. **Retry.** If sending fails because of the network, Finapp retries with increasing pauses (from about a second up to 30 seconds). Every change carries an id, so a retried change is never applied twice.

Changes that the server rejects are marked as failed instead of being retried forever; see [Fixing sync problems](#fixing-sync-problems).

## Where the copy lives

| Platform        | Storage                                          | Protection                                                                                             |
| --------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| Web             | The browser's IndexedDB for this browser profile | Not encrypted separately. Anyone using the same browser profile could read it. Signing out removes it. |
| Android and iOS | An on-device SQLite database                     | Encrypted with SQLCipher in installed builds                                                           |

:::warning
On a shared or public computer, sign out when you're done so the browser copy is removed. The web screen lock (see [Security](/guide/security)) hides the screen but does not encrypt browser storage.
:::

## What works offline

Personal finance works fully offline: transactions (including line items and batch deletes), accounts, categories and their limits, goals and contributions, recurring rules, profile name, phone and avatar, notification preferences and marking notifications read. Supported group-ledger changes, such as adding, editing or deleting group expenses and recording or removing settlements, also save offline and replay when you reconnect.

These need a live connection:

- Group invitations, joining, membership and role changes
- Group and direct chat messages, and bill or image uploads
- Changing your username and looking people up by username
- Signing in, two-factor sign-in, password changes and other server-managed security settings
- Privacy settings and signed-in devices
- FinAI, receipt scanning and spreadsheet import
- Connecting AI apps through MCP

App lock settings are stored on the device and work offline.

:::note
Group balances are shown only when the complete group ledger is available on the device, so a balance is never computed from partial data.
:::

## How much history is downloaded

Under **Settings → Sync** choose how far back Finapp downloads automatically: 7, 30, 90, 180 or 365 days, or **Everything**. The default is **30 days**. The setting is per device ("History in this browser" on web, "History on this phone" on mobile).

- Older items still load from the server when you open them while online.
- Changing the window never removes anything that is already on the device.

:::tip
Choose **Everything** before a trip if you want your full history available offline.
:::

## Sync status

The sync button in the home header shows whether you're online, when the last successful sync happened and whether anything needs attention. **Settings → Sync** shows the same status:

- **Everything is synced:** nothing is waiting.
- **Syncing…:** changes are being sent or fetched.
- **Offline:** changes save on the device and sync when you reconnect.
- **N changes need attention:** some changes failed or conflict.

Use **Sync now** to retry straight away.

## Fixing sync problems

There are two kinds of problems:

- **Failed changes.** The server refused a change, for example because a record no longer exists or a limit was hit. The error is shown with the change.
- **Conflicts.** The same record was changed on this device and somewhere else before this device synced.

On the web, open the sync status panel from the home header. Each failed change has **Retry this change**, and each conflict lets you choose **Keep this device** (your local version wins and is sent again) or **Use cloud** (the server version replaces your local edit). On mobile, **Settings → Sync** shows how many changes need attention and lets you retry with **Sync now**.

If _Sync problems_ notifications are on, you'll also get a notification when something needs your attention. See [Notifications](/guide/notifications).

## Exporting from the local copy

[Export](/guide/export) builds its files from the data on the device, so it only includes history that has been downloaded. Set the history window to **Everything** first if you want a complete export.
