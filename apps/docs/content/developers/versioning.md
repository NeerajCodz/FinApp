---
title: Versioning and changelog
description: How the API is versioned, what counts as a breaking change, and what changed.
order: 10
---

## Versions

The API version is part of the path: `/api/v1`. Within `v1`, FinApp only makes **backwards-compatible** changes. Every response carries the version and the revision date of the contract it follows:

```http
FinApp-Api-Version: v1; revision=2026-11-28
```

`GET /api/v1` returns the same information as JSON.

### Compatible changes (no new version)

- New endpoints, new optional request fields and new query parameters.
- New fields in responses and in webhook payloads.
- New error codes within existing status codes, and new webhook event types (you only receive types you subscribe to).
- New scopes.

Write clients that ignore unknown fields and handle unknown error codes generically.

### Breaking changes (a new version)

Removing or renaming fields or endpoints, changing types or meanings, or making optional fields required ships as `/api/v2`. `v1` keeps working for at least 12 months after `v2` is released, and deprecations are announced here and in the FinApp changelog.

## Webhooks

Webhook payloads include `"apiVersion": "v1"`. They follow the same compatibility rules.

## OpenAPI

`GET /api/v1/openapi.json` always describes the running deployment. Generate clients from it, and diff it to spot additions.

## Changelog

### 2026-11-28: v1

First public release:

- REST API under `/api/v1` for profile, accounts, transactions, categories, budgets (category limits), goals and contributions, groups, group expenses and settlements, recurring rules, notifications, analytics and raw export.
- Personal access tokens with fine-grained scopes and expiry, and OAuth 2.1 apps with PKCE and rotating refresh tokens.
- Cursor pagination, `Idempotency-Key` on `POST`, per-token rate limits, request ids and a consistent error envelope.
- Signed webhooks with retries, a delivery log, secret rotation and automatic pausing.
- Developer activity log in Settings.
