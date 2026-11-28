---
title: Pagination
description: Cursor-based pages with limit, cursor, hasMore and nextCursor.
order: 6
---

Every list endpoint is paginated with opaque cursors.

## Parameters and response

| Query parameter | Default | Notes                                                                |
| --------------- | ------- | -------------------------------------------------------------------- |
| `limit`         | `25`    | 1 to 100.                                                            |
| `cursor`        | —       | The `nextCursor` from the previous page. Omit it for the first page. |

```json
{
  "data": [{ "id": "…", "title": "Groceries", "amountMinor": "45000" }],
  "hasMore": true,
  "nextCursor": "eyJ2IjoxLCJmIjoi…"
}
```

When `hasMore` is `false`, `nextCursor` is `null` and you've reached the end.

## Cursors are bound to their filters

A cursor remembers the endpoint and the filters it was issued for (for example `type=expense&accountId=…`). Reusing it with different filters returns `400 invalid_cursor` instead of a wrong page. `limit` may change between pages.

Cursors are opaque. Don't build or parse them, and don't store them for long: they are meant for walking a list now.

## Pages can be shorter than `limit`

Some lists apply filters after reading a page from the database (for example text search on `/transactions`, and archived records being skipped). A page can then hold fewer than `limit` items, even zero, while `hasMore` is still `true`. Keep following `nextCursor` until `hasMore` is `false`.

## Date windows

Transaction, group expense and settlement lists read within a date window:

| Endpoint                                        | Default window                                    | Maximum  |
| ----------------------------------------------- | ------------------------------------------------- | -------- |
| `GET /transactions`                             | 30 days before `endAt`                            | 366 days |
| `GET /groups/{groupId}/expenses`                | 90 days before `endAt`                            | 366 days |
| `GET /groups/{groupId}/settlements`             | 90 days before `endAt`                            | 366 days |
| `GET /notifications`, `GET /goal-contributions` | everything (or a window you give, up to 366 days) | 366 days |

`startAt` is inclusive, `endAt` exclusive, both in epoch milliseconds, and `endAt` defaults to now. To go further back, page through successive windows.

## Walking a whole list

:::tabs

```javascript title="JavaScript"
async function* allTransactions(params) {
  let cursor;
  do {
    const query = new URLSearchParams({ ...params, limit: '100', ...(cursor ? { cursor } : {}) });
    const response = await fetch(`${BASE}/transactions?${query}`, { headers });
    const page = await response.json();
    yield* page.data;
    cursor = page.hasMore ? page.nextCursor : undefined;
  } while (cursor);
}
```

```python title="Python"
def all_transactions(params):
    cursor = None
    while True:
        query = {**params, "limit": 100, **({"cursor": cursor} if cursor else {})}
        page = requests.get(f"{BASE}/transactions", params=query, headers=headers).json()
        yield from page["data"]
        if not page["hasMore"]:
            break
        cursor = page["nextCursor"]
```

:::
