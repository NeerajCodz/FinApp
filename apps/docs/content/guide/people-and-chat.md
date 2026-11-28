---
title: People and chat
description: Find friends, manage friend requests, message people directly and chat in groups, with privacy controls for search and presence.
order: 9
---

FinApp has a social side: you add friends, see what you share with them, message them directly, and chat in your groups.

## The People hub

**People** (in the web sidebar and the mobile tab bar) brings people and groups together on one page:

- **Search people and groups**,
- a row of **people cards** showing who's active and unread-message badges,
- your **groups** with their balances,
- **People analytics** across your network.

From here you can open the full People and Groups pages, manage requests and start conversations. Friend requests and group invitations are managed from a popup.

## Finding people

Search by **username**. Results match usernames that start with what you type, up to 20 people at a time.

- People who turned off **Show me in search** only appear when you type their **exact** username.
- **Suggestions** come from your friends' friends and show how many **mutual friends** you have.

### Public profiles

Every user with a username has a profile at `/@username` (legacy `/user/...` and `/people/...` links redirect there). Profiles show safe identity details like name, username and avatar, and can be opened without signing in.

When you're signed in, a profile also shows:

- chips for friends, shared groups and mutual friends,
- actions: **Message**, **Add friend** or **Accept**, **Split**, **Settle** and **Analytics**,
- stats: your balance together, shared expenses, messages, and how long you've been connected,
- shared groups, mutual friends, and activity between you.

Shared group activity only appears when **both** of you are active members of that group.

## Friends

### Send a request

Choose **Add friend** on someone's profile or in search results.

- Both of you need a verified email address.
- You can't send a request to yourself or to someone who's already your friend.
- If the person set **Friend requests from** to **Nobody**, the request is refused.
- If they already sent you a request, sending one back **accepts** it straight away.

The other person gets a notification and can **accept** or **decline** from People, the requests popup, or the notifications inbox. You can **cancel** a pending request you sent. When a request is accepted, the sender is notified.

### Remove a friend

Remove a friend from their profile. You can send a new request later.

## Per-person analytics

Open **Analytics** on a friend's profile to see your relationship over time: 30-day message activity, the mix of message types, and the groups you share. Each group card links to that group's analytics.

## Direct messages

Accepted friends can start a direct conversation from People or a profile (`/messages/:conversationId`). You need to be friends to **start** a conversation.

| Content        | Limits                                         |
| -------------- | ---------------------------------------------- |
| Text           | Up to **4,000** characters.                    |
| Images         | JPEG, PNG or WebP, up to **5 MB** each.        |
| Voice messages | 0.5 seconds to **5 minutes**, up to **10 MB**. |

Other features:

- **Reactions**: ❤️, 👍, 😂 or 😮. You get one reaction per message. Choosing the same one again removes it, and choosing another replaces it.
- **Pins**: either person can pin messages, up to **20** pinned messages per conversation.
- **Typing, presence and read receipts**: see when the other person is typing, whether they're online, and what they've read.
- **Unread badges**: counts stop at **99+**.

:::note
Chat messages are not part of Trash. Chat and uploads need a live connection.
:::

## Group chat

Every group has its own chat, open to all current members (`/group/:id/chat` on web). The header shows the group name and who's online or typing, and opens the group's settings.

- **Text** up to **4,000** characters.
- **Bill images**: JPEG, PNG or WebP, up to **5 MB**. Share receipts so everyone can check the numbers.
- **Voice messages**: 0.5 seconds to 5 minutes, up to 10 MB.
- **Reactions**: the same four emoji, one per member per message.
- **Pins**: up to **20** per group. Members can pin their own messages, and admins can pin any message.

### Disappearing messages

Group admins can turn on disappearing messages in the group settings, with messages removed after **1 day**, **7 days** or **30 days**. Turn it off to keep messages. Turning it on applies to existing history too. Voice clips and their audio files are removed when they expire.

## Privacy and presence

Choose who can find and contact you in **Settings > Privacy**:

| Setting                  | Effect                                                                              |
| ------------------------ | ----------------------------------------------------------------------------------- |
| **Show me in search**    | On by default. When off, people need your exact username to find you.               |
| **Friend requests from** | **Everyone** (default) or **Nobody**.                                               |
| **Show when I'm active** | Shows your online status in chats. Turning it off also hides your typing indicator. |
| **Show my last seen**    | Shows when you were last active.                                                    |

People can still add you to a group or a split once you share an invite link with them. Balances, amounts, account names and notes are never shared outside the groups you split with.

## Notifications

Friend requests and accepted requests notify you. Use the **Friends** switch in **Settings > Notifications** to turn them on or off, and the **Friends** filter in the notifications inbox to see them together.
