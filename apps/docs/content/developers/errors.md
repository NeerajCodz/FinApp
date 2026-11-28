---
title: Errors
description: The error envelope, status codes and error codes the API returns.
order: 8
---

Errors always use the same JSON shape and a meaningful HTTP status.

```json
{
  "error": {
    "code": "invalid_request",
    "message": "The request failed validation.",
    "requestId": "req_1b7c0c3f2e8a4d0f9b6a5e4d3c2b1a09",
    "details": [
      {
        "path": "body.amountMinor",
        "message": "Use a non-negative integer string in minor currency units."
      }
    ]
  }
}
```

| Field           | Always present       | Notes                                                                                |
| --------------- | -------------------- | ------------------------------------------------------------------------------------ |
| `code`          | Yes                  | Stable, machine-readable, `snake_case`. Branch on this.                              |
| `message`       | Yes                  | Human-readable; may change.                                                          |
| `requestId`     | Yes                  | Same as the `X-Request-Id` header.                                                   |
| `details`       | Validation errors    | Up to 20 `{ path, message }` items. `path` starts with `path.`, `query.` or `body.`. |
| `requiredScope` | `insufficient_scope` | The scope the endpoint needs.                                                        |

## Status codes

| Status | Codes                                                                      | When                                                                                                                |
| ------ | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `400`  | `invalid_request`, `invalid_json`, `invalid_cursor`, `invalid_webhook_url` | Validation failed, unknown query parameter, malformed JSON, cursor from other filters, disallowed webhook URL.      |
| `401`  | `unauthorized`                                                             | Missing, unknown, revoked or expired token, or the account can't use the API.                                       |
| `403`  | `insufficient_scope`, `forbidden`                                          | Missing scope; or the app's permission rules say no (for example, not a group member or not the expense's creator). |
| `404`  | `not_found`                                                                | Unknown route or resource, or a resource that belongs to someone else.                                              |
| `405`  | `method_not_allowed`                                                       | The path exists with other methods (see the `Allow` header).                                                        |
| `409`  | `limit_reached`, `transaction_changed`, `duplicate_mutation`               | A limit was reached, or the resource changed concurrently.                                                          |
| `413`  | `payload_too_large`                                                        | Body over 256 KB.                                                                                                   |
| `415`  | `unsupported_media_type`                                                   | A body was sent without `Content-Type: application/json`.                                                           |
| `422`  | Business rule codes (below), `idempotency_key_reused`, `unsupported`       | The request was valid JSON but a FinApp rule rejected it.                                                           |
| `429`  | `rate_limited`                                                             | See [Rate limits](/developers/rate-limits).                                                                         |
| `500`  | `internal_error`                                                           | Unexpected. Retrying with an `Idempotency-Key` is safe.                                                             |
| `503`  | `webhooks_unavailable`                                                     | Webhooks aren't configured on this server.                                                                          |

## Business rule codes

When FinApp's own rules reject a change, `code` is the rule's name in lower case, the same check the app performs. Common ones:

| Code                   | Meaning                                                                          |
| ---------------------- | -------------------------------------------------------------------------------- |
| `invalid_currency`     | The currency doesn't match the account or group, or isn't supported.             |
| `invalid_category`     | The category is missing, archived, of the wrong kind, or required for this edit. |
| `items_total_mismatch` | Line item amounts don't add up to `amountMinor`.                                 |
| `invalid_split`        | Participant shares don't add up, or a transfer field was used on a non-transfer. |
| `email_not_verified`   | The account must verify its email before creating records.                       |
| `group_archived`       | The group no longer accepts changes.                                             |

Treat unknown codes as a generic `422` and show the `message`.

## Not found vs forbidden

To avoid revealing what exists, records that belong to someone else are reported as `404 not_found` rather than `403`. `403 forbidden` is used when you can see a resource but the app's rules don't let you change it (for example, deleting another member's group expense without being an admin).
