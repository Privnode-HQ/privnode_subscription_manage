# Stripe Integration Notes

This app uses **Stripe Billing subscriptions** as the billing engine (it does not proxy API traffic).

## Subscription creation (Payment Element)

Server creates a subscription with `payment_behavior=default_incomplete` and returns a client secret for the initial invoice payment.

- Stripe doc: https://docs.stripe.com/billing/subscriptions/overview
- Payment Element: https://docs.stripe.com/payments/payment-element

Implementation:

- `app/lib/server/stripe/subscriptions.server.ts` uses `expand: ["latest_invoice.confirmation_secret"]`.
  - In the latest Stripe Billing API, `Invoice.confirmation_secret.client_secret` is used instead of `latest_invoice.payment_intent.client_secret`.

## Webhooks

The webhook endpoint stores incoming events into `stripe_events` (dedupe by event ID) and then syncs `subscriptions` rows.

- Stripe doc: https://docs.stripe.com/billing/subscriptions/webhooks

Implementation:

- Route: `app/routes/stripe/webhook.ts`
- Handler: `app/lib/server/stripe/webhook.server.ts`

Recommended events to enable:

- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`
- `invoice.payment_action_required`

The handler resolves the subscription ID from:

- `invoice.subscription` (older models)
- `invoice.parent.subscription_details.subscription` (newer models)

## API version pinning (optional)

Stripe recommends pinning an API version per integration so behavior changes are explicit.

- Set `STRIPE_API_VERSION` to the version you want this server to use.

