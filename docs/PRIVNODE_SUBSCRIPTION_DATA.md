# Privnode `subscription_data`

This app writes to Privnode DB `users.subscription_data` **only** on:

- deploy
- deactivate
- transfer

Stripe Billing Portal changes **do not** directly change Privnode quota.

## Authoritative Entry Shape

```json
[
  {
    "plan_name": "string",
    "plan_id": "pln_xxxxxxxxxxxxxxxx",
    "subscription_id": "sub_xxxxxxxxxxxxxxxx",

    "5h_limit": {
      "total": 0,
      "available": 0,
      "reset_at": 0
    },

    "7d_limit": {
      "total": 0,
      "available": 0,
      "reset_at": 0
    },

    "duration": {
      "start_at": 0,
      "end_at": 0,
      "auto_renew_enabled": true
    },

    "owner": 0,
    "status": "ordered | deploying | deployed | deactivated | disabled | expired"
  }
]
```

## Computation Rules

- `total = plan_units * 500000`
- `available = remaining_units * 500000`
- `reset_at`
  - **No reset logic** in this system.
  - Set to deployment-time (epoch seconds) on first deploy.

## Anti-Abuse Invariants (Strict)

- Quota belongs to `subscription_id`, not to users.
- Deactivate:
  - only flips `status` to `deactivated`
  - MUST NOT reset `available` / `reset_at`
- Transfer:
  - moves the same entry from user A -> user B
  - MUST NOT reset `available` / `reset_at`

