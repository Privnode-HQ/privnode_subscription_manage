import Stripe from "stripe";
import { env } from "./env.server";

let stripe: Stripe | undefined;

export function getStripe(): Stripe {
  if (!stripe) {
    const config: Stripe.StripeConfig = {
      maxNetworkRetries: 2,
      typescript: true,
      // We store our own `pln_`/`sub_` IDs; never confuse them with Stripe IDs.
      appInfo: {
        name: "Privnode Subscription Manage",
      },
    };
    if (env.STRIPE_API_VERSION) {
      // Note: Stripe API version strings are validated by Stripe at request time.
      config.apiVersion = env.STRIPE_API_VERSION as any;
    }
    stripe = new Stripe(env.STRIPE_SECRET_KEY, config);
  }
  return stripe;
}
