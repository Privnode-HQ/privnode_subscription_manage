import { useEffect, useMemo, useRef, useState } from "react";
import {
  Form,
  Link,
  useActionData,
  useLoaderData,
  useNavigation,
} from "react-router";
import type { Route } from "./+types/subscribe.$planId";
import type { PlanId } from "../../lib/id";
import { requireUser } from "../../lib/server/auth/session.server";
import { env } from "../../lib/server/env.server";
import { getPlanById } from "../../lib/server/models/plans.server";
import { ensureStripeCustomer } from "../../lib/server/models/users.server";
import { createOrReuseStripeSubscriptionPayment } from "../../lib/server/stripe/subscriptions.server";

type ActionData =
  | { ok: true; clientSecret: string; subscriptionId: string; stripeSubscriptionId: string }
  | { ok: false; error: string };

export async function loader({ request, params }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const planId = params.planId as PlanId;
  const plan = await getPlanById(planId);
  if (!plan || !plan.is_active) {
    return new Response("Plan not found", { status: 404 });
  }
  return {
    user,
    plan,
    stripePublishableKey: env.STRIPE_PUBLISHABLE_KEY,
    appBaseUrl: env.APP_BASE_URL,
  };
}

export async function action({ request, params }: Route.ActionArgs): Promise<ActionData> {
  const user = await requireUser(request);
  const planId = params.planId as PlanId;
  const plan = await getPlanById(planId);
  if (!plan || !plan.is_active) return { ok: false, error: "plan_not_found" };

  const stripeCustomerId = await ensureStripeCustomer({
    userId: user.id,
    email: user.email,
  });

  try {
    const init = await createOrReuseStripeSubscriptionPayment({
      buyerUserId: user.id,
      stripeCustomerId,
      plan,
    });
    return {
      ok: true,
      clientSecret: init.clientSecret,
      subscriptionId: init.subscriptionId,
      stripeSubscriptionId: init.stripeSubscriptionId,
    };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? String(e) };
  }
}

function loadStripeJs(): Promise<any> {
  return new Promise((resolve, reject) => {
    if ((window as any).Stripe) return resolve((window as any).Stripe);
    const existing = document.querySelector("script[data-stripe-js]") as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve((window as any).Stripe));
      existing.addEventListener("error", reject);
      return;
    }
    const s = document.createElement("script");
    s.src = "https://js.stripe.com/v3";
    s.async = true;
    s.dataset.stripeJs = "true";
    s.addEventListener("load", () => resolve((window as any).Stripe));
    s.addEventListener("error", reject);
    document.head.appendChild(s);
  });
}

function PaymentElementBlock(props: {
  publishableKey: string;
  clientSecret: string;
  returnUrl: string;
}) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const stripeRef = useRef<any>(null);
  const elementsRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setError(null);
      setReady(false);
      const StripeCtor = await loadStripeJs();
      if (cancelled) return;
      const stripe = StripeCtor(props.publishableKey);
      stripeRef.current = stripe;

      const elements = stripe.elements({
        clientSecret: props.clientSecret,
        appearance: {
          theme: "night",
        },
      });
      elementsRef.current = elements;

      const paymentElement = elements.create("payment");
      paymentElement.mount(mountRef.current);
      setReady(true);
    })().catch((e) => {
      setError(e?.message ?? String(e));
    });

    return () => {
      cancelled = true;
      try {
        if (mountRef.current) mountRef.current.innerHTML = "";
      } catch {
        // ignore
      }
    };
  }, [props.clientSecret, props.publishableKey]);

  async function onConfirm() {
    setSubmitting(true);
    setError(null);
    try {
      const stripe = stripeRef.current;
      const elements = elementsRef.current;
      const result = await stripe.confirmPayment({
        elements,
        confirmParams: { return_url: props.returnUrl },
        redirect: "if_required",
      });
      if (result.error) setError(result.error.message ?? "Payment failed");
      else window.location.href = props.returnUrl;
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-6">
      <div className="text-sm font-semibold">Payment</div>
      <div className="mt-4">
        <div ref={mountRef} />
      </div>
      {error ? <div className="mt-3 text-sm text-red-300">{error}</div> : null}
      <button
        type="button"
        disabled={!ready || submitting}
        onClick={onConfirm}
        className="mt-4 rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm hover:bg-zinc-800 disabled:opacity-50"
      >
        {submitting ? "Confirming…" : "Confirm payment"}
      </button>
    </div>
  );
}

export default function SubscribePlan() {
  const { plan, stripePublishableKey, appBaseUrl } = useLoaderData<typeof loader>();
  const actionData = useActionData<ActionData>();
  const nav = useNavigation();

  const returnUrl = useMemo(() => {
    const u = new URL(appBaseUrl);
    u.pathname = "/app/subscriptions";
    u.searchParams.set("from", "payment");
    return u.toString();
  }, [appBaseUrl]);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-6">
        <div className="text-xs uppercase tracking-wide text-zinc-500">Subscribe</div>
        <h1 className="mt-2 text-lg font-semibold">{plan.name}</h1>
        <div className="mt-2 text-sm text-zinc-400">
          5h: {plan.limit_5h_units} units · 7d: {plan.limit_7d_units} units
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Form method="post">
            <button
              type="submit"
              className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm hover:bg-zinc-800 disabled:opacity-50"
              disabled={nav.state !== "idle"}
            >
              {nav.state === "submitting" ? "Creating…" : "Create subscription"}
            </button>
          </Form>
          <Link className="text-sm text-zinc-400 hover:text-zinc-200" to="/app/plans">
            Back to plans
          </Link>
        </div>
        {actionData && !actionData.ok ? (
          <div className="mt-3 text-sm text-red-300">{actionData.error}</div>
        ) : null}
      </div>

      {actionData && actionData.ok ? (
        <PaymentElementBlock
          publishableKey={stripePublishableKey}
          clientSecret={actionData.clientSecret}
          returnUrl={returnUrl}
        />
      ) : null}
    </div>
  );
}
