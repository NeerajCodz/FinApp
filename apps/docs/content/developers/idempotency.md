---
title: Idempotency
description: Retry POST requests safely with the Idempotency-Key header.
order: 7
---

Networks fail. If a `POST` times out you can't tell whether it was applied. Send an `Idempotency-Key` header and you can retry without creating duplicates.

## How it works

```bash
curl -X POST https://<deployment>.convex.site/api/v1/transactions \
  -H "Authorization: Bearer $FINAPP_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: 2c1f4b8e-6f0a-4c43-9d0b-0b4bd2f5c1a7" \
  -d '{"accountId":"…","type":"expense","amountMinor":"45000","currency":"INR","title":"Groceries","occurredAt":1764288000000}'
```

- The key is any string of 1 to 255 printable ASCII characters. A UUID per logical operation is ideal.
- Keys are scoped to the credential (the token or the app authorization) and kept for **24 hours**.
- The first request with a key runs normally. Its response (status and body) is stored **in the same database transaction as the change**, so a key can never apply a change twice, even under concurrent retries.
- A later request with the same key and the **same** method, path and body returns the stored response without running again, with the header `Idempotent-Replayed: true`.
- The same key with a **different** request returns `422 idempotency_key_reused`.
- Requests that fail (any error response) are not stored, so you can retry them with the same key.

:::note
Signing secrets are shown once. If you replay a `POST /webhooks` or `POST /webhooks/{id}/rotate-secret` request, the stored response has `"secret": null` and `"secretRedacted": true`. Rotate the secret again if you lost it.
:::

## Which requests

`Idempotency-Key` applies to `POST` endpoints, which create things. `PUT`, `PATCH` and `DELETE` are naturally safe to repeat: setting a budget twice or deleting something already deleted has the same end result (a repeated delete may return an error because the item is gone).

## Retry recipe

1. Generate a key once per operation and keep it with the operation (not per attempt).
2. Retry on network errors, `429` (after `Retry-After`) and `5xx`, with the same key and body.
3. Don't retry other `4xx` errors without fixing the request.
