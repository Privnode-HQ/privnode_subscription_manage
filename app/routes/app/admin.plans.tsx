import { Form, useActionData, useLoaderData } from "react-router";
import type { Route } from "./+types/admin.plans";
import { makePlanId } from "../../lib/id";
import { requireAdmin } from "../../lib/server/auth/session.server";
import { withPlatformTx } from "../../lib/server/db.server";
import { listAllPlans } from "../../lib/server/models/plans.server";

export async function loader({ request }: Route.LoaderArgs) {
  await requireAdmin(request);
  const plans = await listAllPlans();
  return { plans };
}

export async function action({ request }: Route.ActionArgs) {
  const user = await requireAdmin(request);
  const form = await request.formData();
  const name = String(form.get("name") ?? "").trim();
  const description = String(form.get("description") ?? "").trim();
  const limit5h = Number(form.get("limit_5h_units") ?? 0);
  const limit7d = Number(form.get("limit_7d_units") ?? 0);
  const stripeProductId = String(form.get("stripe_product_id") ?? "").trim();
  const stripePriceId = String(form.get("stripe_price_id") ?? "").trim();
  const isActive = String(form.get("is_active") ?? "false") === "true";

  if (!name) return { ok: false as const, error: "name_required" };
  if (!Number.isFinite(limit5h) || limit5h < 0)
    return { ok: false as const, error: "limit_5h_units_invalid" };
  if (!Number.isFinite(limit7d) || limit7d < 0)
    return { ok: false as const, error: "limit_7d_units_invalid" };
  if (!stripeProductId.startsWith("prod_"))
    return { ok: false as const, error: "stripe_product_id_invalid" };
  if (!stripePriceId.startsWith("price_"))
    return { ok: false as const, error: "stripe_price_id_invalid" };

  const planId = makePlanId();
  await withPlatformTx(async (tx) => {
    await tx.query(
      `
        INSERT INTO plans(
          plan_id, name, description, limit_5h_units, limit_7d_units,
          stripe_product_id, stripe_price_id, is_active
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      `,
      [
        planId,
        name,
        description || null,
        Math.floor(limit5h),
        Math.floor(limit7d),
        stripeProductId,
        stripePriceId,
        isActive,
      ]
    );
    await tx.query(
      "INSERT INTO audit_logs(actor_user_id, action, subject_plan_id, meta) VALUES ($1, $2, $3, $4)",
      [user.id, "plan.create", planId, { name }]
    );
  });

  return { ok: true as const, planId };
}

export default function AdminPlans() {
  const { plans } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-6">
        <h1 className="text-lg font-semibold">Admin: Plans</h1>
        <p className="mt-2 text-sm text-zinc-400">
          `pln_` is platform-generated. Stripe IDs are stored separately.
        </p>
      </div>

      <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-6">
        <div className="text-sm font-semibold">Create Plan</div>
        <Form method="post" className="mt-4 grid gap-3">
          <input
            className="rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm"
            name="name"
            placeholder="Plan name"
            required
          />
          <textarea
            className="rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm"
            name="description"
            placeholder="Description"
            rows={3}
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              className="rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm"
              name="limit_5h_units"
              type="number"
              min={0}
              step={1}
              placeholder="5h units"
              required
            />
            <input
              className="rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm"
              name="limit_7d_units"
              type="number"
              min={0}
              step={1}
              placeholder="7d units"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input
              className="rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm"
              name="stripe_product_id"
              placeholder="prod_..."
              required
            />
            <input
              className="rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm"
              name="stripe_price_id"
              placeholder="price_..."
              required
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-zinc-300">
            <input name="is_active" type="checkbox" value="true" defaultChecked />
            Active
          </label>
          <button
            className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm hover:bg-zinc-800"
            type="submit"
          >
            Create
          </button>
        </Form>
        {actionData ? (
          <div className="mt-3 text-sm">
            {actionData.ok ? (
              <span className="text-emerald-300">Created {actionData.planId}</span>
            ) : (
              <span className="text-red-300">{actionData.error}</span>
            )}
          </div>
        ) : null}
      </div>

      <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-6">
        <div className="text-sm font-semibold">Existing Plans</div>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="py-2 pr-4">plan_id</th>
                <th className="py-2 pr-4">name</th>
                <th className="py-2 pr-4">5h</th>
                <th className="py-2 pr-4">7d</th>
                <th className="py-2 pr-4">stripe_price_id</th>
                <th className="py-2 pr-4">active</th>
              </tr>
            </thead>
            <tbody className="text-zinc-200">
              {plans.map((p) => (
                <tr key={p.plan_id} className="border-t border-zinc-900">
                  <td className="py-2 pr-4 font-mono text-xs">{p.plan_id}</td>
                  <td className="py-2 pr-4">{p.name}</td>
                  <td className="py-2 pr-4">{p.limit_5h_units}</td>
                  <td className="py-2 pr-4">{p.limit_7d_units}</td>
                  <td className="py-2 pr-4 font-mono text-xs">{p.stripe_price_id}</td>
                  <td className="py-2 pr-4">{p.is_active ? "yes" : "no"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
