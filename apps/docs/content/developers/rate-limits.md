---
title: Rate limits
description: Per-token token buckets, the X-RateLimit headers and how to back off.
order: 5
---

Each credential has its own rate limit: one bucket per personal access token and one per OAuth authorization (a user's connection to an app). Limits are stored server-side, so they apply across all your machines and processes using that token.

## The bucket

| Setting          | Value                                  |
| ---------------- | -------------------------------------- |
| Capacity (burst) | 120 requests                           |
| Refill           | 2 requests per second (120 per minute) |
| Cost             | 1 per request                          |

A new or idle token starts with a full bucket. Each request takes one token from the bucket; tokens flow back continuously.

## Headers

Every authenticated response (successful or not) includes:

| Header                  | Meaning                                 |
| ----------------------- | --------------------------------------- |
| `X-RateLimit-Limit`     | The bucket's capacity (`120`).          |
| `X-RateLimit-Remaining` | Requests you can make right now.        |
| `X-RateLimit-Reset`     | Seconds until the bucket is full again. |

## When you're limited

You get `429 Too Many Requests` with a `Retry-After` header (seconds) and this body:

```json
{
  "error": {
    "code": "rate_limited",
    "message": "Too many requests.",
    "requestId": "req_…"
  }
}
```

Rate-limited requests are recorded in the user's developer activity log.

## Good practice

- Honour `Retry-After`, then retry. For safety, retry `POST` requests with the same `Idempotency-Key` (see [Idempotency](/developers/idempotency)).
- Use [webhooks](/developers/webhooks) instead of polling for changes.
- Use larger pages (`limit=100`) when walking long lists.
- Spread periodic jobs instead of firing them all at the same second.

:::tabs

```javascript title="JavaScript"
async function finapp(url, init = {}, attempt = 0) {
  const response = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${process.env.FINAPP_TOKEN}`, ...init.headers },
  });
  if (response.status === 429 && attempt < 5) {
    const wait = Number(response.headers.get('Retry-After') ?? 1) * 1000;
    await new Promise((resolve) => setTimeout(resolve, wait));
    return finapp(url, init, attempt + 1);
  }
  return response;
}
```

```python title="Python"
import os, time
import requests

def finapp(method, url, attempt=0, **kwargs):
    headers = {"Authorization": f"Bearer {os.environ['FINAPP_TOKEN']}", **kwargs.pop("headers", {})}
    response = requests.request(method, url, headers=headers, **kwargs)
    if response.status_code == 429 and attempt < 5:
        time.sleep(int(response.headers.get("Retry-After", "1")))
        return finapp(method, url, attempt + 1, headers=headers, **kwargs)
    return response
```

:::
