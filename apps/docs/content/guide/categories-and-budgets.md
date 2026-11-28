---
title: Categories and budgets
description: Organize spending and income with categories, and budget with monthly category limits and alerts.
order: 4
---

Categories group your expenses and income, for example Food, Rent or Salary. In FinApp, budgeting is built into categories: **a category's monthly limit is its budget**.

## Categories

Each category has a **kind**, either **expense** or **income**. Only expense and income transactions can have a category. Transfers, refunds and adjustments don't use one.

### Create a category

Open **Categories** and choose **New category** (`/categories/new` on web).

| Field         | Rules                                                                         |
| ------------- | ----------------------------------------------------------------------------- |
| Name          | Required.                                                                     |
| Kind          | Expense or income.                                                            |
| Emoji / Icon  | An emoji (with skin-tone choices) or a Lucide or Phosphor icon.               |
| Color         | A hex color from the color picker.                                            |
| Notes         | Optional.                                                                     |
| Monthly limit | Optional. Must be greater than zero. See [Category limits](#category-limits). |
| Alert level   | Optional, from 1 to 100 percent. Defaults to 80%.                             |

### The Categories page

The overview shows totals (active categories, categories with limits, spending in the last 30 days), a search box and a filter. Each category card shows this month's activity and, when a limit is set, how much of it is used.

Open a category to see:

- **Spent this month**, **Received this month**, **Monthly limit** and **Remaining**,
- category analytics with a chart period and transaction-type selector,
- the average transaction, total transactions and biggest expense,
- **Top merchants** for the selected period,
- recent transactions in the category.

### Default categories

From a category's details you can make it the **default for expenses** or the **default for income**. New transactions of that type start with it selected. You can also tick **Use this category next time** on the transaction form.

Built-in system categories can't be renamed or have their preferences changed.

### Delete a category

Choose **Delete** on the category page. The category moves to **Trash** and is no longer offered for new transactions. FinApp asks what to do with its transactions:

- **Keep them**: they stay in your history and show as uncategorised.
- **Move them to Trash too**: your personal transactions in the category go to Trash with it, and come back if you restore the category. Group expenses are never moved.

If the category was your default for expenses or income, that default is cleared.

:::note
Trash empties itself after your retention period (default 30 days; 1, 7, 14, 60, 90 days or never are also available in **Settings > Trash**).
:::

## Category limits

A **monthly limit** caps how much you plan to spend in a category each month. It replaces the separate Budgets feature from earlier versions.

Set or change a limit from the category form or the category page. You can also remove it, which clears its alert level too.

| Setting     | Rules                                                                                                            |
| ----------- | ---------------------------------------------------------------------------------------------------------------- |
| Amount      | Greater than zero.                                                                                               |
| Currency    | One of the supported currencies. Defaults to the category's existing limit currency, then your default currency. |
| Alert level | 1 to 100 percent. Leave empty to use the default of **80%**.                                                     |

### What counts towards a limit

Spending is the total of **posted, non-deleted expenses** in the category that:

- are in the **limit's currency** (expenses in other currencies are ignored), and
- fall in the **current calendar month**.

Income in the category doesn't reduce spending.

### Usage status

The usage ring and meter change state as you spend:

| Status     | When                                         |
| ---------- | -------------------------------------------- |
| Normal     | Below the alert level.                       |
| Warning    | At or above the alert level (capped at 90%). |
| Near limit | At or above **90%**.                         |
| Exceeded   | At or above **100%**.                        |

The page also shows what's left, or how much you are over. Home shows the **three categories closest to their limit**.

### Limit alerts

After you record an expense, FinApp checks the category's spending for the month and sends a notification when it crosses:

- your **alert level** ("You are nearing this category's monthly limit"), or
- **100%** ("You reached this category's monthly limit").

Each alert is sent at most once per category, per threshold, per month. Alerts only fire for expenses dated in the current month. Turn them on or off with **Category limits** in **Settings > Notifications**.

## What happened to Budgets

Older versions had a separate Budgets section. It has been folded into categories:

- Old `/budgets` and `/budget/...` links now open **Categories**.
- A budget for one category became that category's monthly limit, keeping its alert level, unless the category already had a limit (the category's own limit wins).
- If two budgets pointed at the same category, the larger one became the limit.
- A budget with no category (an overall budget), or whose category was missing or in Trash, was retired, and you were notified.

Budgets that were already in Trash before the change stay listed there. Restoring one sets its category's limit instead of bringing back a budget.
