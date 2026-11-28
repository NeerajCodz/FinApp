---
title: Trash
description: Restore deleted transactions, accounts, categories, goals and recurring payments, delete them for good, and choose how long Trash keeps them.
order: 16
---

When you delete a transaction, account, category, goal or recurring payment, it isn't removed straight away. It moves to **Trash**, where you can bring it back or delete it for good. Trash is cleaned up automatically after the retention period you choose.

## Opening Trash

- **Web:** `/trash`, or **Settings → Trash**
- **Mobile:** **Settings → Trash**

Trash lists everything you've deleted, newest first, and shows when each item will be deleted for good. It shows up to 200 items at a time.

## What goes to Trash

| Item               | Notes                                                                                                           |
| ------------------ | --------------------------------------------------------------------------------------------------------------- |
| Transactions       | Your personal transactions, including ones deleted in a batch from the Transactions list                        |
| Accounts           | Transactions trashed together with the account come back when you restore it                                    |
| Categories         | Transactions trashed together with the category come back when you restore it                                   |
| Goals              |                                                                                                                 |
| Recurring payments |                                                                                                                 |
| Old budgets        | Budgets deleted before budgets became category limits. Restoring one sets that category's monthly limit instead |

Group expenses, settlements and chat messages are not part of Trash.

## Restoring an item

Choose **Restore** on the item. It returns exactly as it was, along with anything that was trashed together with it.

A transaction can only be restored while its account exists. If the account is also in Trash, restore the account first.

## Deleting for good

- The delete button on a single item removes it permanently after you confirm.
- **Empty Trash** removes everything in Trash permanently after you confirm.

Some items take related records with them when deleted for good:

- Deleting an **account** for good also deletes its transactions.
- Deleting a **goal** for good also deletes its contributions.

:::warning
Deleting for good can't be undone. [Export your data](/guide/export) first if you might need it.
:::

## Automatic cleanup

Under **Settings → Trash → Automatic cleanup**, choose how long items stay in Trash before they are deleted for good:

| Option            |
| ----------------- |
| 1 day             |
| 7 days            |
| 14 days           |
| 30 days (default) |
| 60 days           |
| 90 days           |
| Never             |

A cleanup job runs once a day and deletes items older than your setting. With **Never**, items stay until you delete them yourself. A change applies to everything already in Trash, so shortening the period can remove older items at the next cleanup.

## Trash and FinAI

FinAI can work with Trash too (see [FinAI assistant](/guide/finai)):

- Deleting one of your transactions through FinAI moves it to Trash immediately, without a confirmation card, because it can be restored.
- Restoring an item from Trash through FinAI also runs immediately.
- Moving goals, categories, accounts or recurring payments to Trash, and deleting anything from Trash for good, always needs your confirmation.

AI apps connected through [MCP](/mcp/tools) can list, restore, purge and empty Trash and change the retention setting if you granted them finance write access. Purging and emptying Trash require explicit confirmation.

## Trash and sync

Deleting and restoring are synced to your other devices like any other change. Deleting a transaction works offline and is sent when you reconnect. See [Sync and offline](/guide/sync-and-offline).
