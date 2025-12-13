import type Stripe from "stripe";
import type { Plan } from "../models/plans.server";
import { makeSubscriptionId, type SubscriptionId } from "../../id";
import { getStripe } from "../stripe.server";
import {
  subscriptionAutoRenewEnabled,
  subscriptionCurrentPeriodEnd,
} from "../stripe-helpers.server";
import {
  createSubscriptionRecord,
  findLatestIncompleteStripeSubscriptionForUserPlan,
  updateSubscriptionFromStripe,
} from "../models/subscriptions.server";

const STRIPE_META_KEYS = {
  platformSubscriptionId: "platform_subscription_id",
  platformPlanId: "platform_plan_id",
  platformUserId: "platform_user_id",
} as const;

function maybeClientSecretFromConfirmationSecret(sub: Stripe.Subscription): string | null {
  const latestInvoice = sub.latest_invoice;
  if (!latestInvoice || typeof latestInvoice === "string") {
    return null;
  }
  // In the latest Stripe Billing API, invoice confirmation_secret provides the client_secret
  // for the payment created during invoice finalization.
  return latestInvoice.confirmation_secret?.client_secret ?? null;
}

function maybeClientSecretFromPaymentIntent(sub: Stripe.Subscription): string | null {
  const latestInvoice: any = sub.latest_invoice;
  if (!latestInvoice || typeof latestInvoice === "string") return null;
  const pi: any = latestInvoice.payment_intent;
  if (!pi || typeof pi === "string") return null;
  return typeof pi.client_secret === "string" ? pi.client_secret : null;
}

async function getSubscriptionClientSecret(params: {
  stripe: Stripe;
  subscription: Stripe.Subscription;
}): Promise<string> {
  const fromConfirmation = maybeClientSecretFromConfirmationSecret(params.subscription);
  if (fromConfirmation) return fromConfirmation;

  // Backward-compat for older API models where the client secret was exposed via
  // latest_invoice.payment_intent (expand required).
  try {
    const subExpanded = await params.stripe.subscriptions.retrieve(
      params.subscription.id,
      { expand: ["latest_invoice.payment_intent"] }
    );
    const fromPaymentIntent = maybeClientSecretFromPaymentIntent(subExpanded);
    if (fromPaymentIntent) return fromPaymentIntent;
  } catch {
    // Ignore and fall through to a clear error.
  }

  throw new Error("stripe_missing_client_secret");
}

export type StripeSubscriptionPaymentInit = {
  subscriptionId: SubscriptionId;
  stripeSubscriptionId: string;
  stripeStatus: string;
  autoRenewEnabled: boolean;
  currentPeriodEnd: number | null;
  clientSecret: string;
};

export async function createOrReuseStripeSubscriptionPayment(params: {
  buyerUserId: number;
  stripeCustomerId: string;
  plan: Plan;
}): Promise<StripeSubscriptionPaymentInit> {
  const stripe = getStripe();

  const existing = await findLatestIncompleteStripeSubscriptionForUserPlan({
    buyerUserId: params.buyerUserId,
    planId: params.plan.plan_id,
  });

  if (existing) {
    const sub = await stripe.subscriptions.retrieve(existing.stripe_subscription_id, {
      expand: ["latest_invoice.confirmation_secret"],
    });
    if (sub.status === "incomplete") {
      const clientSecret = await getSubscriptionClientSecret({ stripe, subscription: sub });
      const autoRenewEnabled = subscriptionAutoRenewEnabled(sub);
      const currentPeriodEnd = subscriptionCurrentPeriodEnd(sub);
      await updateSubscriptionFromStripe({
        stripeSubscriptionId: sub.id,
        stripeStatus: sub.status,
        autoRenewEnabled,
        currentPeriodEnd,
      });
      return {
        subscriptionId: existing.subscription_id,
        stripeSubscriptionId: sub.id,
        stripeStatus: sub.status,
        autoRenewEnabled,
        currentPeriodEnd,
        clientSecret,
      };
    }
  }

  const subscriptionId = makeSubscriptionId();

  const stripeSub = await stripe.subscriptions.create(
    {
      customer: params.stripeCustomerId,
      items: [{ price: params.plan.stripe_price_id }],
      payment_behavior: "default_incomplete",
      payment_settings: {
        save_default_payment_method: "on_subscription",
      },
      expand: ["latest_invoice.confirmation_secret"],
      metadata: {
        [STRIPE_META_KEYS.platformSubscriptionId]: subscriptionId,
        [STRIPE_META_KEYS.platformPlanId]: params.plan.plan_id,
        [STRIPE_META_KEYS.platformUserId]: String(params.buyerUserId),
      },
    },
    {
      idempotencyKey: `subscription_create:${subscriptionId}`,
    }
  );

  const clientSecret = await getSubscriptionClientSecret({
    stripe,
    subscription: stripeSub,
  });
  const autoRenewEnabled = subscriptionAutoRenewEnabled(stripeSub);
  const currentPeriodEnd = subscriptionCurrentPeriodEnd(stripeSub);

  await createSubscriptionRecord({
    subscriptionId,
    buyerUserId: params.buyerUserId,
    planId: params.plan.plan_id,
    stripeCustomerId: params.stripeCustomerId,
    stripeSubscriptionId: stripeSub.id,
    stripeStatus: stripeSub.status,
    autoRenewEnabled,
    currentPeriodEnd,
  });

  return {
    subscriptionId,
    stripeSubscriptionId: stripeSub.id,
    stripeStatus: stripeSub.status,
    autoRenewEnabled,
    currentPeriodEnd,
    clientSecret,
  };
}
