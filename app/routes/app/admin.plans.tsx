import { Form, useActionData, useLoaderData } from "react-router";
import type { Route } from "./+types/admin.plans";
import { isPlanId, makePlanId } from "../../lib/id";
import { formatError, useI18n } from "../../lib/i18n";
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

  const intent = String(form.get("intent") ?? "create");

  if (intent === "set_hidden") {
    const rawPlanId = String(form.get("plan_id") ?? "").trim();
    if (!isPlanId(rawPlanId)) return { ok: false as const, error: "plan_id_invalid" };
    const isHidden = String(form.get("is_hidden") ?? "false") === "true";

    let updated = 0;
    await withPlatformTx(async (tx) => {
      const res = await tx.query("UPDATE plans SET is_hidden = $2 WHERE plan_id = $1", [
        rawPlanId,
        isHidden,
      ]);
      updated = res.rowCount ?? 0;
      if (updated > 0) {
        await tx.query(
          "INSERT INTO audit_logs(actor_user_id, action, subject_plan_id, meta) VALUES ($1, $2, $3, $4)",
          [user.id, "plan.set_hidden", rawPlanId, { is_hidden: isHidden }]
        );
      }
    });

    if (updated === 0) return { ok: false as const, error: "plan_not_found" };
    return { ok: true as const, kind: "updated" as const, planId: rawPlanId };
  }

  if (intent !== "create") return { ok: false as const, error: "unknown_intent" };

  const name = String(form.get("name") ?? "").trim();
  const description = String(form.get("description") ?? "").trim();
  const limit5h = Number(form.get("limit_5h_units") ?? 0);
  const limit7d = Number(form.get("limit_7d_units") ?? 0);
  const stripeProductId = String(form.get("stripe_product_id") ?? "").trim();
  const stripePriceId = String(form.get("stripe_price_id") ?? "").trim();
  const isActive = String(form.get("is_active") ?? "false") === "true";
  const isHidden = String(form.get("is_hidden") ?? "false") === "true";

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
          stripe_product_id, stripe_price_id, is_active, is_hidden
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
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
        isHidden,
      ]
    );
    await tx.query(
      "INSERT INTO audit_logs(actor_user_id, action, subject_plan_id, meta) VALUES ($1, $2, $3, $4)",
      [user.id, "plan.create", planId, { name }]
    );
  });

  return { ok: true as const, kind: "created" as const, planId };
}

export default function AdminPlans() {
  const { plans } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const { t } = useI18n();

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-6">
        <h1 className="text-lg font-semibold">{t("adminPlans.title")}</h1>
        <p className="mt-2 text-sm text-zinc-400">{t("adminPlans.blurb")}</p>
      </div>

      <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-6">
        <div className="text-sm font-semibold">{t("adminPlans.createTitle")}</div>
        <Form method="post" className="mt-4 grid gap-3">
          <input type="hidden" name="intent" value="create" />
          <input
            className="rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm"
            name="name"
            placeholder={t("adminPlans.namePlaceholder")}
            required
          />
          <textarea
            className="rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm"
            name="description"
            placeholder={t("adminPlans.descPlaceholder")}
            rows={3}
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              className="rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm"
              name="limit_5h_units"
              type="number"
              min={0}
              step={1}
              placeholder={t("adminPlans.limit5hPlaceholder")}
              required
            />
            <input
              className="rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm"
              name="limit_7d_units"
              type="number"
              min={0}
              step={1}
              placeholder={t("adminPlans.limit7dPlaceholder")}
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
            {t("adminPlans.active")}
          </label>
          <label className="flex items-center gap-2 text-sm text-zinc-300">
            <input name="is_hidden" type="checkbox" value="true" />
            {t("adminPlans.hidden")}
          </label>
          <button
            className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm hover:bg-zinc-800"
            type="submit"
          >
            {t("adminPlans.create")}
          </button>
        </Form>
        {actionData ? (
          <div className="mt-3 text-sm">
            {actionData.ok ? (
              <span className="text-emerald-300">
                {actionData.kind === "updated"
                  ? t("adminPlans.updated", { planId: actionData.planId })
                  : t("adminPlans.created", { planId: actionData.planId })}
              </span>
            ) : (
              <span className="text-red-300">{formatError(t, actionData.error)}</span>
            )}
          </div>
        ) : null}
      </div>

      <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-6">
        <div className="text-sm font-semibold">{t("adminPlans.existing")}</div>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="py-2 pr-4">{t("adminPlans.headers.planId")}</th>
                <th className="py-2 pr-4">{t("adminPlans.headers.name")}</th>
                <th className="py-2 pr-4">{t("adminPlans.headers.limit5h")}</th>
                <th className="py-2 pr-4">{t("adminPlans.headers.limit7d")}</th>
                <th className="py-2 pr-4">{t("adminPlans.headers.stripePriceId")}</th>
                <th className="py-2 pr-4">{t("adminPlans.headers.active")}</th>
                <th className="py-2 pr-4">{t("adminPlans.headers.hidden")}</th>
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
                  <td className="py-2 pr-4">
                    {p.is_active ? t("common.yes") : t("common.no")}
                  </td>
                  <td className="py-2 pr-4">
                    <Form method="post" className="flex items-center gap-2">
                      <input type="hidden" name="intent" value="set_hidden" />
                      <input type="hidden" name="plan_id" value={p.plan_id} />
                      <input
                        name="is_hidden"
                        type="checkbox"
                        value="true"
                        defaultChecked={p.is_hidden}
                      />
                      <button
                        type="submit"
                        className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs hover:bg-zinc-800"
                      >
                        {t("adminPlans.save")}
                      </button>
                    </Form>
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
