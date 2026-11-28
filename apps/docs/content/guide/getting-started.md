---
title: Getting started
description: Create your FinApp account, set your currency and time zone, and record your first account and transaction.
order: 1
---

FinApp is a personal finance and shared-expenses app. You track your own accounts, transactions, categories and savings goals, and you split costs with friends in groups, settle up and chat, all in one place.

## Web and mobile apps

FinApp has two apps that share the same account and data:

| App    | What it is                                                                                |
| ------ | ----------------------------------------------------------------------------------------- |
| Web    | A browser app with a sidebar on large screens and a bottom bar on phone-sized screens.    |
| Mobile | A native app (built with Expo) with a tab bar: Home, Activity, **+**, People and Profile. |

Both apps are **offline-first**. Personal finance changes (accounts, transactions, categories, goals, recurring reminders) and supported group-ledger writes are saved on your device first and sent to the server when you are connected. They stay visible while you are offline.

Some actions need a live connection: signing in, changing your username, group invitations and membership changes, chat messages and uploads, and security settings.

:::note
The mobile app checks its version against the server. If an update is required (for example, release 1.11.0 needs mobile 1.11.0 or later), the app asks you to update before you continue.
:::

## Create an account

1. Open the welcome page and choose **Create account**.
2. Enter your **email** and a **password**. Passwords must be at least **8 characters**.
3. FinApp emails you a **six-digit verification code**. Codes expire after **ten minutes**.
4. Enter the code to verify your email, then complete onboarding.

Email and password is the only sign-up method. There is no social or single sign-on option.

### Onboarding

Onboarding walks you through a few short steps:

1. **Currency**: choose the country and currency you use every day. FinApp suggests USD for US English devices and INR otherwise. You can change it later.
2. **Profile**: display name (up to 80 characters), username, gender and an avatar. A live preview shows how people will see you.
3. **Phone number** (optional): helps people find you when they share a split or invite you to a group.
4. **First account** (optional): type a name and FinApp creates a cash account in your chosen currency with a zero opening balance.
5. **How you will use FinApp**: personal only, or with shared expenses ready from day one. Shared mode takes you to Groups; otherwise you land on your dashboard.

Usernames use 3 to 32 lowercase letters, numbers or underscores. Some words are reserved (for example `admin`, `finapp`, `support` and `system`). Setting a username needs a live connection.

If you opened a group invitation link before signing up, FinApp keeps it through sign-up, verification and onboarding and brings you back to the invitation afterwards.

## Sign in

Sign in with your **email or username** and your password. If you forget your password, use **Forgot password** to get a reset code by email.

### Two-factor sign-in

If you turned on two-factor sign-in in **Settings > Security**, FinApp asks for a second code after your password. You can switch between:

- **Authenticator app**: a six-digit code from Google Authenticator, 1Password, Authy or any TOTP app.
- **Email code**: a six-digit code sent to your email, always available as a fallback.
- **Recovery code**: one of the ten single-use codes you saved when you set up the authenticator app.

## Default currency and time zone

Your **default currency** is used for new accounts, category limits and totals. FinApp supports 26 currencies:

`INR`, `USD`, `EUR`, `GBP`, `JPY`, `AUD`, `CAD`, `CHF`, `CNY`, `HKD`, `SGD`, `AED`, `SAR`, `NZD`, `SEK`, `NOK`, `DKK`, `ZAR`, `BRL`, `MXN`, `KRW`, `TRY`, `THB`, `PLN`, `IDR`, `MYR`.

Your **time zone** is taken from your device during onboarding (or UTC if it can't be read). It controls how transaction dates and times are shown. Change either one later: the currency in **Settings > Currency**, and the time zone from **Profile > Edit**.

## Your first account

Accounts hold your balances. Go to **Accounts > New account** (`/accounts/new`), pick a type (bank account, cash, credit card, wallet, loan or custom), a currency and an opening balance. See [Accounts](/guide/accounts) for every option.

## Your first transaction

Tap **+** (mobile) or **Add transaction** (web), then:

1. Choose **Expense**, **Income** or **Transfer**.
2. Enter a title and amount, and pick the account and category.
3. Optionally add a merchant, a note, a date and time, or itemize the bill.
4. Save.

The transaction appears in Activity and Transactions and updates your account balance straight away, even offline. See [Transactions](/guide/transactions) for details.

## Where to go next

- [Categories and budgets](/guide/categories-and-budgets): set monthly limits and get alerts.
- [Goals](/guide/goals): save towards a target.
- [Groups and splits](/guide/groups-and-splits): share costs with other people.
- [People and chat](/guide/people-and-chat): add friends and message them.
