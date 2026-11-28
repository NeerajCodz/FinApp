---
title: Notifications
description: How the in-app inbox, push notifications, notification preferences and payment reminders work.
order: 12
---

Finapp keeps an inbox of things that need your attention: spending alerts, shared expenses, settlements, friend requests, security events and more. On mobile, the same notifications can also arrive as push notifications.

## The inbox

Open the inbox from the bell in the home header. The badge shows how many notifications are unread.

- **Filters:** _All_ and _Unread_ are always shown. _Money_, _Shared_, _Friends_ and _Security_ appear when they contain something.
- **Read and unread:** open a notification or use its button to mark it read; you can mark it unread again. **Mark all read** clears everything you have seen (a notification that arrives at the same moment stays unread).
- **Delete:** remove a notification you no longer need.
- **On mobile:** swipe right to mark read or unread, swipe left to delete.
- **Open the related screen:** tapping a notification takes you to the transaction, category, goal, group balances, recurring payments, security settings and so on.
- **Act in place:** friend requests can be answered from the inbox, and group invitations can be accepted or declined from their notification.

The inbox is part of your offline copy, so it opens without a connection, and changes such as marking read sync when you're back online.

## What you get notified about

| Kind               | When                                                                     |
| ------------------ | ------------------------------------------------------------------------ |
| Transactions       | Each transaction you record (off by default)                             |
| Category limits    | A category's spending crosses its alert level (default 80%) or its limit |
| Goals              | A savings target is reached                                              |
| Recurring payments | A reminder-only recurring rule is due                                    |
| Shared expenses    | Group expenses you're part of                                            |
| Settlements        | Payments and settle-up reminders                                         |
| Groups             | Invitations, joins and leaves                                            |
| Friends            | Friend requests and accepted requests                                    |
| Security           | New sign-ins, newly connected AI apps (MCP) and account changes          |
| Sync problems      | Offline changes that need your attention                                 |

## Choosing what reaches you

Go to **Settings → Notifications** on web or mobile and switch each kind on or off. Everything except _Transactions_ is on by default.

:::note
Switching a kind off means those notifications are not created at all: they don't appear in your inbox and aren't pushed to your phone. Turning it back on only affects new events.
:::

## Push notifications (mobile)

Push notifications are available in the Android and iOS app. There is no browser push on the web; use the inbox there.

1. In **Settings → Notifications**, turn on **Push notifications** under _This phone_.
2. Allow notifications when your phone asks. If you previously blocked them, allow Finapp in your phone's settings.
3. The phone registers with your account. If you're offline, it registers once you're back online.

When it's on, alerts reach the phone even when Finapp is closed, and tapping one opens the related screen. Push follows the same preferences as the inbox. Up to 10 phones per account receive push; the least recently used phone is dropped beyond that.

### Recurring reminders on your phone

The mobile app also schedules reminders on the phone itself for your enabled recurring rules, for due dates in the next 30 days ("_Rent is due_"). These work without a connection and follow the _Recurring payments_ preference. Pausing a rule, turning the preference off or signing out removes them.

:::note
Expo Go (used during development) does not show push or scheduled reminders. Use an installed build.
:::

## Payment reminders (nudges)

In a group, you can send a payment reminder to a member who owes you money.

- You can only remind someone while the group balances show they owe you.
- Each person can be reminded once per day per group. Trying again the same day shows _already reminded today_.
- The reminder says how much they owe and opens the settle-up form with you preselected.
- If the member has turned off _Settlements_ notifications, nothing is delivered and you're told they've turned off reminders.

Reminders can be sent from the group screen, and FinAI can prepare one for you to confirm (see [FinAI assistant](/guide/finai)).

## Security notifications

Security notifications cover new sign-ins to your account (if **New sign-in alerts** is on), a new AI app connecting through MCP, and account changes such as a deletion request. If you don't recognise one, follow [Security](/guide/security) to sign out the device or disconnect the app.
