import { Form, useActionData, useLoaderData } from "react-router";
import type { Route } from "./+types/admin.redemption-codes";
import { isPlanId, type PlanId } from "../../lib/id";
import { requireAdmin } from "../../lib/server/auth/session.server";
import { listAllPlans } from "../../lib/server/models/plans.server";
import {
  createRedemptionCode,
  listRedemptionCodes,
} from "../../lib/server/redemption-codes.server";

export async function loader({ request }: Route.LoaderArgs) {
  await requireAdmin(request);
  const [plans, codes] = await Promise.all([listAllPlans(), listRedemptionCodes({ limit: 50 })]);
  return { plans, codes };
}

export async function action({ request }: Route.ActionArgs) {
  const user = await requireAdmin(request);
  const form = await request.formData();

  const planIdRaw = String(form.get("plan_id") ?? "").trim();
  if (!isPlanId(planIdRaw)) return { ok: false as const, error: "plan_id_invalid" };
  const planId = planIdRaw as PlanId;

  const durationDays = Number(form.get("duration_days") ?? 0);
  const maxUses = Number(form.get("max_uses") ?? 0);
  const expiresInDays = Number(form.get("expires_in_days") ?? 0);

  if (!Number.isFinite(durationDays) || durationDays <= 0)
    return { ok: false as const, error: "duration_days_invalid" };
  if (!Number.isFinite(maxUses) || maxUses <= 0)
    return { ok: false as const, error: "max_uses_invalid" };
  if (!Number.isFinite(expiresInDays) || expiresInDays <= 0)
    return { ok: false as const, error: "expires_in_days_invalid" };

  const customPlanName = String(form.get("custom_plan_name") ?? "").trim();
  const customPlanDescription = String(form.get("custom_plan_description") ?? "").trim();

  const limit5hRaw = String(form.get("custom_limit_5h_units") ?? "").trim();
  const limit7dRaw = String(form.get("custom_limit_7d_units") ?? "").trim();

  const customLimit5hUnits = limit5hRaw ? Number(limit5hRaw) : undefined;
  const customLimit7dUnits = limit7dRaw ? Number(limit7dRaw) : undefined;

  if (customLimit5hUnits != null && (!Number.isFinite(customLimit5hUnits) || customLimit5hUnits < 0)) {
    return { ok: false as const, error: "custom_limit_5h_units_invalid" };
  }
  if (customLimit7dUnits != null && (!Number.isFinite(customLimit7dUnits) || customLimit7dUnits < 0)) {
    return { ok: false as const, error: "custom_limit_7d_units_invalid" };
  }

  try {
    const created = await createRedemptionCode({
      actorUserId: user.id,
      planId,
      durationDays,
      maxUses,
      expiresInDays,
      customPlanName: customPlanName || undefined,
      customPlanDescription: customPlanDescription || undefined,
      customLimit5hUnits: customLimit5hUnits != null ? Math.floor(customLimit5hUnits) : undefined,
      customLimit7dUnits: customLimit7dUnits != null ? Math.floor(customLimit7dUnits) : undefined,
    });
    return { ok: true as const, jti: created.jti, token: created.token };
  } catch (e: any) {
    return { ok: false as const, error: e?.message ?? "unknown_error" };
  }
}

function fmtIso(ts: string): string {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  return d.toISOString().replace("T", " ").slice(0, 19) + "Z";
}

export default function AdminRedemptionCodes() {
  const { plans, codes } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-6">
        <h1 className="text-lg font-semibold">Admin: Redemption Codes</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Generates JWT兑换码. Users can redeem them to create a manual subscription.
        </p>
      </div>

      <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-6">
        <div className="text-sm font-semibold">Generate</div>

        <Form method="post" className="mt-4 grid gap-3">
          <label className="grid gap-1 text-sm text-zinc-300">
            <span className="text-xs text-zinc-500">Plan</span>
            <select
              name="plan_id"
              className="rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm"
              required
            >
              {plans.map((p) => (
                <option key={p.plan_id} value={p.plan_id}>
                  {p.name} ({p.plan_id})
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-3 gap-3">
            <label className="grid gap-1 text-sm text-zinc-300">
              <span className="text-xs text-zinc-500">Duration (days)</span>
              <input
                className="rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm"
                name="duration_days"
                type="number"
                min={1}
                step={1}
                defaultValue={30}
                required
              />
            </label>
            <label className="grid gap-1 text-sm text-zinc-300">
              <span className="text-xs text-zinc-500">Max uses</span>
              <input
                className="rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm"
                name="max_uses"
                type="number"
                min={1}
                step={1}
                defaultValue={1}
                required
              />
            </label>
            <label className="grid gap-1 text-sm text-zinc-300">
              <span className="text-xs text-zinc-500">Expires in (days)</span>
              <input
                className="rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm"
                name="expires_in_days"
                type="number"
                min={1}
                step={1}
                defaultValue={30}
                required
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <input
              className="rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm"
              name="custom_limit_5h_units"
              type="number"
              min={0}
              step={1}
              placeholder="Override 5h units (optional)"
            />
            <input
              className="rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm"
              name="custom_limit_7d_units"
              type="number"
              min={0}
              step={1}
              placeholder="Override 7d units (optional)"
            />
          </div>

          <input
            className="rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm"
            name="custom_plan_name"
            placeholder="Override plan name (optional)"
          />
          <textarea
            className="rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm"
            name="custom_plan_description"
            placeholder="Override description (optional)"
            rows={3}
          />

          <button
            className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm hover:bg-zinc-800"
            type="submit"
          >
            Generate
          </button>
        </Form>

        {actionData ? (
          <div className="mt-4 text-sm">
            {actionData.ok ? (
              <div className="space-y-2">
                <div className="text-emerald-300">Generated: {actionData.jti}</div>
                <textarea
                  readOnly
                  className="h-28 w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-2 font-mono text-xs"
                  value={actionData.token}
                />
                <div className="text-xs text-zinc-500">Share this JWT to the user to redeem.</div>
              </div>
            ) : (
              <span className="text-red-300">{actionData.error}</span>
            )}
          </div>
        ) : null}
      </div>

      <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-6">
        <div className="text-sm font-semibold">Recent Codes</div>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="py-2 pr-4">jti</th>
                <th className="py-2 pr-4">plan</th>
                <th className="py-2 pr-4">duration</th>
                <th className="py-2 pr-4">uses</th>
                <th className="py-2 pr-4">expires</th>
                <th className="py-2 pr-4">custom</th>
              </tr>
            </thead>
            <tbody className="text-zinc-200">
              {codes.map((c) => (
                <tr key={c.jti} className="border-t border-zinc-900 align-top">
                  <td className="py-2 pr-4 font-mono text-xs">{c.jti}</td>
                  <td className="py-2 pr-4">
                    <div>{c.plan_name}</div>
                    <div className="mt-1 font-mono text-xs text-zinc-500">{c.plan_id}</div>
                  </td>
                  <td className="py-2 pr-4">{c.duration_days}d</td>
                  <td className="py-2 pr-4">
                    {c.used_count}/{c.max_uses}
                  </td>
                  <td className="py-2 pr-4 font-mono text-xs">{fmtIso(c.expires_at)}</td>
                  <td className="py-2 pr-4 text-xs text-zinc-400">
                    {c.custom_plan_name || c.custom_plan_description || c.custom_limit_5h_units != null ||
                    c.custom_limit_7d_units != null
                      ? "yes"
                      : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

