import { Link, useLoaderData } from "react-router";
import type { Route } from "./+types/plans";
import { useI18n } from "../../lib/i18n";
import { requireUser } from "../../lib/server/auth/session.server";
import { listActivePlans } from "../../lib/server/models/plans.server";

export async function loader({ request }: Route.LoaderArgs) {
  await requireUser(request);
  const plans = await listActivePlans();
  return { plans };
}

export default function Plans() {
  const { plans } = useLoaderData<typeof loader>();
  const { t } = useI18n();

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-6">
        <h1 className="text-lg font-semibold">{t("plans.title")}</h1>
        <p className="mt-2 text-sm text-zinc-400">{t("plans.blurb")}</p>
      </div>

      <div className="grid gap-3">
        {plans.map((p) => (
          <div
            key={p.plan_id}
            className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-5"
          >
            <div className="flex items-start justify-between gap-6">
              <div>
                <div className="text-sm font-semibold">{p.name}</div>
                <div className="mt-1 font-mono text-xs text-zinc-500">{p.plan_id}</div>
                {p.description ? (
                  <div className="mt-2 text-sm text-zinc-400">{p.description}</div>
                ) : null}
                <div className="mt-3 text-sm text-zinc-300">
                  {t("plans.limit5h", { units: p.limit_5h_units })}
                  <span className="mx-2 text-zinc-700">|</span>
                  {t("plans.limit7d", { units: p.limit_7d_units })}
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                <Link
                  to={`/app/subscribe/${p.plan_id}`}
                  className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm hover:bg-zinc-800"
                >
                  {t("plans.subscribe")}
                </Link>
              </div>
            </div>
          </div>
        ))}

        {plans.length === 0 ? (
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-6 text-sm text-zinc-400">
            {t("plans.none")}
          </div>
        ) : null}
      </div>
    </div>
  );
}
