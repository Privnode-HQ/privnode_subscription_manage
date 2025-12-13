import { Form, useActionData, useLoaderData } from "react-router";
import { useState, useMemo } from "react";
import type { Route } from "./+types/subscriptions";
import type { SubscriptionId } from "../../lib/id";
import { formatError, useI18n } from "../../lib/i18n";
import { requireUser } from "../../lib/server/auth/session.server";
import { listDeploymentsForUser, markDeactivated, markDeployed, markTransferred } from "../../lib/server/models/deployments.server";
import { listSubscriptionsForUser } from "../../lib/server/models/subscriptions.server";
import { buildInitialSubscriptionEntry } from "../../lib/server/privnode/subscription-data.server";
import {
  deactivateSubscriptionOnPrivnode,
  deploySubscriptionToPrivnode,
  findPrivnodeUserByIdentifier,
  getSubscriptionDataEntryForUser,
  transferSubscriptionBetweenPrivnodeUsers,
} from "../../lib/server/privnode/users.server";
import { getDeployment } from "../../lib/server/models/deployments.server";

type ActionResult =
  | {
      ok: true;
      messageKey:
        | "subscriptions.msgDeployed"
        | "subscriptions.msgTransferred"
        | "subscriptions.msgDeactivated";
      messageParams?: Record<string, string | number>;
    }
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
    return {
      ok: true,
      messageKey: "subscriptions.msgDeployed",
      messageParams: { username: res.privnodeUsername, userId: res.privnodeUserId },
    };
  }

  if (intent === "deactivate") {
    if (!dep?.privnode_user_id) return { ok: false, error: "not_deployed" };
    const res = await deactivateSubscriptionOnPrivnode({
      privnodeUserId: dep.privnode_user_id,
      subscriptionId: sub.subscription_id,
    });
    if (!res.ok) return { ok: false, error: res.error };
    await markDeactivated({ subscriptionId: sub.subscription_id });
    return { ok: true, messageKey: "subscriptions.msgDeactivated" };
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
    return {
      ok: true,
      messageKey: "subscriptions.msgTransferred",
      messageParams: { username: res.toPrivnodeUsername, userId: res.toPrivnodeUserId },
    };
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
  const { t } = useI18n();

  const [searchQuery, setSearchQuery] = useState("");
  const [filterPlan, setFilterPlan] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterAutoRenew, setFilterAutoRenew] = useState("all");

  // Get unique plan names for filter
  const planNames = useMemo(() => {
    const plans = new Set(subscriptions.map((s) => s.plan_name));
    return Array.from(plans).sort();
  }, [subscriptions]);

  // Get unique deployment statuses for filter
  const statuses = useMemo(() => {
    const stats = new Set(
      subscriptions.map((s) => s.deployment?.status ?? "not_deployed")
    );
    return Array.from(stats).sort();
  }, [subscriptions]);

  // Filter subscriptions
  const filteredSubscriptions = useMemo(() => {
    return subscriptions.filter((s) => {
      // Search filter
      const search = searchQuery.toLowerCase();
      if (search) {
        const matchesId = s.subscription_id.toLowerCase().includes(search);
        const matchesPlan = s.plan_name.toLowerCase().includes(search);
        const matchesUser = s.deployment?.privnode_username?.toLowerCase().includes(search);
        if (!matchesId && !matchesPlan && !matchesUser) return false;
      }

      // Plan filter
      if (filterPlan !== "all" && s.plan_name !== filterPlan) return false;

      // Status filter
      if (filterStatus !== "all") {
        const status = s.deployment?.status ?? "not_deployed";
        if (status !== filterStatus) return false;
      }

      // Auto-renew filter
      if (filterAutoRenew !== "all") {
        if (filterAutoRenew === "yes" && !s.auto_renew_enabled) return false;
        if (filterAutoRenew === "no" && s.auto_renew_enabled) return false;
      }

      return true;
    });
  }, [subscriptions, searchQuery, filterPlan, filterStatus, filterAutoRenew]);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-6">
        <h1 className="text-lg font-semibold">{t("subscriptions.title")}</h1>
        <p className="mt-2 text-sm text-zinc-400">{t("subscriptions.blurb")}</p>
        {actionData ? (
          <div className="mt-3 text-sm">
            {actionData.ok ? (
              <span className="text-emerald-300">
                {t(actionData.messageKey, actionData.messageParams)}
              </span>
            ) : (
              <span className="text-red-300">{formatError(t, actionData.error)}</span>
            )}
          </div>
        ) : null}
      </div>

      {/* Search and Filter Section */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-4 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Search */}
          <div>
            <label className="block text-xs uppercase tracking-wide text-zinc-500 mb-1.5">
              {t("subscriptions.search")}
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("subscriptions.searchPlaceholder")}
              className="w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm"
            />
          </div>

          {/* Plan Filter */}
          <div>
            <label className="block text-xs uppercase tracking-wide text-zinc-500 mb-1.5">
              {t("subscriptions.headers.plan")}
            </label>
            <select
              value={filterPlan}
              onChange={(e) => setFilterPlan(e.target.value)}
              className="w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm"
            >
              <option value="all">{t("subscriptions.filterAll")}</option>
              {planNames.map((plan) => (
                <option key={plan} value={plan}>
                  {plan}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-xs uppercase tracking-wide text-zinc-500 mb-1.5">
              {t("subscriptions.headers.deployStatus")}
            </label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm"
            >
              <option value="all">{t("subscriptions.filterAll")}</option>
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>

          {/* Auto-Renew Filter */}
          <div>
            <label className="block text-xs uppercase tracking-wide text-zinc-500 mb-1.5">
              {t("subscriptions.headers.autoRenew")}
            </label>
            <select
              value={filterAutoRenew}
              onChange={(e) => setFilterAutoRenew(e.target.value)}
              className="w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm"
            >
              <option value="all">{t("subscriptions.filterAll")}</option>
              <option value="yes">{t("common.yes")}</option>
              <option value="no">{t("common.no")}</option>
            </select>
          </div>
        </div>

        {/* Results count */}
        <div className="text-xs text-zinc-500">
          {t("subscriptions.showing", {
            count: filteredSubscriptions.length,
            total: subscriptions.length,
          })}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {filteredSubscriptions.length === 0 ? (
          <div className="col-span-full rounded-lg border border-zinc-800 bg-zinc-950/50 p-6 text-center text-sm text-zinc-400">
            {subscriptions.length === 0
              ? t("subscriptions.none")
              : t("subscriptions.noResults")}
          </div>
        ) : (
          filteredSubscriptions.map((s) => (
            <div
              key={s.subscription_id}
              className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-5 space-y-4"
            >
              {/* Header section */}
              <div className="space-y-2 border-b border-zinc-800 pb-4">
                <div>
                  <div className="text-xs uppercase tracking-wide text-zinc-500">
                    {t("subscriptions.headers.subscriptionId")}
                  </div>
                  <div className="font-mono text-xs text-zinc-300">{s.subscription_id}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-zinc-500">
                    {t("subscriptions.headers.plan")}
                  </div>
                  <div className="text-sm font-medium">{s.plan_name}</div>
                  <div className="font-mono text-xs text-zinc-500">{s.plan_id}</div>
                </div>
              </div>

              {/* Info grid */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs uppercase tracking-wide text-zinc-500">
                    {t("subscriptions.headers.autoRenew")}
                  </div>
                  <div className="text-sm">
                    {s.auto_renew_enabled ? t("common.yes") : t("common.no")}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-zinc-500">
                    {t("subscriptions.headers.periodEnd")}
                  </div>
                  <div className="font-mono text-xs">{fmtEpoch(s.current_period_end)}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-zinc-500">
                    {t("subscriptions.headers.deployStatus")}
                  </div>
                  <div className="text-sm">{s.deployment?.status ?? "-"}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-zinc-500">
                    {t("subscriptions.headers.privnodeTarget")}
                  </div>
                  {s.deployment?.privnode_user_id ? (
                    <div className="font-mono text-xs">
                      {s.deployment.privnode_username} ({s.deployment.privnode_user_id})
                    </div>
                  ) : (
                    <div className="text-sm">-</div>
                  )}
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-zinc-500">
                    {t("subscriptions.headers.limit5hAvail")}
                  </div>
                  <div className="font-mono text-xs">
                    {s.privnodeEntry ? `$${(s.privnodeEntry["5h_limit"].available / 500000).toFixed(2)}` : "-"}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-zinc-500">
                    {t("subscriptions.headers.limit7dAvail")}
                  </div>
                  <div className="font-mono text-xs">
                    {s.privnodeEntry ? `$${(s.privnodeEntry["7d_limit"].available / 500000).toFixed(2)}` : "-"}
                  </div>
                </div>
              </div>

              {/* Actions section */}
              <div className="space-y-2 border-t border-zinc-800 pt-4">
                <div className="text-xs uppercase tracking-wide text-zinc-500 mb-2">
                  {t("subscriptions.headers.actions")}
                </div>

                <Form method="post" className="flex gap-2">
                  <input type="hidden" name="intent" value="deploy" />
                  <input type="hidden" name="subscription_id" value={s.subscription_id} />
                  <input
                    name="privnode_identifier"
                    placeholder={t("subscriptions.deployPlaceholder")}
                    className="flex-1 rounded border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs"
                  />
                  <button
                    className="rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs hover:bg-zinc-800 disabled:opacity-50"
                    type="submit"
                    disabled={!s.canDeploy}
                    title={s.canDeploy ? "" : t("subscriptions.waitStripeActive")}
                  >
                    {t("subscriptions.deploy")}
                  </button>
                </Form>

                <Form method="post" className="flex gap-2">
                  <input type="hidden" name="intent" value="transfer" />
                  <input type="hidden" name="subscription_id" value={s.subscription_id} />
                  <input
                    name="privnode_identifier"
                    placeholder={t("subscriptions.transferPlaceholder")}
                    className="flex-1 rounded border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs"
                  />
                  <button
                    className="rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs hover:bg-zinc-800"
                    type="submit"
                  >
                    {t("subscriptions.transfer")}
                  </button>
                </Form>

                <Form method="post">
                  <input type="hidden" name="intent" value="deactivate" />
                  <input type="hidden" name="subscription_id" value={s.subscription_id} />
                  <button
                    className="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs hover:bg-zinc-800"
                    type="submit"
                  >
                    {t("subscriptions.deactivate")}
                  </button>
                </Form>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
