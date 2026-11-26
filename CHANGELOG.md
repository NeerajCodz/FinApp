# FinApp changelog

Product releases. Each release lists the component versions it shipped with; component
changelogs: [web](apps/web/CHANGELOG.md), [mobile](apps/mobile/CHANGELOG.md),
[ui](packages/ui/CHANGELOG.md), [backend](convex/CHANGELOG.md). Each GitHub release carries
its manifest as `version.json`
(`https://github.com/NeerajCodz/FinApp/releases/download/finapp-v<version>/version.json`).

## 1.11.0

Web 1.11.0 · Mobile 1.11.0 · UI 1.11.0 · Backend 1.11.0 · API 1 · Schema 9

Budgets fold into categories, new charts everywhere, a new notifications inbox, and an MCP
server that can do everything the app can.

- **Category limits replace Budgets**: a category's monthly limit is its budget. Set a limit and
  an alert level (default 80%) on any category and see a usage ring, meter and what's left or
  over. Alerts fire at the alert level and at 100%. The separate Budgets pages are gone (old
  links open Categories), and existing budgets move onto their categories. Home shows the three
  categories closest to their limit.
- **New charts**: cash flow, spending, category breakdowns, limits and goals use one chart set
  on web and mobile, with real amounts on the axes, hover and tap details, and no scroll boxes.
- **Notifications inbox**: grouped by day with filters (Unread, Money, Shared, Friends,
  Security), accept or decline friend requests and invites right in the list, mark read or
  unread, delete with undo, and mark all read. Swipe on mobile, hover on web.
- **Profile edit**: upload a photo or pick an avatar, a username with a live availability check,
  a short bio, phone and a searchable time zone, with a save bar for unsaved changes.
- **About**: version and update status, what's new, versions with copyable diagnostics, and
  links.
- **Lock after**: choose how long Finapp can be away before the lock asks again, from
  immediately to an hour (default 5 minutes), on web and mobile.
- **MCP**: tools for everything the app can do, including Trash, transferring group ownership,
  removing friends, your inbox and activity with a person, signed-in devices and FinAI settings,
  and 183 widgets with charts in Claude and ChatGPT.
- **Fixes**: Activity has one add button, and the status icons next to the logo show only on
  phones.
- **Update required**: the mobile app needs 1.11.0 or later.

## 1.10.1

Web 1.10.1 · Mobile 1.10.1 · UI 1.10.1 · Backend 1.10.1 · API 1 · Schema 8

A new lock screen, authenticator apps and recovery codes, and smoother sign-in.

- **Lock screen**: redesigned on web and mobile with the Finapp logo, your photo in your accent
  colour, your name and @username, a six-digit PIN that unlocks as you type the last digit, and
  "Not you? Sign out". It follows your theme and custom accent.
- **Authenticator apps**: turn on codes from Google Authenticator, 1Password, Authy or any TOTP
  app in Settings → Security (scan the QR code, enter the key by hand, or open the setup link on
  your phone). Sign-in then asks for an app code; email codes stay available as a fallback.
- **Recovery codes**: ten single-use codes when you set up an authenticator app, to sign in if you
  lose your phone. See how many are left and make new ones any time.
- **Sign-in**: after the two-factor code you go straight to your dashboard, and opening the
  landing, sign-in or sign-up page while signed in takes you to the dashboard instead of looking
  signed out. The two-factor step lets you switch between app, email and recovery codes.
- **Security notifications** when an authenticator app is turned on or off and when a recovery
  code is used.

## 1.10.0

Web 1.10.0 · Mobile 1.10.0 · UI 1.10.0 · Backend 1.10.0 · API 1 · Schema 7

Trash for everything, FinAI that can do everything (with live replies and attachments), MCP
access control, and redesigned settings on web and mobile.

- **Trash**: deleting a transaction, account, category, budget, goal or recurring payment moves
  it to Trash. Restore it (a category or account brings back what went with it) or delete it for
  good. Trash empties itself after the time you choose in Settings → Trash. Deleting a category
  asks whether to keep its transactions or move them to Trash too.
- **Navigation**: the mobile tab bar is Home, Activity, +, People, Profile. Home has sync and
  notifications (with a badge) at the top right. Profile tiles are a compact grid with Trash in
  place of Budgets. The web sidebar shows notification and unread-chat badges.
- **Notifications**: friend requests and accepted requests notify you; titles and messages follow
  one format everywhere.
- **FinAI can do everything**: edit transactions; create and edit budgets, goals, categories,
  accounts and recurring payments; delete anything; restore from or empty the Trash. Deleting a
  transaction happens right away (it goes to Trash). Deleting anything else, and deleting for
  good, asks you to confirm first.
- **Live FinAI replies**: text streams in smoothly as it's written, and Markdown renders correctly
  while it streams.
- **Fewer "FinAI took too long" errors**: overloaded models are skipped quickly, FinAI shows when
  it's thinking, and a stalled reply retries on another model.
- **Replies in the background**: close FinAI while it works. The launcher shows the thinking orb,
  then a badge, and a toast with **Open** appears when the reply lands. Chats with new replies are
  marked.
- **Attachments**: attach images, PDFs, Excel (.xlsx), CSV and text files up to 10 MB (5 per
  message). FinAI reads receipts, bills and statements, and can **import a whole spreadsheet** as
  transactions behind one confirmation. Attachments are deleted after 24 hours by default
  (1 hour, 7 days, 30 days or never in FinAI settings).
- **MCP**: an access-control section with a master switch, read-only mode, deletes on or off and
  per-tool blocking, plus per-app permissions you can change after connecting. Changes apply on
  the app's next request. New tools: Trash and recurring delete. Shortcuts to the MCP dashboard
  from Settings, the AI hub and Profile.
- **Security**: see every device signed in to your account and sign out any of them, or all
  others at once. Get an alert when a new device signs in. Two-factor, change password and the
  screen or app lock are on one redesigned page.
- **Privacy**: choose whether you show up in search and who can send you friend requests, control
  your activity status, export your data, and request account deletion (cancellable).
- **Redesigned settings**: Appearance, Currency (now searchable), Notifications (grouped, with a
  new Friends switch) and Sync (live status and Sync now) match the rest of Settings on web and
  mobile.

## 1.9.0

Web 1.9.0 · Mobile 1.9.0 · UI 1.9.0 · Backend 1.9.0 · API 1 · Schema 6

A new **AI** section in Settings and Profile, plus redesigned settings and profile screens on web
and mobile.

- **FinAI settings**: turn FinAI on or off, and choose:
  - Tone (friendly, concise, professional or playful), answer length, reply language and emoji.
  - "About you" and custom instructions FinAI keeps in mind.
  - What FinAI can read (money, budgets and goals, groups, people). Turning one off removes those
    tools.
  - Whether it may prepare changes, answer `@finai` in chats and auto-categorise receipts.
  - Whether to show the floating button and the step list.
  - A button to clear all FinAI history.
- **API keys (bring your own key)**: run FinAI on your own OpenAI, Anthropic, Google Gemini,
  OpenRouter, Groq, Mistral, xAI or DeepSeek account, or any OpenAI-compatible endpoint.
  - Keys are checked with the provider, encrypted on the server (AES-256-GCM, tied to your
    account) and never shown again.
  - Tools, cards and confirmations work the same on every model.
  - Switch back to the built-in model at any time.
- **MCP connections**: see the AI apps connected to your Finapp and what each may do. Disconnect
  them, and manage the client credentials you created for ChatGPT.
- **Settings and Profile redesigned**: grouped cards with icons and descriptions, two columns on
  large screens.
  - Profile: a cover and avatar header, workspace tiles, a gear button for Settings, and the new AI
    section.

## 1.8.0

Web 1.8.0 · Mobile 1.7.1 (build 16) · UI 1.7.1 · Backend 1.8.0 · API 1 · Schema 6

Connect Finapp to ChatGPT (and any MCP client) with any OAuth client registration method.

- **Client ID Metadata Documents (CIMD)**: ChatGPT's hosted client document is fetched,
  validated and cached, and its `private_key_jwt` assertions are verified. Each assertion can be
  used only once.
- **Dynamic Client Registration** now accepts public clients, secret clients
  (`client_secret_basic` / `client_secret_post`) and `private_key_jwt` clients.
- **Your own client credentials**: create confidential OAuth clients under _OAuth setup_ on the
  MCP dashboard. Endpoints can be copied from there, and deleting a client disconnects it.
- **Refresh tokens**: valid for 60 days and replaced on every use, so connections no longer drop
  every hour.
- **RFC 9207 `iss`** on every authorization response, which lets ChatGPT use its stable callback
  URL. Errors after a verified redirect are sent back to the client.
- `/.well-known/openid-configuration` is now served. `/.well-known/openai-apps-challenge` answers
  domain verification.
- **ChatGPT plugin package** in `integrations/chatgpt/`: manifest, `mcp.json` and square icons.
- Releases attach their `version.json` manifest instead of keeping `releases/*.json` in the repo.
  Release notes now combine every changelog with the merged pull requests.

## 1.7.1

Web 1.7.1 · Mobile 1.7.1 (build 16) · UI 1.7.1 · Backend 1.7.1 · API 1 · Schema 6

- **Public profiles redesigned** on web and mobile.
  - Header: a cover image, a large avatar with an online dot, the person's handle and presence,
    and chips for friends, shared groups and mutual friends.
  - Actions: Message, Add friend or Accept, Split, Settle and Analytics.
  - Stats: balance, shared expenses, messages, and how long you've been connected.
  - Sections: shared groups, mutual friends, and everything between you.
- On web, signed-in viewers now see profiles inside the app (sidebar and bottom bar). The page
  starts at the top instead of floating in the middle of the screen.
- `.vercelignore` keeps local agent worktrees out of web deploys.

## 1.7.0

Web 1.7.0 · Mobile 1.7.0 (build 15) · UI 1.7.0 · Backend 1.7.0 · API 1 · Schema 6

- **People hub**: People and Groups are now one **People** page. It has search, a row of people
  cards (who's active, unread badges) and your groups with balances. Section titles open the full
  People and Groups pages.
- **People analytics** across your network, and **per-person analytics**: 30-day message
  activity, message mix and shared groups. Each group card links to that group's analytics.
- **Navigation**: the sidebar has a single People entry. The bottom bar on web and mobile is now
  Home, Activity, +, People, Goals. On mobile web, the profile avatar moved to the header.

## 1.6.0

Web 1.6.0 · Mobile 1.6.0 (build 14) · UI 1.6.0 · Backend 1.6.0 · API 1 · Schema 6

- **Voice messages** in group chats and DMs: record with the mic (shown when nothing is typed), play back inline; clips follow the group's disappearing-message setting.
- **Chat screens rebuilt**: a compact header (group name with who is online or typing) that opens group settings, the conversation filling the screen, and the message bar always visible.
- **New message bar**: emoji · message · attach, with send or mic.
- **Disappearing messages**: turning retention on re-times long histories in batches; voice clips and their audio files are removed on expiry.
- Activity in chats no longer shows "Jan 1, 1970" for records without a date.

## 1.5.2

Web 1.5.1 · Mobile 1.5.2 (build 13) · UI 1.5.2 · Backend 1.5.0

- **Mobile**: Profile moved from the tab bar to an avatar at the top right of Home; the bar is now Home, Activity, +, Groups, People (matching the web phone layout).

## 1.5.1

Web 1.5.1 · Mobile 1.5.1 (build 12) · UI 1.5.1 · Backend 1.5.0

- **Bottom bar** redesigned on web (phone widths) and mobile: a solid bar with every icon inside it, the + seated inline, and Profile no longer pushed off a 5-column grid on web.

## 1.5.0

Web 1.5.0 · Mobile 1.5.0 (build 11) · UI 1.5.0 · Backend 1.5.0 · API 1 · Schema 5

- **FinAI identity**: a new FinAI logo; the Thinking Orb now only appears while FinAI is thinking, with a distinct style per stage.
- **Tool steps**: every tool FinAI uses shows in a collapsible process list on the reply, live while it works.
- **Readable replies**: Markdown (bold, lists, headings, code) rendered safely in a serif reading face.
- **Typography**: Space Grotesk for branding and buttons, Manrope for reading, Source Serif 4 for FinAI.
- **Desktop layouts** no longer stretch: forms, lists and dashboards each have a comfortable width.
- **Popups** are fully opaque everywhere.
- Second-round review fixes across FinAI, chat, notifications, ledger and MCP.

## 1.4.0

Web 1.4.0 · Mobile 1.4.0 (build 10) · UI 1.4.0 · Backend 1.4.0 · API 1 · Schema 4

- **FinAI** assistant with live cards, confirm-first actions and `@finai` in group chats and DMs; a floating launcher across the app.
- **Receipt scanning** into itemized transactions, with the category picked by `gemini-decision-1`.
- **Line items** and by-item group splits.
- **Chat**: pins, read receipts, typing indicators, true first-unread divider.
- **MCP plugin** (102 tools) for ChatGPT and Claude.
- **Groups**: ownership handoff, payment reminders, exact split math, per-currency person balances.
- Versioning: `version.json` manifest, release archive, in-app version details and update checks.

## 1.3.0

Groups, settle-up hub, notifications, theme foundation and stability fixes.
