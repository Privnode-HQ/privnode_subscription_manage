import { Form, Link, useActionData } from "react-router";
import type { Route } from "./+types/redeem";
import { requireUser } from "../../lib/server/auth/session.server";
import { redeemRedemptionCode } from "../../lib/server/redemption-codes.server";

type ActionResult =
  | { ok: true; subscriptionId: string; alreadyRedeemed: boolean }
  | { ok: false; error: string };

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  return { user };
}

export async function action({ request }: Route.ActionArgs): Promise<ActionResult> {
  const user = await requireUser(request);
  const form = await request.formData();
  const token = String(form.get("token") ?? "").trim();
  if (!token) return { ok: false, error: "token_required" };

  const res = await redeemRedemptionCode({ userId: user.id, token });
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, subscriptionId: res.subscriptionId, alreadyRedeemed: res.alreadyRedeemed };
}

export default function Redeem() {
  const actionData = useActionData<ActionResult>();

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-6">
        <h1 className="text-lg font-semibold">Redeem Code</h1>
        <p className="mt-2 text-sm text-zinc-400">Paste the JWT兑换码 to redeem a subscription.</p>
      </div>

      <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-6">
        <Form method="post" className="space-y-3">
          <textarea
            className="h-32 w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-2 font-mono text-xs"
            name="token"
            placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
            required
          />
          <button
            className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm hover:bg-zinc-800"
            type="submit"
          >
            Redeem
          </button>
        </Form>

        {actionData ? (
          <div className="mt-4 text-sm">
            {actionData.ok ? (
              <div className="space-y-2">
                <div className="text-emerald-300">
                  {actionData.alreadyRedeemed ? "Already redeemed" : "Redeemed"}: {actionData.subscriptionId}
                </div>
                <Link className="text-sm text-zinc-300 underline" to="/app/subscriptions">
                  Go to Subscriptions
                </Link>
              </div>
            ) : (
              <span className="text-red-300">{actionData.error}</span>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

