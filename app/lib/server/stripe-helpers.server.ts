import type Stripe from "stripe";

export function subscriptionAutoRenewEnabled(sub: Stripe.Subscription): boolean {
  return !sub.cancel_at_period_end;
}

export function subscriptionCurrentPeriodEnd(sub: Stripe.Subscription): number | null {
  // Stripe's newer API models period end on SubscriptionItem(s).
  // For multi-item subscriptions, take the earliest period end as the effective expiry.
  const items = (sub.items?.data ?? []) as any[];
  const ends = items
    .map((it) => (typeof it.current_period_end === "number" ? it.current_period_end : null))
    .filter((x): x is number => typeof x === "number");
  if (ends.length === 0) return null;
  return Math.min(...ends);
}

