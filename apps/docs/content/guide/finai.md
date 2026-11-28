---
title: FinAI assistant
description: Ask FinAI about your money, let it prepare changes you confirm, attach files, mention it in chats and run it on your own model key.
order: 10
---

FinAI is the assistant built into Finapp. It answers questions about your spending, category limits, goals, groups and friends, and it can prepare changes for you. It works on the web (`/finai`) and in the mobile app, and you can open it from the floating FinAI button on any screen.

## What FinAI can do

FinAI reads your data through the same permissions the app uses, so it only ever sees what you can see.

| Area     | Examples                                                                                           |
| -------- | -------------------------------------------------------------------------------------------------- |
| Money    | Overview, transaction search, spending breakdowns, accounts, categories, recurring payments, Trash |
| Planning | Category limits with their usage, savings goals                                                    |
| Groups   | Your groups, group balances, shared expenses                                                       |
| People   | Your friends list                                                                                  |

It can also prepare changes: new or edited transactions, group expenses, settlements, goal contributions, payment reminders, new or edited goals, categories, category limits, accounts and recurring payments, moving items to Trash, deleting Trash items for good, and bulk imports from spreadsheets (see [Receipts and import](/guide/receipts-and-import)).

## Confirming changes

Most changes FinAI prepares show up as a **confirmation card** under its reply. Nothing is saved until you press **Confirm**.

- A card expires after 30 minutes. After that it can no longer be confirmed; ask again for a fresh one.
- One reply can prepare at most 5 cards.
- You can cancel a card instead of confirming it.
- Each card runs once. Confirming goes through the same checks as doing it yourself in the app, so validation and limits still apply.
- In a group chat or DM, only the person who asked FinAI can confirm or cancel its cards.

Two actions run straight away, without a card, because nothing is lost: **deleting one of your transactions** (it moves to [Trash](/guide/trash) and can be restored) and **restoring an item from Trash**. Everything else, including creates, edits, category limits and deleting from Trash for good, needs a card.

:::note
When **Prepare changes** is off, FinAI can't prepare cards or make the two direct changes above. It explains what you can do yourself instead.
:::

## Attachments

You can attach files to a FinAI message:

- Images (JPEG, PNG, WebP, HEIC/HEIF)
- PDFs
- Spreadsheets (`.xlsx`, `.csv`, `.tsv`)
- Text files (`.txt`, `.md`, `.json`)

Each file can be up to 10 MB, with up to 5 files per message. Uploads that are never sent are deleted after one hour.

After the retention you choose in settings (default **24 hours**; options are 1 hour, 24 hours, 7 days, 30 days or never), the file itself is deleted from storage. The chat keeps the file's name so you can see what was attached. A new retention setting applies to new attachments.

## @finai in chats

Type `@finai` in a group chat or a direct message to ask FinAI a question there. It reads the recent conversation (about the last 30 messages) and the group's ledger, then replies in the thread. In chats it can prepare group expenses, settlements and payment reminders, which only you can confirm.

A thread has one FinAI reply in progress at a time. Mentions that arrive while it is still answering are ignored. Turn this off with **@finai in chats** in settings.

## Settings

Open **Settings → AI → FinAI** on web or mobile.

| Setting                  | What it does                                                                          | Default  |
| ------------------------ | ------------------------------------------------------------------------------------- | -------- |
| FinAI                    | Master switch for the assistant, the floating button and `@finai`                     | On       |
| Tone                     | Friendly, Concise, Professional or Playful                                            | Friendly |
| Answer length            | Short, Balanced or Detailed                                                           | Balanced |
| Language                 | Auto (replies in your language) or a fixed language                                   | Auto     |
| Emoji                    | Allow a few emoji in replies                                                          | Off      |
| About you                | Up to 1,000 characters of context, for example your pay day                           | Empty    |
| Custom instructions      | Up to 1,500 characters on how to answer                                               | Empty    |
| What FinAI can read      | Money, Category limits and goals, Groups, People. Turning one off removes those tools | All on   |
| Prepare changes          | Allow confirmation cards                                                              | On       |
| @finai in chats          | Answer mentions in group chats and DMs                                                | On       |
| Auto-categorise receipts | Pick a category when you scan a receipt                                               | On       |
| Attach files             | Allow attachments                                                                     | On       |
| Delete attachments after | Attachment retention                                                                  | 24 hours |
| Floating FinAI button    | Show the launcher on every screen                                                     | On       |
| Show steps               | Show the tools FinAI used under each reply                                            | On       |

## Bring your own key (BYOK)

By default FinAI runs on Finapp's built-in model. Under **Settings → AI → API keys** you can add your own key instead. Supported providers are OpenAI, Anthropic, Google Gemini, OpenRouter, Groq, Mistral, xAI, DeepSeek and any OpenAI-compatible endpoint (HTTPS, public host).

- A key is checked with the provider before it is saved, then encrypted on the server. It is never shown again; the list shows only a short hint such as `sk-…a1b2`.
- You can keep up to 10 keys and choose which one is active. You can re-check or remove a key at any time.
- The active key is used for the assistant and for `@finai` replies. Usage is billed by your provider. Tools, cards and confirmations work the same on every model.
- If the provider rejects the key, it is marked invalid.

:::note
Receipt scanning always uses Finapp's built-in model, not your own key.
:::

## Limits

Each account has daily limits (reset at midnight UTC): 200 assistant and `@finai` requests and 30 receipt scans. Prompts can be up to 4,000 characters.

## Your history and data

- Conversations stay until you delete them. You can delete one conversation, or use **Clear FinAI history** to delete every assistant conversation and its cards.
- Attachment files are deleted on your retention schedule (see above).
- FinAI only reads what the data switches allow, and only on request. Other people never see your FinAI conversations; `@finai` replies in a chat are visible to that chat's members.
- To let ChatGPT, Claude or another external AI app use your Finapp, see [MCP](/mcp/overview).
