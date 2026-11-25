# FinApp changelog

Product releases. Each release lists the component versions it shipped with; component
changelogs: [web](apps/web/CHANGELOG.md), [mobile](apps/mobile/CHANGELOG.md),
[ui](packages/ui/CHANGELOG.md), [backend](convex/CHANGELOG.md). Each GitHub release carries
its manifest as `version.json`
(`https://github.com/NeerajCodz/FinApp/releases/download/finapp-v<version>/version.json`).

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
