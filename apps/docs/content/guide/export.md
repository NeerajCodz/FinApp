---
title: Export your data
description: Download your accounts, transactions, categories, groups and settlements as CSV files from web or mobile.
order: 15
---

You can export a copy of your Finapp data as CSV files at any time, for a backup, for a spreadsheet, or before deleting your account.

## What's included

An export contains one CSV file per kind of record:

| File               | Contents                   |
| ------------------ | -------------------------- |
| `accounts.csv`     | Your accounts              |
| `transactions.csv` | Your transactions          |
| `categories.csv`   | Your categories            |
| `groups.csv`       | Groups you belong to       |
| `settlements.csv`  | Settlements in your groups |

Fields that hold sign-in secrets, such as tokens and session data, are always removed before the files are written.

Goals, recurring rules, notifications, chat messages, FinAI conversations and attachments are not part of the export.

## Export on the web

1. Go to **Settings → Privacy**.
2. Under **Your data**, **Export your data** shows how many records will be included.
3. Choose **Export**.

Your browser downloads a single ZIP file named `finapp-backup-YYYY-MM-DD.zip` containing the five CSV files.

## Export on mobile

1. Go to **Settings → Privacy**.
2. Under **Your data**, choose **Export**.

The app writes the five CSV files into a `finapp-export` folder in the app's documents storage and shows _Export ready_ when it's done.

## The export comes from your device

Exports are built from the copy of your data stored on the device you're using, so they work offline and never wait on the server. This also means an export includes only the history that has been downloaded to that device.

:::tip
For a complete export, open **Settings → Sync** and set the history window to **Everything**, let it finish syncing, then export. See [Sync and offline](/guide/sync-and-offline).
:::

## Reading the files

- Each file starts with a header row; columns are the record's fields.
- Values containing commas, quotes or line breaks are quoted.
- Money amounts are stored in **minor units** (the smallest unit of the currency), so `12550` in a rupee account means ₹125.50. Some large integer values may carry a trailing `n` (for example `12550n`); remove it before doing arithmetic.
- Dates are stored as Unix timestamps in milliseconds.
- A file with no records is empty.

## Other ways to get your data

- **AI apps through MCP:** an app you connect through [MCP](/mcp/overview) can page through your data with its read tools. There is no bulk export tool.
- **Account deletion:** if you plan to [delete your account](/guide/security#deleting-your-account), export first. Deleted data can't be recovered.
