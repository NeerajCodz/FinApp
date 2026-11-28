---
title: Recurring
description: Keep upcoming bills and subscriptions visible with recurring reminders on web and mobile.
order: 6
---

Recurring reminders keep regular payments, such as rent, subscriptions, bills and EMIs, in view so you know what's coming up. Open **Recurring** (`/recurring` on web).

:::note
Recurring reminders are **reminder only**. FinApp does not create transactions automatically when a reminder is due. When you pay, record the payment yourself as a [transaction](/guide/transactions).
:::

## Create a reminder

Choose **New recurring reminder** and fill in:

| Field     | Rules                                                                |
| --------- | -------------------------------------------------------------------- |
| Name      | Required. It's also used as the reminder's title.                    |
| Amount    | Required, greater than zero.                                         |
| Account   | An active account you own. The reminder uses the account's currency. |
| Frequency | Daily, weekly, monthly or yearly.                                    |

New reminders are created as **recurring expenses**, repeat every 1 period, and start active. The first due date is one period from when you create the reminder. For example, a monthly reminder created on 10 March is first due on 10 April.

### How due dates advance

| Frequency | Next due date                                                                                                            |
| --------- | ------------------------------------------------------------------------------------------------------------------------ |
| Daily     | The next day.                                                                                                            |
| Weekly    | Seven days later.                                                                                                        |
| Monthly   | Same day next month. If that day doesn't exist, the last day of the month (31 January is followed by 28 or 29 February). |
| Yearly    | Same date next year.                                                                                                     |

## The Recurring page

The page summarizes your reminders:

- **Total recurring**, **Monthly expenses**, **Monthly income** and **Upcoming this week**,
- a search box ("Search recurring…"),
- a table with the merchant or title, category, account, frequency and **next due** date.

When you're offline, the page shows reminders saved on your device.

## Reminder details

Open a reminder (`/recurring/:recurringId` on web) to see:

- the amount per occurrence and a **yearly estimate** based on the frequency,
- the **next reminder** date and **status** (Active or Paused),
- recurring details: name, amount, frequency, interval, created date, account and behaviour ("Reminder only"),
- **Next reminders**: the upcoming dates,
- **Transaction history**: recorded transactions associated with this reminder.

## Pause and resume

Use **Pause reminder** to stop a reminder without losing it. A paused reminder shows no upcoming dates. Choose **Resume reminder** to turn it back on.

## Notifications

How you're reminded depends on the app.

### Mobile

The mobile app schedules **device notifications** for upcoming due dates within the next 30 days. When a reminder is due, you also get an in-app notification: "_Name_ is due. Review this recurring expense before recording it."

Recurring notifications follow the **Recurring payments** switch in **Settings > Notifications**. Paused reminders aren't scheduled.

### Web

The web app shows a **browser notification** ("Reminder: _Name_") when a reminder is due, but only while FinApp is open in a visible tab and you've allowed notifications for the site. Each due date is notified once.

:::tip
On web, allow notifications when your browser asks, or turn them on in your browser's site settings, to get due reminders while FinApp is open.
:::

## Delete a reminder

Deleting a reminder moves it to **Trash** and stops it from running. Deleted reminders are hidden from the Recurring page.

- **Restore** it from Trash to bring it back with the active or paused state it had before.
- **Delete for good** removes it permanently.

You can also ask FinAI, or a connected MCP client, to create, edit or delete recurring reminders.

Trash empties itself after your retention period (default 30 days), which you can change in **Settings > Trash**.
