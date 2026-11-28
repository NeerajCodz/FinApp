---
title: Settlements
description: Record payments that clear group balances, use suggested transfers, and undo a settlement.
order: 8
---

A settlement records a real payment between two people in a group, for example "Asha paid Ravi 500 via UPI". It moves both people's group balances towards zero. FinApp doesn't move any money itself: you pay each other however you like, then record it.

## How group balances work

Every group expense says who paid and how the cost is split. From those, FinApp works out each member's net position in the group's currency:

- a **positive** balance means the group owes you,
- a **negative** balance means you owe the group,
- **zero** means you're settled.

Balances are only shown when FinApp has the **complete** group ledger. If part of it can't be loaded, you'll see "Balances unavailable" rather than a partial, possibly wrong figure.

## The Settle up hub

Open **Settle up** (`/settle/new` on web), or use **Settle** on a group or on someone's profile (`/settle/:userId`).

1. **Pick a group.** Settlements always happen inside one group and its currency.
2. See your position: **You owe** or **Owed to you**, plus everyone you can settle with. People in the suggested plan are listed first.
3. Review **Suggested transfers**: the fewest payments that clear every balance in the group.
4. Pick a person, an amount and the account the payment is recorded against, then choose **Record settlement**.

If you have nothing to settle, the hub says "You're all square". If everyone is settled, it says so too.

### Suggested transfers

FinApp simplifies debts so the group needs as few payments as possible. People whose balances cancel each other out are grouped together, and within each group the person who owes the most pays the person owed the most. This is exact for up to 12 people with an open balance, and a close approximation for larger groups. The plan is stable: the same balances always produce the same suggestions.

### Settle all mine

When you're part of several suggested transfers, **Settle all mine** records all of them in one go, in an order the server accepts.

## Recording a settlement

| Field       | Rules                                                                                                                                 |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| From and to | Two different people. You must be one of them.                                                                                        |
| Amount      | Greater than zero, and no more than the open balance between you (see below). Quick picks include **Full balance** and **Suggested**. |
| Account     | One of your own active accounts in the **group's currency**.                                                                          |
| Date        | The date of the payment.                                                                                                              |
| Note        | Optional, up to **280** characters, for example "Paid via UPI".                                                                       |

### The balance limit

A settlement can't overshoot. The payer must still owe at least the amount, **and** the person being paid must still be owed at least the amount. FinApp checks this against the live group ledger when the settlement is saved, so two people can't clear the same debt twice. Partial payments are fine.

:::note
Former members who still have an open balance can be included in a settlement, so old debts can still be cleared after someone leaves.
:::

When a settlement is recorded, the other person gets a **Settlement recorded** notification with the amount, the group and your note.

## Undoing a settlement

If a payment was recorded by mistake, choose **Undo** on the confirmation that appears right after you record it (this also works for **Settle all mine**). Either person in the settlement, or a group admin, is allowed to undo a settlement. Settlements can also be undone later through FinAI or a connected MCP client.

Undoing a settlement reopens that balance, adds a "payment undone" entry to the group's history, and notifies the other person ("Payment undone").

## Settlements and edited expenses

If an expense is edited after a settlement was recorded, the settlement stays as a real payment. If your share went down, you may end up with a credit, which shows as money owed to you.

## Leaving a group

You can only leave a group, or be removed from one, when your balance there is **zero**. Settle up first. See [Groups and splits](/guide/groups-and-splits#leaving-and-removing-members).

## Offline

Settlements are saved on your device first and sent when you reconnect. If the balance changed in the meantime and the payment would now overshoot, the server rejects it and FinApp shows the error.

## Notifications

Settlement notifications follow the **Settlements** switch in **Settings > Notifications**.
