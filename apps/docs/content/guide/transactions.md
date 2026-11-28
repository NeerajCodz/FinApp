---
title: Transactions
description: Record expenses, income and transfers, itemize bills, and find, edit or delete transactions.
order: 3
---

Transactions are the individual money movements in your accounts. Each one has a type, an amount, an account, a date and, for expenses and income, a category.

## Transaction types

| Type           | What it means                                              | Category |
| -------------- | ---------------------------------------------------------- | -------- |
| **Expense**    | Money leaving an account.                                  | Required |
| **Income**     | Money coming into an account.                              | Required |
| **Transfer**   | Money moving between two of your own accounts.             | Not used |
| **Refund**     | Money returned to an account. Adds to the balance.         | Not used |
| **Adjustment** | A correction to an account's balance. Adds to the balance. | Not used |

The add and edit forms offer **Expense**, **Income** and **Transfer**. Refunds and adjustments can be recorded through FinAI or an MCP client, and they appear in your lists and filters like any other transaction.

:::note
Group expenses are created from a group, not from this form. They show up in your transactions as **Split expense**. See [Groups and splits](/guide/groups-and-splits).
:::

## Add a transaction

Tap **+** on mobile, or choose **Add transaction** on web (`/transaction/new`).

| Field             | Rules                                                                                  |
| ----------------- | -------------------------------------------------------------------------------------- |
| Title             | Required, for example "Grocery shopping" or "Salary".                                  |
| Amount            | Must be greater than zero.                                                             |
| Account           | An active (not archived) account you own. The transaction uses the account's currency. |
| To account        | Transfers only. Another of your active accounts in the **same currency**.              |
| Category          | Expenses and income only. Must be an active category.                                  |
| Merchant or payee | Optional, for example "Amazon" or "Electricity Board".                                 |
| Note              | Optional.                                                                              |
| Date and time     | Defaults to now. The time is optional.                                                 |

Two shortcuts sit under the form:

- **Use this account for new transactions** makes the account your default.
- **Use this category next time** remembers the category for the next expense or income.

For expenses there is also **Share this expense across multiple people**, which takes you to the group split flow.

While you fill in the form, a **Transaction impact** panel shows how the change affects your finances, and **Recent similar transactions** lists comparable entries.

### Scan a receipt

When creating an expense or income, you can scan a receipt photo. FinAI reads it and fills in the fields. Anything it isn't sure about is flagged for review before you save. Receipt scanning isn't available for transfers.

## Line items

Turn on **Itemize** to break a transaction into lines, such as the dishes on a restaurant bill, or starters, drinks and tax.

- Up to **100** items per transaction.
- Each item needs a title (up to **80** characters) and an amount greater than zero.
- Quantity is optional and must be a positive whole number.
- The items must **add up exactly** to the transaction total. While itemizing, the amount field shows the sum of the items.

Items can be reordered and removed. On group expenses, items can also power the **By item** split method.

:::tip
If you edit a transaction's amount without changing its items, FinApp keeps the items only while they still add up to the new total. Otherwise they are dropped.
:::

## Edit a transaction

Open a transaction and choose **Edit** (`/transaction/:id/edit` on web). You can change the type (expense, income or transfer), amount, account, category, title, merchant, note, date and items. The same rules apply as when creating: the account currency must match, transfers need a different account in the same currency, and expenses and income need a category.

Only your own personal transactions can be edited here. Group expenses are edited from the group, by the person who added them or a group admin.

## Delete transactions

Delete a single transaction from its detail page, or select several on the **Transactions** list and delete them together. Batch selection is available on web and mobile, and applies only to your personal transactions (group expenses can't be selected).

Deleted transactions:

- disappear from lists, balances and analytics right away (offline too),
- move to **Trash**, where you can restore them or delete them for good,
- are purged automatically after your Trash retention period (default 30 days).

:::warning
A transaction can't be restored while its account is in Trash. Restore the account first.
:::

## Search and filter

The **Transactions** page (`/transactions`) has three controls:

- **Search**: matches the title, merchant, note, account name, category name and the formatted amount. Matching ignores case.
- **Type filter**: All types, Expenses, Income, Transfers, Refunds or Adjustments.
- **Month**: shows one calendar month at a time.

Above the list, summary cards show **Total spending**, **Total income**, the number of **Transactions** and the **Average expense** for the month, each compared with the previous month.

Transactions without a category show as **Uncategorized**, transfers as **Transfer**, and group expenses as **Split expense**.

## Dates and time zones

Dates are shown in the time zone from your profile. If you leave the time empty, FinApp shows the date only.
