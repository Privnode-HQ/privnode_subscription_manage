import type Stripe from "stripe";

export function subscriptionAutoRenewEnabled(sub: Stripe.Subscription): boolean {
  return !sub.cancel_at_period_end;
}

export function subscriptionCurrentPeriodEnd(sub: Stripe.Subscription): number | null {
  // Stripe's current API models the billing period on SubscriptionItem(s).
  // For multi-item subscriptions, take the earliest period end as the effective expiry.
  const items = sub.items?.data ?? [];
  const ends = items
    .map((it) => it.current_period_end)
    .filter((x): x is number => typeof x === "number");
  if (ends.length === 0) return null;
  return Math.min(...ends);
}
