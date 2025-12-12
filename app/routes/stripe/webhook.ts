import Stripe from "stripe";
import { getPlatformPool } from "../../lib/server/db.server";
import { env } from "../../lib/server/env.server";
import { getStripe } from "../../lib/server/stripe.server";
import { updateSubscriptionFromStripe } from "../../lib/server/models/subscriptions.server";
import {
  subscriptionAutoRenewEnabled,
  subscriptionCurrentPeriodEnd,
} from "../../lib/server/stripe-helpers.server";

export async function action({ request }: { request: Request }) {
  const stripe = getStripe();
  const sig = request.headers.get("stripe-signature");
  if (!sig) return new Response("Missing stripe-signature", { status: 400 });

  const raw = Buffer.from(await request.arrayBuffer());

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, env.STRIPE_WEBHOOK_SECRET);
  } catch (e: any) {
    return new Response(`Webhook signature verification failed: ${e?.message ?? String(e)}`,
      { status: 400 }
    );
  }

  const pool = getPlatformPool();
  const inserted = await pool.query(
    "INSERT INTO stripe_events(id, type, payload) VALUES ($1, $2, $3) ON CONFLICT(id) DO NOTHING",
    [event.id, event.type, event as any]
  );
  if (inserted.rowCount === 0) {
    return new Response("OK (duplicate)", { status: 200 });
  }

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const autoRenewEnabled = subscriptionAutoRenewEnabled(sub);
        const currentPeriodEnd = subscriptionCurrentPeriodEnd(sub);
        await updateSubscriptionFromStripe({
          stripeSubscriptionId: sub.id,
          stripeStatus: sub.status,
          autoRenewEnabled,
          currentPeriodEnd,
        });
        break;
      }
      case "invoice.payment_succeeded": {
        const inv = event.data.object as Stripe.Invoice;
        const subRef: any = (inv as any).parent?.subscription_details?.subscription;
        if (typeof subRef === "string") {
          const sub = await stripe.subscriptions.retrieve(subRef);
          const autoRenewEnabled = subscriptionAutoRenewEnabled(sub);
          const currentPeriodEnd = subscriptionCurrentPeriodEnd(sub);
          await updateSubscriptionFromStripe({
            stripeSubscriptionId: sub.id,
            stripeStatus: sub.status,
            autoRenewEnabled,
            currentPeriodEnd,
          });
        }
        break;
      }
      case "invoice.payment_failed": {
        const inv = event.data.object as Stripe.Invoice;
        const subRef: any = (inv as any).parent?.subscription_details?.subscription;
        if (typeof subRef === "string") {
          const sub = await stripe.subscriptions.retrieve(subRef);
          const autoRenewEnabled = subscriptionAutoRenewEnabled(sub);
          const currentPeriodEnd = subscriptionCurrentPeriodEnd(sub);
          await updateSubscriptionFromStripe({
            stripeSubscriptionId: sub.id,
            stripeStatus: sub.status,
            autoRenewEnabled,
            currentPeriodEnd,
          });
        }
        break;
      }
      default:
        // Keep stored for debugging; no-op.
        break;
    }
  } catch (e: any) {
    // Return 500 so Stripe retries.
    return new Response(`Webhook handler failed: ${e?.message ?? String(e)}`, { status: 500 });
  }

  return new Response("OK", { status: 200 });
}
