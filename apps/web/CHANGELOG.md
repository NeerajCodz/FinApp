# Web app (@finapp/web)

Versions are tracked in the root `version.json`; see `docs/versioning.md`.

## 1.11.0

- Budgets pages removed (`/budgets` and `/budget/*` redirect to `/categories`); category limits
  with alert levels on the category list, detail, form and analytics; home "Category limits"
- Charts from `@finapp/ui/charts` across analytics, home, categories and goals
- Notifications inbox, profile edit and About redesigned
- "Lock after" setting for the browser lock (default 5 minutes)
- One add-transaction button on Activity; logo status icons only on phones
- MCP server moved to `@finapp/mcp`; widgets from `@finapp/widgets`

## 1.10.1

- Redesigned browser lock screen (brand, avatar in accent ring, name, @username, PIN boxes, sign
  out)
- Two-factor step with authenticator, email and recovery codes; authenticator app and recovery
  code settings in Security
- Signed-in visitors are sent from the landing, sign-in and sign-up pages to the dashboard; no
  bounce back to sign-in right after two-factor sign-in

## 1.10.0

- Trash page and settings; category delete with keep or trash transactions
- Sync and notifications in the header and sidebar; sidebar notification and People badges;
  phone nav with Profile; compact profile tiles with Trash
- FinAI: live text with smooth reveal; launcher orb and unread badge while replies run in the
  background; toast with Open; `/finai?c=` opens a chat
- FinAI attachments: paperclip, drag and drop, paste, upload progress; attachment settings
- MCP access control, per-app permissions, dashboard shortcuts
- Redesigned Security (devices, sign-in alerts), Privacy (discoverability, friend requests,
  deletion request), Appearance, Currency, Notifications and Sync settings

## 1.9.0

- Settings hub and Profile redesigned; AI settings: FinAI, API keys (BYOK), MCP connections
- FinAI launcher and step list follow FinAI settings

## 1.8.0

- OAuth for every MCP client registration method (CIMD, DCR with secrets or `private_key_jwt`,
  dashboard client credentials). Adds refresh tokens, RFC 9207 `iss`, OpenID discovery and
  domain verification.
- _OAuth setup_ panel on the MCP dashboard

## 1.7.1

- Redesigned public profile, shown inside the app shell for signed-in viewers

## 1.7.0

- People hub (`/network`), people and person analytics; nav: People replaces Groups/People,
  Goals on the phone bar, profile avatar in the phone header

## 1.6.0

- Voice messages (record and play) in group chats and DMs
- Full-screen group chat with a compact header that opens group settings; new message bar

## 1.5.1

- Redesigned bottom navigation bar (solid, icons contained, + inline)

## 1.5.0

- FinAI launcher panel with logo, tool steps and Markdown replies
- Page width system for desktop; opaque popups; new typography roles

## 1.4.0

Shipped in FinApp 1.4.0. See the root [CHANGELOG](../../CHANGELOG.md) for highlights.
