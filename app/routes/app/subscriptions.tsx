import { Form, useActionData, useLoaderData } from "react-router";
import type { Route } from "./+types/subscriptions";
import type { SubscriptionId } from "../../lib/id";
import { buildInitialSubscriptionEntry } from "../../lib/server/privnode/subscription-data.server";
import {
  deploySubscriptionToPrivnode,
  deactivateSubscriptionOnPrivnode,
  getSubscriptionDataEntryForUser,
  findPrivnodeUserByIdentifier,
  transferSubscriptionBetweenPrivnodeUsers,
} from "../../lib/server/privnode/users.server";
import { requireUser } from "../../lib/server/auth/session.server";
import { listSubscriptionsForUser } from "../../lib/server/models/subscriptions.server";
import {
  getDeployment,
  listDeploymentsForUser,
  markDeactivated,
  markDeployed,
  markTransferred,
} from "../../lib/server/models/deployments.server";

type ActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

function canDeployFromStripe(sub: {
  stripe_status: string | null;
  stripe_subscription_id: string | null;
  current_period_end: number | null;
}): boolean {
  if (!sub.current_period_end) return false;
  const now = Math.floor(Date.now() / 1000);
  if (sub.current_period_end <= now) return false;

  // Stripe-backed subscription: deploy only when active.
  if (sub.stripe_subscription_id) {
    return sub.stripe_status === "active" || sub.stripe_status === "trialing";
  }

  // Manual (e.g. redemption code): deploy while unexpired.
  return true;
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const subs = await listSubscriptionsForUser(user.id);
  const deployments = await listDeploymentsForUser(user.id);
  const deployBySub = new Map(deployments.map((d) => [d.subscription_id, d] as const));

  const enriched = await Promise.all(
    subs.map(async (s) => {
      const dep = deployBySub.get(s.subscription_id) ?? null;
      const privnodeEntry =
        dep?.privnode_user_id != null
          ? await getSubscriptionDataEntryForUser({
              privnodeUserId: dep.privnode_user_id,
              subscriptionId: s.subscription_id,
            })
          : null;
      return {
        ...s,
        deployment: dep,
        privnodeEntry,
        canDeploy: canDeployFromStripe(s),
      };
    })
  );

  return { user, subscriptions: enriched };
}

export async function action({ request }: Route.ActionArgs): Promise<ActionResult> {
  const user = await requireUser(request);
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");
  const subscriptionId = String(form.get("subscription_id") ?? "") as SubscriptionId;

  const subs = await listSubscriptionsForUser(user.id);
  const sub = subs.find((x) => x.subscription_id === subscriptionId);
  if (!sub) return { ok: false, error: "subscription_not_found" };

  const nowSec = Math.floor(Date.now() / 1000);
  const endAtSec = sub.current_period_end;
  if (!endAtSec) return { ok: false, error: "missing_current_period_end" };

  const dep = await getDeployment(subscriptionId);

  if (intent === "deploy") {
    if (!canDeployFromStripe(sub)) {
      return { ok: false, error: "not_deployable_until_subscription_active" };
    }
    const identifier = String(form.get("privnode_identifier") ?? "").trim();
    if (!identifier) return { ok: false, error: "privnode_identifier_required" };

    // Deploy only supports initial deploy or redeploy to the SAME Privnode user.
    // If this subscription was ever deployed, force using transfer to avoid duplicates.
    if (dep?.privnode_user_id != null) {
      const target = await findPrivnodeUserByIdentifier(identifier);
      if (!target) return { ok: false, error: "privnode_user_not_found" };
      if (Number(target.id) !== Number(dep.privnode_user_id)) {
        return { ok: false, error: "use_transfer_for_different_target" };
      }
      if (dep.status === "deployed") {
        return { ok: false, error: "already_deployed" };
      }
    }

    const res = await deploySubscriptionToPrivnode({
      identifier,
      subscriptionId: sub.subscription_id,
      nowSec,
      endAtSec,
      autoRenewEnabled: sub.auto_renew_enabled,
      buildInitial: (ownerPrivnodeUserId) =>
        buildInitialSubscriptionEntry({
          planName: sub.plan_name,
          planId: sub.plan_id,
          subscriptionId: sub.subscription_id,
          nowSec,
          ownerPrivnodeUserId,
          autoRenewEnabled: sub.auto_renew_enabled,
          endAtSec,
          limit5hUnits: sub.limit_5h_units,
          limit7dUnits: sub.limit_7d_units,
        }),
    });
    if ("error" in res) return { ok: false, error: res.error };
    await markDeployed({
      subscriptionId: sub.subscription_id,
      privnodeUserId: res.privnodeUserId,
      privnodeUsername: res.privnodeUsername,
    });
    return { ok: true, message: `Deployed to ${res.privnodeUsername} (${res.privnodeUserId})` };
  }

  if (intent === "deactivate") {
    if (!dep?.privnode_user_id) return { ok: false, error: "not_deployed" };
    const res = await deactivateSubscriptionOnPrivnode({
      privnodeUserId: dep.privnode_user_id,
      subscriptionId: sub.subscription_id,
    });
    if (!res.ok) return { ok: false, error: res.error };
    await markDeactivated({ subscriptionId: sub.subscription_id });
    return { ok: true, message: "Deactivated (quota preserved)" };
  }

  if (intent === "transfer") {
    if (!dep?.privnode_user_id) return { ok: false, error: "not_deployed" };
    if (!canDeployFromStripe(sub)) {
      return { ok: false, error: "not_transferable_until_subscription_active" };
    }
    const identifier = String(form.get("privnode_identifier") ?? "").trim();
    if (!identifier) return { ok: false, error: "privnode_identifier_required" };
    const res = await transferSubscriptionBetweenPrivnodeUsers({
      fromPrivnodeUserId: dep.privnode_user_id,
      toIdentifier: identifier,
      subscriptionId: sub.subscription_id,
      nowSec,
      endAtSec,
      autoRenewEnabled: sub.auto_renew_enabled,
    });
    if (!res.ok) return { ok: false, error: res.error };
    await markTransferred({
      subscriptionId: sub.subscription_id,
      toPrivnodeUserId: res.toPrivnodeUserId,
      toPrivnodeUsername: res.toPrivnodeUsername,
    });
    return { ok: true, message: `Transferred to ${res.toPrivnodeUsername} (${res.toPrivnodeUserId})` };
  }

  return { ok: false, error: "unknown_intent" };
}

function fmtEpoch(sec: number | null): string {
  if (!sec) return "-";
  const d = new Date(sec * 1000);
  return d.toISOString().replace("T", " ").slice(0, 19) + "Z";
}

export default function Subscriptions() {
  const { subscriptions } = useLoaderData<typeof loader>();
  const actionData = useActionData<ActionResult>();

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-6">
        <h1 className="text-lg font-semibold">Subscriptions</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Deploy/cancel/transfer updates Privnode `users.subscription_data`. Billing Portal changes only Stripe.
        </p>
        {actionData ? (
          <div className="mt-3 text-sm">
            {actionData.ok ? (
              <span className="text-emerald-300">{actionData.message}</span>
            ) : (
              <span className="text-red-300">{actionData.error}</span>
            )}
          </div>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-950/50">
        <table className="min-w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-3">subscription_id</th>
              <th className="px-4 py-3">plan</th>
              <th className="px-4 py-3">stripe_status</th>
              <th className="px-4 py-3">auto_renew</th>
              <th className="px-4 py-3">period_end</th>
              <th className="px-4 py-3">deploy_status</th>
              <th className="px-4 py-3">privnode_target</th>
              <th className="px-4 py-3">5h_available</th>
              <th className="px-4 py-3">7d_available</th>
              <th className="px-4 py-3">actions</th>
            </tr>
          </thead>
          <tbody className="text-zinc-200">
            {subscriptions.map((s) => (
              <tr key={s.subscription_id} className="border-t border-zinc-900 align-top">
                <td className="px-4 py-3 font-mono text-xs">{s.subscription_id}</td>
                <td className="px-4 py-3">
                  <div className="text-sm">{s.plan_name}</div>
                  <div className="mt-1 font-mono text-xs text-zinc-500">{s.plan_id}</div>
                </td>
                <td className="px-4 py-3 font-mono text-xs">{s.stripe_status ?? "-"}</td>
                <td className="px-4 py-3">{s.auto_renew_enabled ? "yes" : "no"}</td>
                <td className="px-4 py-3 font-mono text-xs">{fmtEpoch(s.current_period_end)}</td>
                <td className="px-4 py-3">{s.deployment?.status ?? "-"}</td>
                <td className="px-4 py-3">
                  {s.deployment?.privnode_user_id ? (
                    <div className="font-mono text-xs">
                      {s.deployment.privnode_username} ({s.deployment.privnode_user_id})
                    </div>
                  ) : (
                    "-"
                  )}
                </td>
                <td className="px-4 py-3 font-mono text-xs">
                  {s.privnodeEntry ? s.privnodeEntry["5h_limit"].available : "-"}
                </td>
                <td className="px-4 py-3 font-mono text-xs">
                  {s.privnodeEntry ? s.privnodeEntry["7d_limit"].available : "-"}
                </td>
                <td className="px-4 py-3">
                  <div className="w-64 space-y-2">
                    <Form method="post" className="flex gap-2">
                      <input type="hidden" name="intent" value="deploy" />
                      <input type="hidden" name="subscription_id" value={s.subscription_id} />
                      <input
                        name="privnode_identifier"
                        placeholder="Privnode id or username"
                        className="w-full rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs"
                      />
                      <button
                        className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs hover:bg-zinc-800 disabled:opacity-50"
                        type="submit"
                        disabled={!s.canDeploy}
                        title={s.canDeploy ? "" : "Wait until Stripe subscription is active"}
                      >
                        Deploy
                      </button>
                    </Form>

                    <Form method="post" className="flex gap-2">
                      <input type="hidden" name="intent" value="transfer" />
                      <input type="hidden" name="subscription_id" value={s.subscription_id} />
                      <input
                        name="privnode_identifier"
                        placeholder="Transfer to id/username"
                        className="w-full rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs"
                      />
                      <button
                        className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs hover:bg-zinc-800"
                        type="submit"
                      >
                        Transfer
                      </button>
                    </Form>

                    <Form method="post">
                      <input type="hidden" name="intent" value="deactivate" />
                      <input type="hidden" name="subscription_id" value={s.subscription_id} />
                      <button
                        className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs hover:bg-zinc-800"
                        type="submit"
                      >
                        Deactivate
                      </button>
                    </Form>
                  </div>
                </td>
              </tr>
            ))}

            {subscriptions.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-sm text-zinc-400" colSpan={10}>
                  No subscriptions yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
