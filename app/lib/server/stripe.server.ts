import Stripe from "stripe";
import { env } from "./env.server";

let stripe: Stripe | undefined;

export function getStripe(): Stripe {
  if (!stripe) {
    stripe = new Stripe(env.STRIPE_SECRET_KEY, {
      // We store our own `pln_`/`sub_` IDs; never confuse them with Stripe IDs.
      appInfo: {
        name: "Privnode Subscription Manage",
      },
    });
  }
  return stripe;
}
