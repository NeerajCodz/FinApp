---
title: Security and privacy
description: Two-factor sign-in with email codes or an authenticator app, recovery codes, signed-in devices, sign-in alerts, app lock, privacy controls and account deletion.
order: 14
---

Open **Settings → Security** on web or mobile to protect your account. The header shows how many of three protections are on: two-factor sign-in, a screen or app lock, and new sign-in alerts. Privacy and account deletion live under **Settings → Privacy**.

Security settings that are stored on the server need a live connection. App lock is stored on the device.

## Two-factor sign-in

Two-factor sign-in asks for a second code after your password. There are two ways to get that code.

### Email codes

Turn on **Email codes** to receive a six-digit code by email each time you sign in. Codes expire after ten minutes.

### Authenticator app

You can use Google Authenticator, 1Password, Authy or any app that supports standard time-based codes (TOTP).

1. Under **Authenticator app**, choose **Set up**.
2. Scan the QR code with your app, or type the key shown under it.
3. Enter the six-digit code the app shows to finish.

Once an authenticator app is on, sign-in always asks for a second step, and it asks for a code from the app first. You can still choose to have a code emailed to you or use a recovery code instead. Each app code can be used only once, and codes from one step either side of the current 30-second window are accepted to allow for clock drift.

To turn the authenticator app off, choose **Turn off** and enter a current code from the app or one of your recovery codes.

:::note
On a self-hosted server, the authenticator option shows _Not available on this server yet_ until the server's encryption key is configured.
:::

### Recovery codes

When you set up your first authenticator app you get **10 recovery codes**. They are shown only once, so copy or download them and keep them somewhere safe.

- Each code works once, in place of an authenticator code, at sign-in.
- Settings shows how many codes you have left.
- You can generate a new set at any time. With an authenticator app on, that requires a current app code or an unused recovery code. Generating a new set makes the old codes stop working.

Finapp stores only hashes of recovery codes, and the authenticator secret is encrypted on the server.

## Signed-in devices

The **Devices** list shows everywhere you're signed in, such as "Chrome on Windows" or a phone model, with when each one was last active. The device you're using is marked as the current one.

- Sign out a single device you don't recognise. It has to sign in again.
- Use **Sign out of all other devices** to end every session except this one.

You can't sign out the current device from this list; use the normal sign-out instead.

## New sign-in alerts

With **New sign-in alerts** on (the default), you get a _New sign-in to your account_ notification when a new device signs in while another device is already signed in. If it wasn't you, sign that device out under Settings → Security and change your password.

You're also notified when a new AI app connects to your account through MCP. You can disconnect it under **Settings → AI → MCP connections**.

## App lock

App lock hides Finapp behind a check when you come back to it. It guards the screen on that device only.

|            | Mobile app                                                        | Web browser                             |
| ---------- | ----------------------------------------------------------------- | --------------------------------------- |
| Biometrics | Face ID or Touch ID on iOS, fingerprint or face unlock on Android | Passkey (where the browser supports it) |
| Passcode   | Six-digit passcode                                                | Six-digit passcode                      |
| Lock after | Immediately, 1, 5 (default), 15 or 30 minutes, or 1 hour          | Same options                            |

On the web, after five wrong passcode attempts the lock pauses for 30 seconds. If you forget your passcode, choose **Forgot it? Recover with email** on the web or **Forgot passcode?** in the mobile app, and enter the code sent to your email address.

:::warning
The browser lock guards the screen. It does not encrypt the copy of your data stored in the browser. On a shared computer, sign out instead. See [Sync and offline](/guide/sync-and-offline).
:::

## Privacy controls

Under **Settings → Privacy**:

| Setting              | What it does                                          | Default  |
| -------------------- | ----------------------------------------------------- | -------- |
| Show me in search    | Off: people need your exact username to find you      | On       |
| Friend requests from | Everyone or Nobody                                    | Everyone |
| Show when I'm active | Shows your active status, including typing indicators | On       |
| Show my last seen    | Shows when you were last active                       | On       |

People can still add you to a group or split once you share an invite link with them. Amounts, balances, account names and notes are never sent in telemetry, and only the people you split with see shared expenses.

Public profiles at `/@username` show only safe identity fields. Shared group activity appears only when both you and the viewer are active members of that group.

## Deleting your account

Choose **Delete my account** under **Settings → Privacy** to request permanent deletion of your account and all its data.

- The request is recorded and processed afterwards, not instantly. You'll receive a notification confirming it.
- Until it's processed, the screen shows **Deletion requested** and you can cancel the request.
- [Export your data](/guide/export) first if you want to keep anything.
