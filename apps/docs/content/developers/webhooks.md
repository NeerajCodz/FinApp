---
title: Webhooks
description: Receive signed events when transactions, budgets, settlements and more change.
order: 9
---

Webhooks push events to your HTTPS endpoint as they happen, so you don't have to poll. FinApp signs every delivery, retries failures with backoff, and keeps a delivery log of status codes.

## Add an endpoint

Either:

- in **Settings → API & developer → Webhooks**, choose **Add endpoint**, enter the URL and pick events; or
- call `POST /api/v1/webhooks` with a token that has `webhooks:manage`:

```bash
curl -X POST https://<deployment>.convex.site/api/v1/webhooks \
  -H "Authorization: Bearer $FINAPP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com/finapp/webhooks","events":["transaction.created","budget.exceeded"]}'
```

The response includes the endpoint's **signing secret** (`whsec_…`), shown only once. Each account can have up to 10 endpoints.

### Allowed URLs

To protect FinApp's infrastructure, endpoint URLs must be public HTTPS addresses:

- `https://` only, no user name or password in the URL;
- not `localhost`, `*.localhost`, `*.local`, `*.internal`, `*.lan`, `*.home.arpa`, `*.corp` or single-label host names;
- not IP addresses in private, loopback, link-local (including cloud metadata `169.254.169.254`), carrier-grade NAT, multicast or reserved ranges, in IPv4 or IPv6 form;
- ports below 1024 other than 443 are refused.

Deliveries never follow redirects: a `3xx` response counts as a failure. For local development, expose your server through a public HTTPS tunnel.

## Events

| Event                                                                        | When                                                                                         |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `transaction.created`, `transaction.updated`, `transaction.deleted`          | A personal transaction, or a group expense you share, changed. Deleted means moved to Trash. |
| `account.created`, `account.updated`, `account.deleted`                      | An account changed or was archived.                                                          |
| `category.created`, `category.updated`, `category.deleted`                   | A category (or its limit) changed or was archived.                                           |
| `budget.threshold_reached`                                                   | Spending in a category crossed its alert level (default 80%) this month.                     |
| `budget.exceeded`                                                            | Spending in a category reached its monthly limit.                                            |
| `goal.created`, `goal.updated`, `goal.deleted`                               | A goal changed or was archived.                                                              |
| `goal_contribution.created`                                                  | Money was added to a goal.                                                                   |
| `recurring_rule.created`, `recurring_rule.updated`, `recurring_rule.deleted` | A recurring rule changed.                                                                    |
| `group.created`, `group.updated`                                             | You created or joined a group, or one of your groups changed.                                |
| `settlement.created`, `settlement.deleted`                                   | A settlement was recorded or undone in one of your groups.                                   |
| `notification.created`                                                       | You received a notification.                                                                 |
| `ping`                                                                       | A test event (from **Send test event** or `POST /webhooks/{id}/test`). Always delivered.     |

Events fire for changes made anywhere (the web app, mobile, FinAI, MCP or the API), because they come from the same place FinApp records changes for sync.

## Payload

Each delivery is a `POST` with a JSON body:

```json
{
  "id": "evt_8u1bN3qJ0x6wYV2a5sKq7g",
  "type": "transaction.created",
  "apiVersion": "v1",
  "createdAt": 1764288000123,
  "data": {
    "id": "k57f…",
    "object": {
      "id": "k57f…",
      "title": "Groceries",
      "type": "expense",
      "amountMinor": "45000",
      "currency": "INR",
      "accountId": "j97a…",
      "occurredAt": 1764288000000
    }
  }
}
```

- `data.object` is the record after the change, with amounts as strings (for hard deletions it is omitted). Fields whose names suggest secrets (tokens, hashes and similar) are always removed.
- Payloads over 64 KB are trimmed to `{ "id", "truncated": true }`; fetch the record from the API.
- `budget.*` events carry `categoryId`, `name`, `currency`, `limitMinor`, `spentMinor` and `thresholdPercent`.

Headers:

| Header                    | Value                                                                          |
| ------------------------- | ------------------------------------------------------------------------------ |
| `FinApp-Event-Id`         | The event `id`. The same event can arrive more than once; deduplicate on this. |
| `FinApp-Event-Type`       | The event type.                                                                |
| `FinApp-Delivery-Attempt` | `1` for the first attempt, then `2`, `3`, …                                    |
| `FinApp-Signature`        | `t=<unix seconds>,v1=<hex signature>` (see below).                             |
| `User-Agent`              | `FinApp-Webhooks/1.0`                                                          |

## Verify signatures

The signature is an HMAC-SHA256, keyed with your endpoint's secret, over the string `<t>.<raw request body>`, hex-encoded. Always:

1. use the **raw** body bytes, before any JSON parsing;
2. compare in constant time;
3. reject timestamps more than 5 minutes from your clock, to stop replays;
4. accept the request if **any** `v1=` value matches (during a secret rotation there are two).

:::tabs

```javascript title="Node.js"
import crypto from 'node:crypto';
import express from 'express';

const app = express();
const secret = process.env.FINAPP_WEBHOOK_SECRET;

function verify(header, rawBody, toleranceSeconds = 300) {
  const parts = Object.groupBy(header.split(','), (part) => part.split('=')[0]);
  const timestamp = Number(parts.t?.[0]?.split('=')[1]);
  if (!Number.isInteger(timestamp)) return false;
  if (Math.abs(Date.now() / 1000 - timestamp) > toleranceSeconds) return false;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody}`)
    .digest('hex');
  return (parts.v1 ?? []).some((part) => {
    const given = Buffer.from(part.split('=')[1] ?? '', 'hex');
    const wanted = Buffer.from(expected, 'hex');
    return given.length === wanted.length && crypto.timingSafeEqual(given, wanted);
  });
}

app.post('/finapp/webhooks', express.raw({ type: 'application/json' }), (req, res) => {
  const raw = req.body.toString('utf8');
  if (!verify(req.get('FinApp-Signature') ?? '', raw)) return res.sendStatus(400);
  const event = JSON.parse(raw);
  // Deduplicate on event.id, then handle event.type. Respond quickly.
  res.sendStatus(204);
});
```

```python title="Python (Flask)"
import hashlib, hmac, os, time
from flask import Flask, request, abort

app = Flask(__name__)
SECRET = os.environ["FINAPP_WEBHOOK_SECRET"].encode()

def verify(header: str, raw_body: bytes, tolerance: int = 300) -> bool:
    pairs = [part.split("=", 1) for part in header.split(",") if "=" in part]
    timestamps = [value for key, value in pairs if key == "t"]
    if not timestamps or not timestamps[0].isdigit():
        return False
    timestamp = int(timestamps[0])
    if abs(time.time() - timestamp) > tolerance:
        return False
    expected = hmac.new(SECRET, f"{timestamp}.".encode() + raw_body, hashlib.sha256).hexdigest()
    return any(hmac.compare_digest(value, expected) for key, value in pairs if key == "v1")

@app.post("/finapp/webhooks")
def finapp_webhook():
    if not verify(request.headers.get("FinApp-Signature", ""), request.get_data()):
        abort(400)
    event = request.get_json()
    # Deduplicate on event["id"], then handle event["type"].
    return "", 204
```

:::

## Responding, retries and failures

- Return any `2xx` within **10 seconds** to acknowledge. Do slow work after responding.
- Anything else (timeouts, network errors, `3xx`, `4xx`, `5xx`) is retried: after about 1 minute, 5 minutes, 30 minutes, 2 hours and 6 hours (±10% jitter), so up to 6 attempts in total.
- Return `410 Gone` to tell FinApp to stop: the endpoint is disabled immediately.
- After **10 events in a row** fail all their attempts, the endpoint is paused (`disabledReason: "too_many_failures"`). Re-enable it in Settings or with `PATCH /webhooks/{id}` `{"enabled": true}`, which resets the failure count.
- Delivery order isn't guaranteed. Use `createdAt` and fetch the latest state from the API when order matters.

## Delivery log

Settings shows the last deliveries per endpoint, and `GET /webhooks/{id}/deliveries` returns up to 200 from the last 30 days: event type, attempt number, outcome (`pending`, `succeeded`, `retrying`, `failed`), the HTTP status you returned, the duration and an error code (`timeout`, `network_error`, `blocked_url`). Response bodies are never stored.

## Rotating the secret

**Rotate secret** in Settings, or `POST /webhooks/{id}/rotate-secret`, returns a new secret once. For the next **24 hours** every delivery carries two signatures (`v1=` for the new secret and `v1=` for the old one), so you can deploy the new secret without dropping events. After 24 hours only the new secret signs.

FinApp never stores webhook secrets: each is derived on demand from a server key and a per-endpoint random salt, and rotating replaces the salt.
