---
title: Deploying the MCP server
description: Environment variables, signing keys, deployment order and the verification checklist for Finapp's MCP server.
order: 5
---

The MCP server runs inside the Next.js web app (`apps/web/app/mcp/route.ts`), and its OAuth state lives in Convex. Both deployments need configuration, and a successful hosting build does not prove that OAuth or the Convex functions are ready. For the rest of the stack, see [Deployment](/self-hosting/deployment).

Use one canonical public HTTPS origin for the production issuer and resource, and keep preview and production configuration separate. The issuer must match between the web app and Convex, and the client-facing resource audience stays distinct from the backend-only audience.

## Environment variables

| Variable                      | Web deployment                                                                                                      | Convex deployment                                             |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `NEXT_PUBLIC_CONVEX_URL`      | Required: the target Convex deployment URL. Rebuild after changing it.                                              | Not used.                                                     |
| `CONVEX_SITE_URL`             | Not used by MCP.                                                                                                    | Required by Convex Auth; keep the deployment's correct value. |
| `MCP_ISSUER_URL`              | Required: canonical web HTTPS origin, no path.                                                                      | Required to enable the MCP JWT provider. Use the same issuer. |
| `MCP_RESOURCE_URL`            | Recommended: `https://your-finapp.example/mcp`. Defaults to `/mcp` on the issuer. Must use HTTPS outside localhost. | Not used.                                                     |
| `MCP_SIGNING_KEY_ID`          | Required: a stable key ID, also published as the JWKS `kid`.                                                        | Not used.                                                     |
| `MCP_SIGNING_PRIVATE_KEY`     | Required: PKCS#8 RSA private key (at least 2048 bits). Server-only secret.                                          | Do not set; never distribute the private key.                 |
| `MCP_SIGNING_PUBLIC_KEY`      | Required: SPKI public key matching the private key.                                                                 | Not used; Convex reads the public JWKS from the issuer.       |
| `MCP_ALLOWED_ORIGINS`         | Optional: comma-separated exact browser origins in addition to the defaults.                                        | Not used.                                                     |
| `OPENAI_APPS_CHALLENGE_TOKEN` | Optional: the ChatGPT app domain verification token, served at `/.well-known/openai-apps-challenge`.                | Not used.                                                     |

The web server accepts PEM values with real newlines or escaped `\n` sequences. Use your hosting provider's secret manager and never commit private keys, tokens, Convex deploy keys or environment files.

## Generating signing keys

Generate a matching RSA key pair with OpenSSL:

```bash
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:3072 -out mcp-private.pem
openssl pkey -in mcp-private.pem -pubout -out mcp-public.pem
```

Store the private key securely outside the repository. Set the PEM **contents**, not file paths, in the web environment. Choose a unique key ID and deploy both keys together.

:::warning
The server publishes one key at a time. Replacing it invalidates access tokens signed with the old key (they last up to an hour), so connected clients must refresh or reauthorize. Coordinate key rotation accordingly.
:::

## Deployment order

1. Configure the web issuer, resource, key pair, key ID and Convex URL.
2. Deploy the web app and check that the public JWKS and discovery metadata are reachable without any hosting-provider login or deployment protection.
3. Set the same `MCP_ISSUER_URL` in the target Convex deployment.
4. Deploy the Convex schema, functions and `convex/auth.config.ts` to that deployment. The web deployment does not deploy Convex functions.
5. Run the verification checklist below with a dedicated account.
6. Confirm the production alias points at the intended Git commit, not just a successful preview deployment.

When upgrading from an older MCP provider configuration, deploy the new Convex auth configuration **before** the web cutover. It accepts only the `finapp-mcp-backend` audience and stops accepting client-facing tokens directly. A brief MCP interruption while the web deployment catches up is preferable to leaving a direct-token path open. Non-MCP Convex authentication is unchanged.

The MCP sign-in reuses Finapp's email and password sign-in with email verification and two-factor. It does not configure Google, Apple or other social sign-in providers.

## Verifying a deployment

Use the exact deployed URL. Discovery and JWKS must not redirect to a hosting login screen. Replace `https://your-finapp.example`:

```bash
curl -i https://your-finapp.example/.well-known/oauth-protected-resource/mcp
curl -i https://your-finapp.example/.well-known/oauth-authorization-server
curl -i https://your-finapp.example/.well-known/jwks.json
curl -i https://your-finapp.example/mcp/status
curl -i -X POST https://your-finapp.example/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  --data '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-25","capabilities":{},"clientInfo":{"name":"deployment-check","version":"1.0.0"}}}'
```

Expected results:

1. The dashboard and login render on desktop and mobile. An invalid consent request shows a recoverable error without approving access.
2. Discovery returns JSON with the intended issuer, resource and endpoint URLs.
3. JWKS returns only a public RSA key matching the deployed key ID.
4. The unauthenticated `POST` returns `401` with a `WWW-Authenticate` header pointing at the protected-resource metadata. This alone does **not** prove that an authorized tool call works.
5. With MCP Inspector or a supported client, complete registration, login, consent and token exchange. Confirm `initialize` and `tools/list` work, and that a refresh-token exchange returns a new token pair.
6. Call `finapp.catalog`, a domain parent and a bounded read with a dedicated account. Check the next cursor, filters and timestamp boundaries.
7. A read-only grant must reject a finance write tool. Verify isolation with separately owned records and group membership, without changing production financial data.
8. Revoke the grant under Permissions; its next MCP request must be rejected.
9. Tool activity appears without arguments or result data being recorded.

A production deployment isn't fully verified until the authenticated steps pass against its intended Convex backend. Fixture-based UI checks or an in-memory MCP test don't replace a real OAuth and Convex test.

### Automated checks

From the repository root:

```bash
bun run --cwd apps/web test ../../tests/web/mcp-http.test.ts ../../tests/web/mcp-plugin.test.ts
```

`mcp-http.test.ts` uses the real MCP HTTP client and transport with an isolated authorization fixture. It catches an endpoint that never connects its server to the transport and checks missing-token and revoked-grant rejection. `mcp-plugin.test.ts` covers the tool list and catalog accuracy, scope enforcement, schema validation, error mapping, line-item forwarding, widget resources, the browser redirect and `/mcp/status`. The `tests/web` folder also has tests for the token body limit, the credential boundary and the authorization callback. None of these verify production credentials or data.

## Implementation map

| Path                                                   | Role                                                                        |
| ------------------------------------------------------ | --------------------------------------------------------------------------- |
| `apps/web/app/mcp/route.ts`                            | Protected Streamable HTTP transport                                         |
| `apps/web/app/mcp/status/route.ts`                     | Public status JSON                                                          |
| `apps/web/app/mcp/`                                    | Dashboard, login, consent and client credentials UI                         |
| `apps/web/app/oauth/` and `apps/web/app/.well-known/`  | OAuth and discovery endpoints                                               |
| `packages/mcp/src/server.ts`                           | Registration, catalog and parents, scope and access checks, errors          |
| `packages/mcp/src/tools/`                              | Tool definitions per domain (zod schemas, Convex calls)                     |
| `packages/mcp/src/toolkit.ts`, `money.ts`, `errors.ts` | Shared schemas, line items, money formatting, error mapping                 |
| `packages/mcp/src/oauth.ts`, `metadata.ts`             | Issuer and resource helpers, JWTs, JWKS, discovery metadata                 |
| `packages/widgets/`                                    | MCP Apps widget HTML, runtime and tool links                                |
| `convex/mcp.ts`                                        | Authenticated, bounded read projections                                     |
| `convex/mcpOAuth.ts`                                   | Clients, authorization codes, grants, refresh tokens, settings and activity |
| `convex/auth.config.ts`                                | Convex Auth and the MCP custom-JWT provider                                 |
| `packages/ui/src/mcp/`                                 | Shared dashboard workspace components                                       |

## References

- [MCP authorization specification](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization)
- [MCP transports](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports)
- [ChatGPT custom MCP connections](https://help.openai.com/en/articles/12584461-connecting-custom-mcp-servers-in-chatgpt)
- [Claude remote MCP connectors](https://support.claude.com/en/articles/11175166-getting-started-with-custom-connectors-using-remote-mcp)
- [Convex custom JWT authentication](https://docs.convex.dev/auth/advanced/custom-jwt)
- [MCP Apps overview](https://modelcontextprotocol.io/extensions/apps/overview)
