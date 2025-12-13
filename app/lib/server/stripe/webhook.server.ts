import type Stripe from "stripe";
import { getPlatformPool } from "../db.server";
import { env } from "../env.server";
import { updateSubscriptionFromStripe } from "../models/subscriptions.server";
import {
  subscriptionAutoRenewEnabled,
  subscriptionCurrentPeriodEnd,
} from "../stripe-helpers.server";
import { getStripe } from "../stripe.server";

async function storeStripeEventOnce(event: Stripe.Event): Promise<boolean> {
  const pool = getPlatformPool();
  const inserted = await pool.query(
    "INSERT INTO stripe_events(id, type, payload) VALUES ($1, $2, $3) ON CONFLICT(id) DO NOTHING",
    [event.id, event.type, event as any]
  );
  return inserted.rowCount === 1;
}

function invoiceSubscriptionId(inv: Stripe.Invoice): string | null {
  const direct = (inv as any).subscription;
  if (typeof direct === "string") return direct;
  if (direct && typeof direct === "object" && typeof direct.id === "string") return direct.id;

  const parentSub = (inv as any).parent?.subscription_details?.subscription;
  if (typeof parentSub === "string") return parentSub;
  if (parentSub && typeof parentSub === "object" && typeof parentSub.id === "string") return parentSub.id;

  return null;
}

async function syncStripeSubscription(sub: Stripe.Subscription): Promise<void> {
  const autoRenewEnabled = subscriptionAutoRenewEnabled(sub);
  const currentPeriodEnd = subscriptionCurrentPeriodEnd(sub);
  await updateSubscriptionFromStripe({
    stripeSubscriptionId: sub.id,
    stripeStatus: sub.status,
    autoRenewEnabled,
    currentPeriodEnd,
  });
}

export async function handleStripeWebhookRequest(request: Request): Promise<Response> {
  const stripe = getStripe();
  const sig = request.headers.get("stripe-signature");
  if (!sig) return new Response("Missing stripe-signature", { status: 400 });

  const raw = Buffer.from(await request.arrayBuffer());

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, env.STRIPE_WEBHOOK_SECRET);
  } catch (e: any) {
    return new Response(
      `Webhook signature verification failed: ${e?.message ?? String(e)}`,
      { status: 400 }
    );
  }

  const inserted = await storeStripeEventOnce(event);
  if (!inserted) {
    return new Response("OK (duplicate)", { status: 200 });
  }

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await syncStripeSubscription(sub);
        break;
      }

      // Stripe recommends using invoice webhooks to monitor payment outcomes.
      // https://docs.stripe.com/billing/subscriptions/webhooks
      case "invoice.paid":
      case "invoice.payment_succeeded":
      case "invoice.payment_failed":
      case "invoice.payment_action_required": {
        const inv = event.data.object as Stripe.Invoice;
        const subId = invoiceSubscriptionId(inv);
        if (!subId) break;
        const sub = await stripe.subscriptions.retrieve(subId);
        await syncStripeSubscription(sub);
        break;
      }

      default:
        // Keep stored for debugging; no-op.
        break;
    }
  } catch (e: any) {
    // Return 500 so Stripe retries.
    return new Response(`Webhook handler failed: ${e?.message ?? String(e)}`,
      { status: 500 }
    );
  }

  return new Response("OK", { status: 200 });
}
