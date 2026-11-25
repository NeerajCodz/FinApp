# FinApp changelog

Product releases. Each release lists the component versions it shipped with; component
changelogs: [web](apps/web/CHANGELOG.md), [mobile](apps/mobile/CHANGELOG.md),
[ui](packages/ui/CHANGELOG.md), [backend](convex/CHANGELOG.md). Manifests live in
[`releases/`](releases/).

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
