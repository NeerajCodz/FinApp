---
title: Accounts
description: Create and manage the cash, bank, card, wallet and loan accounts that hold your balances.
order: 2
---

An account is where money lives: a bank account, a wallet, cash in your pocket or a credit card. Every personal transaction belongs to exactly one account, and each account has a single currency.

## Account types

| Type     | Shown as                                               |
| -------- | ------------------------------------------------------ |
| `bank`   | Bank account                                           |
| `cash`   | Cash                                                   |
| `card`   | Credit card                                            |
| `wallet` | Wallet                                                 |
| `loan`   | Loan                                                   |
| `other`  | Custom, with your own type label (up to 40 characters) |

## Create an account

Open **Accounts** and choose **New account** (`/accounts/new` on web).

| Field           | Rules                                                                  |
| --------------- | ---------------------------------------------------------------------- |
| Name            | Required, up to 80 characters.                                         |
| Type            | One of the types above. Custom needs a label.                          |
| Currency        | One of the 26 supported currencies. Defaults to your profile currency. |
| Opening balance | Zero or more. Negative opening balances are not accepted.              |
| Color           | A hex color from the color picker.                                     |
| Icon            | An emoji or an icon from the Lucide or Phosphor sets.                  |
| Account number  | Optional reference, for your eyes only.                                |
| Bank / Provider | Optional, for example "HDFC Bank" or "PayPal".                         |
| Notes           | Optional extra information.                                            |
| Opened on       | Optional date.                                                         |

### Settings

- **Include in analytics**: show the account in charts and insights, and count it in your overall balance. Turned on by default.
- **Set as primary account**: use this account by default for new transactions.

:::tip
When you add a transaction, FinApp first suggests an account in your default currency, then falls back to your primary account.
:::

## How balances are calculated

An account's balance is its opening balance plus or minus every posted, non-deleted transaction on it:

| Transaction                | Effect on the account                        |
| -------------------------- | -------------------------------------------- |
| Income, refund, adjustment | Adds the amount                              |
| Expense                    | Subtracts the amount                         |
| Transfer out               | Subtracts the amount from the source account |
| Transfer in                | Adds the amount to the destination account   |

A group expense you pay is recorded as an expense on the account you chose, for the full amount you paid. Your share and what others owe you are tracked separately in the group (see [Groups and splits](/guide/groups-and-splits)).

## Viewing accounts

The **Accounts** page shows a summary of included balances, a search box ("Search accounts…") and a filter by account type. Open an account to see:

- its current balance and a 30-day cash-flow chart,
- recent posted activity on the account,
- quick actions to rename it, change its color or icon, edit details or archive it.

## Edit an account

You can change the name, type, color, icon, opening balance and details at any time.

Changing the **currency** is only allowed while nothing uses the account. If any transaction (including a transfer into it) or a goal is linked to the account, FinApp rejects the change. Create a new account in the other currency instead.

:::note
Transfers only work between accounts with the same currency. When no other account in the selected currency exists, the transfer form says so and offers to create one.
:::

## Archive (delete) an account

Choose **Archive account** on the account page. The confirmation explains that past transactions and balances stay in your history, but the account can no longer be used for new activity.

When you archive an account:

- it moves to **Trash** and disappears from account pickers,
- it can't receive new transactions, transfers, goals or recurring reminders,
- if it was your primary account, the primary account setting is cleared.

### Restore or delete for good

Open **Trash** (from Profile or Settings) to restore the account or delete it for good.

- **Restore** brings the account back as it was.
- **Delete for good** permanently removes the account **and all of its transactions**. This can't be undone.

Trash empties itself automatically after your chosen retention period: 1, 7, 14, 30 (default), 60 or 90 days, or never. Change it in **Settings > Trash**.

:::warning
A transaction whose account is in Trash can't be restored on its own. Restore the account first.
:::
