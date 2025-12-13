import { Form, useLoaderData } from "react-router";
import type { Route } from "./+types/billing-portal";
import { useI18n } from "../../lib/i18n";
import { requireUser } from "../../lib/server/auth/session.server";
import { getUserStripeCustomerId } from "../../lib/server/models/users.server";
import { env } from "../../lib/server/env.server";
import { getStripe } from "../../lib/server/stripe.server";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const stripeCustomerId = await getUserStripeCustomerId(user.id);
  return { user, stripeCustomerId };
}

export async function action({ request }: Route.ActionArgs) {
  const user = await requireUser(request);
  const stripeCustomerId = await getUserStripeCustomerId(user.id);
  if (!stripeCustomerId) return { ok: false as const, error: "no_customer" };

  const stripe = getStripe();
  const createParams: any = {
    customer: stripeCustomerId,
    return_url: `${env.APP_BASE_URL.replace(/\/$/, "")}/app/subscriptions`,
  };
  if (env.STRIPE_BILLING_PORTAL_CONFIGURATION_ID) {
    createParams.configuration = env.STRIPE_BILLING_PORTAL_CONFIGURATION_ID;
  }
  const portal = await stripe.billingPortal.sessions.create(createParams);

  return new Response(null, {
    status: 302,
    headers: {
      Location: portal.url,
    },
  });
}

export default function BillingPortal() {
  const { stripeCustomerId } = useLoaderData<typeof loader>();
  const { t } = useI18n();

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-6">
        <h1 className="text-lg font-semibold">{t("billing.title")}</h1>
        <p className="mt-2 text-sm text-zinc-400">{t("billing.blurb")}</p>
      </div>

      <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-6">
        {stripeCustomerId ? (
          <Form method="post">
            <button
              type="submit"
              className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm hover:bg-zinc-800"
            >
              {t("billing.open")}
            </button>
          </Form>
        ) : (
          <div className="text-sm text-zinc-400">{t("billing.noCustomer")}</div>
        )}
      </div>
    </div>
  );
}
