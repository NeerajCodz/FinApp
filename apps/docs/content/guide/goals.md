---
title: Goals
description: Save towards a target with goals, log contributions and follow your progress and forecast.
order: 5
---

Goals help you save towards something specific, such as an emergency fund, a trip or a new laptop. You set a target amount, add contributions as you save, and FinApp tracks your progress.

## Create a goal

Open **Goals** and choose **New goal** (`/goals/new` on web).

| Field                | Rules                                                                              |
| -------------------- | ---------------------------------------------------------------------------------- |
| Name                 | Required.                                                                          |
| Target amount        | Required, greater than zero.                                                       |
| Currency             | One of the 26 supported currencies.                                                |
| Target date          | Optional. It must be in the future.                                                |
| Monthly contribution | Optional plan for how much you'll put in each month. Zero or more.                 |
| Linked account       | Optional. Must be an active account you own, in the **same currency** as the goal. |
| Priority             | Low, medium or high.                                                               |
| Reminder             | None, weekly or monthly.                                                           |
| Goal type            | Optional label describing the goal.                                                |
| Icon and color       | An emoji or icon (up to 80 characters) and a hex color.                            |
| Notes                | Optional.                                                                          |

:::note
Once an account is linked to a goal, that account's currency can't be changed.
:::

## Add contributions

Open a goal and choose **Add contribution**, then enter the amount you've saved.

- Contributions must be greater than zero.
- Each contribution is recorded in the goal's currency with today's date.
- A contribution is a record of progress on the goal. It doesn't create a transaction or change an account balance. If you move money into a savings account, record that separately as a [transfer](/guide/transactions).

When your contributions reach or pass the target, the goal is marked **complete** and you get a "Goal reached" notification. This happens once per goal.

## Track progress

The **Goals** page lists your goals with how much you've saved against each target. Open a goal for its details, or open its analytics (`/goals/:id/analytics` on web) for a deeper view:

| Metric                         | What it shows                                                                               |
| ------------------------------ | ------------------------------------------------------------------------------------------- |
| Saved, target, remaining       | Your progress in amounts and as a percentage.                                               |
| Monthly trend                  | How much you contributed each month.                                                        |
| Average monthly and best month | Your typical and strongest saving months.                                                   |
| Forecast date                  | When you're likely to reach the target at your current pace.                                |
| Required monthly               | How much you'd need to save each month to hit your target date.                             |
| On-track score                 | Your average monthly saving as a percentage of the required monthly amount (capped at 100). |
| Milestones                     | 25%, 50%, 75% and 100%, with the date each was reached or is projected.                     |
| Sources                        | When contributions are linked to an account, how much came from each and its share.         |

Goal analytics are also available across all your goals together.

## Edit a goal

Choose **Edit** on a goal (`/goals/:id/edit` on web) to change its name, target amount, target date, monthly contribution, linked account, priority, reminder, icon, color, type or notes. The same rules apply as when creating it. A newly linked account must match the goal's currency.

## Delete a goal

Deleting a goal moves it to **Trash**. From there you can:

- **Restore** it, with all its contributions intact, or
- **Delete for good**, which permanently removes the goal and every contribution recorded on it.

Trash empties itself after your retention period (default 30 days), which you can change in **Settings > Trash**.
