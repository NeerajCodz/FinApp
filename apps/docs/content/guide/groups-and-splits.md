---
title: Groups and splits
description: Share costs with groups, invite members, and split expenses equally, exactly, by percent, by shares or by item.
order: 7
---

A group is a private shared ledger for people who spend together: flatmates, a trip, an office lunch club. Members add shared expenses, FinApp works out who owes whom, and you [settle up](/guide/settlements) when you're ready.

## Create a group

Open **Groups** (or **People > Groups**) and choose **New group** (`/groups/new` on web).

| Field               | Rules                                                                          |
| ------------------- | ------------------------------------------------------------------------------ |
| Name                | Required, for example "Goa Trip" or "Flatmates".                               |
| Currency            | Required. One of the 26 supported currencies. It **can't be changed** later.   |
| Icon and color      | An emoji (up to 16 characters) or a Lucide or Phosphor icon, plus a hex color. |
| Description         | Optional, up to **200** characters.                                            |
| Group type          | Optional: Household, Office, Event or Other.                                   |
| Purpose, location   | Optional, for example "Travel, rent, food" and a city.                         |
| Start and end dates | Optional.                                                                      |
| Invite members      | Search by username and add people to invite.                                   |

You become the group's **owner**. Everyone you add gets an invitation and a notification.

:::note
On mobile you can also invite people by phone number when creating a group. This needs a verified phone number on your own profile.
:::

## Roles

| Role       | Can do                                                                                                                                                                                                                    |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Owner**  | Everything an admin can, plus transfer ownership. There is exactly one owner.                                                                                                                                             |
| **Admin**  | Edit the group's details and settings, invite and remove members, change roles between admin and member, create and revoke invitation links, edit or delete anyone's expenses, pin any chat message, undo any settlement. |
| **Member** | Add expenses, edit or delete their own expenses, record settlements they are part of, chat, and pin their own messages.                                                                                                   |

### Transfer ownership

The owner can hand the group to another current member in one step. The new owner takes over, and the previous owner stays on as an admin (and can then leave).

## Invitations

### Invite by username

Admins can invite people by username (3 to 32 lowercase letters, numbers or underscores). You can't invite yourself or someone who's already a member. The person gets a notification and can **accept** or **decline** from the Groups inbox or straight from the notification. Accepted members join as **members**.

### Invitation links

Admins can create a shareable link (`/group/invite?token=...`):

- Links expire after **1 day**, **7 days** (default) or **30 days**.
- Creating a new link **invalidates** the previous one.
- Admins can **revoke** a link at any time.

Anyone opening the link sees a safe preview of the group. They must sign in (or sign up) and then explicitly accept to join. The link survives sign-up, email verification and onboarding.

:::note
Invitations, membership and role changes need a live connection. They aren't queued offline.
:::

## Leaving and removing members

- A member can **leave** a group only when their balance in it is **zero**. Settle up first.
- An admin can **remove** a member, also only when that member's balance is zero.
- The **owner can't leave** or be removed. Transfer ownership first.

People who've left stay on the expenses they were part of, and they can still be included in settlements to clear an old balance.

## Group expenses

Open a group and choose **Add expense** (`/group/:id/new` or `/split/new` on web). The composer walks through **amount, details, who paid, split**.

| Field                     | Rules                                                         |
| ------------------------- | ------------------------------------------------------------- |
| Title and amount          | Required. Amount greater than zero.                           |
| Account                   | One of your own active accounts, in the **group's currency**. |
| Merchant, category, notes | Optional. The category is one of your own categories.         |
| Date                      | Required.                                                     |
| Participants              | At least one current group member.                            |

The person adding an expense is recorded as **who paid**. The full amount is recorded as an expense on the account you chose. To change payers, or to split the payment between several payers, edit the expense afterwards.

### Split methods

| Method      | How it works                                                                                                                                                                                |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Equally** | Everyone pays the same. Leftover cents go to people in a fixed order, so the split never depends on who you selected first.                                                                 |
| **Exact**   | Type each person's amount. Amounts must add up to the total.                                                                                                                                |
| **Percent** | Shares of 100%. Each value is 0 to 100 with up to two decimals, and they must add up to exactly 100%.                                                                                       |
| **Shares**  | Whole-number units, for example 2 : 1. At least one person needs a share.                                                                                                                   |
| **By item** | Who had what. Add [line items](/guide/transactions#line-items) and pick who shared each one. An item with nobody picked is shared by everyone. Each item is split equally among its people. |

Line items work with every method. With methods other than **By item**, they're simply a breakdown of the bill.

### Edit or delete an expense

The person who added an expense, or any admin, can edit or delete it. When someone else changes the expense while you're editing, FinApp stops your save so you don't overwrite their change.

When an expense changes, balances are recalculated. Settlements already recorded stay as real payments, so if your share goes down you end up with a credit. Affected members are notified, and every change is kept in the group's history.

### Late joiners

When someone joins after expenses were added, an admin (or the expense's creator) can add them to existing expenses, up to 50 expenses and 20 people at a time:

- **Equal** splits are recalculated across everyone.
- **Shares** splits give each newcomer one share.
- **Exact** and **percentage** splits need a manual edit.

## Balances

Each group shows who owes and who is owed. Balances only appear when FinApp has the **complete** group ledger. If part of it can't be loaded, no partial balance is shown. See [Settlements](/guide/settlements) for paying people back.

## Group chat

Every group has a chat (`/group/:id/chat` on web). See [People and chat](/guide/people-and-chat#group-chat).
