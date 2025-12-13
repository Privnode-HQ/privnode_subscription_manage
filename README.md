# Privnode Subscription Manage

An **independent** management system for selling and operating **monthly wholesale API quota bundles**.

- This site **does not proxy any API traffic**.
- Stripe is used **only as the billing engine**.
- Privnode is a separate DB; we only write to Privnode `users.subscription_data` on:
  - deploy
  - deactivate
  - transfer

## Key Rules

- `pln_` and `sub_` are **platform IDs**.
  - `plan_id`: `pln_` + 16 alnum
  - `subscription_id`: `sub_` + 16 alnum
  - They are **NOT** Stripe IDs.
- Stripe IDs are stored separately:
  - `plans.stripe_price_id` (`price_...`)
  - `plans.stripe_product_id` (`prod_...`)
  - `subscriptions.stripe_subscription_id` (Stripe subscription)

## Setup

1) Configure env vars

See `docs/ENV.md`.

2) Migrate platform DB

```bash
npm run db:migrate
```

3) Run dev

```bash
npm run dev
```

## Usage

- Sign in: `/login` (Magic Link or OIDC)
- Admin create plans: `/app/admin/plans`
- Admin generate redemption codes: `/app/admin/redemption-codes`
- User subscribe: `/app/plans` -> Subscribe (embedded Stripe Payment Element)
- User redeem code: `/app/redeem`
- Manage deploy/transfer/deactivate: `/app/subscriptions`
- Billing Portal: `/app/billing-portal`

## Docs

- `docs/ENV.md`
- `docs/STRIPE.md`
- `docs/PRIVNODE_SUBSCRIPTION_DATA.md`
