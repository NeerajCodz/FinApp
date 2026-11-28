---
title: Connecting a client
description: Connect ChatGPT, Claude or another OAuth-capable MCP client to Finapp and manage the connection afterwards.
order: 2
---

The connector URL is the full MCP endpoint of your Finapp web app, for example `https://your-finapp.example/mcp`. The dashboard's **Connect** tab at `/mcp/dashboard` shows these steps with copy buttons and a live server status check (tool count, widget count and response time).

## ChatGPT

Plans and workspace admins may restrict custom connectors.

1. In ChatGPT open **Settings → Apps & Connectors → Advanced settings** and enable **Developer mode**.
2. Back in **Apps & Connectors**, choose **Create**. Name it `FinApp`, paste the connector URL and leave authentication on **OAuth**.
3. ChatGPT opens Finapp. Sign in, review the requested permissions and approve. Add write access only if you want ChatGPT to make changes.
4. Start a new chat, open **+ → Developer mode** and enable FinApp. Try "Show my FinApp overview for this month."

ChatGPT can register itself in any of the ways Finapp supports: a Client ID Metadata Document (CIMD, recommended), Dynamic Client Registration, or your own client credentials (below). With CIMD and Dynamic Client Registration there is nothing to enter.

The repository also contains a ChatGPT app package in `integrations/chatgpt` (`plugin.json`, `mcp.json` and `assets/`; zip the folder's contents to upload it). It defaults to CIMD.

### Using your own client credentials

ChatGPT also offers a "use your own client credentials" option. To use it:

1. Open `/mcp/dashboard`, go to **OAuth setup** and choose **Create client credentials**.
2. Optionally adjust the redirect URIs (one per line; ChatGPT's connector redirect URI is the default) and the token endpoint auth method (`client_secret_basic` or `client_secret_post`).
3. Copy the **Client ID** and **Client secret** into ChatGPT straight away. The secret is shown only once.

Your clients are listed under **Your clients** on the dashboard, where you can delete them. The **OAuth setup** panel also lists the MCP server URL, authorization URL, token URL, registration URL, authorization server and scopes for manual configuration.

## Claude

Claude web and desktop support remote MCP connectors. On Team and Enterprise plans an owner adds the connector in organisation settings first.

1. Open **Settings → Connectors**.
2. Choose **Add custom connector**, name it `FinApp` and paste the connector URL. Leave the OAuth client fields empty: Finapp supports dynamic client registration.
3. Select **Connect**, sign in to Finapp and approve the permissions you want Claude to have.
4. Enable FinApp from the tools menu in the message box, then ask, for example, "Who owes me in my FinApp groups? Show the balances."

## Other MCP clients

Add a remote **Streamable HTTP** server with the connector URL. The client must support MCP authorization:

- OAuth 2.1 authorization code flow with PKCE `S256`
- Discovery through protected-resource metadata (`/.well-known/oauth-protected-resource/mcp`) and authorization server metadata
- One of: dynamic client registration at `/oauth/register`, a Client ID Metadata Document (an HTTPS URL used as the `client_id`), or pre-created client credentials

Once connected, call `finapp.catalog` first. Clients that support MCP Apps also render Finapp's in-chat widgets.

For local development, MCP Inspector origins on port `6274` are allowed by default.

## The consent screen

During authorization, Finapp shows `/mcp/authorize` with:

- the registered client name and the exact return destination;
- **read access**, which is required;
- the four write permissions (finance, social, groups, personal), which start **unchecked**.

Approve only what you intend to grant. If you decline, Finapp returns `error=access_denied` with the original `state` to the client's registered redirect URI. Invalid requests show a recoverable error page instead and never redirect to the client.

:::warning
Registering a client is not an endorsement by Finapp. Connect only clients you recognise and trust, and never paste the server's signing keys into a client.
:::

When a new app connects, you receive a _New app connected_ security notification naming the app and the number of permissions it has. See [Notifications](/guide/notifications).

## Managing connections

### In Finapp settings

**Settings → AI → MCP connections** (web and mobile) lists every connected app:

- Tap an app to change its permissions. Read access is always included. Changes apply on the app's next request, without reconnecting.
- Disconnect an app to revoke its grant. Its next request is rejected; a request already running may finish.
- **Recently disconnected** shows apps you've revoked.
- **Access control** and **Tool access** let you switch off all apps at once, go read-only, disallow deletes or block individual tools. See [Permissions and security](/mcp/permissions-and-security#account-access-controls).

### On the MCP dashboard

`/mcp/dashboard` is a web control plane with these tabs:

| Tab             | What it shows                                                                                                                                         |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Connect         | Step-by-step guides for ChatGPT, Claude and other clients, and a live status card backed by `/mcp/status`                                             |
| Tools           | The full tool catalog, generated from the server registry, with search, domain and read/write filters, required scope, confirmation and widget badges |
| In-chat widgets | Live previews of every widget, rendered in a sandboxed iframe with fictional sample data                                                              |
| Permissions     | Your active grants (sign in required); include revoked grants to see history; revoke access                                                           |
| Activity        | Recent tool names and outcomes, filterable by domain, time and success or failure                                                                     |

A grant means an app is authorized; it does not mean the app is currently connected.

Activity keeps at most 100 recent events per account, and a view returns at most 50 matching events. Tool arguments and financial results are never recorded. Activity recording is best-effort and is not a complete audit ledger.

## Token lifetime

Access tokens expire after one hour. Clients receive a refresh token with each grant; refresh tokens last 60 days and rotate on every use, so a client stays connected while you use it. Revoking the grant, deleting the account or letting the refresh token expire means the client must authorize again.
