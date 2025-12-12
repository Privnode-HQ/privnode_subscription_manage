import { Link, useLoaderData } from "react-router";
import type { Route } from "./+types/plans";
import { requireUser } from "../../lib/server/auth/session.server";
import { listActivePlans } from "../../lib/server/models/plans.server";

export async function loader({ request }: Route.LoaderArgs) {
  await requireUser(request);
  const plans = await listActivePlans();
  return { plans };
}

export default function Plans() {
  const { plans } = useLoaderData<typeof loader>();

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-6">
        <h1 className="text-lg font-semibold">Plans</h1>
        <p className="mt-2 text-sm text-zinc-400">
          You buy monthly subscription bundles here. Actual quota consumption is enforced by Privnode.
        </p>
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
                <div className="mt-1 font-mono text-xs text-zinc-500">
                  {p.plan_id}
                </div>
                {p.description ? (
                  <div className="mt-2 text-sm text-zinc-400">{p.description}</div>
                ) : null}
                <div className="mt-3 text-sm text-zinc-300">
                  5h rolling window: {p.limit_5h_units} units
                  <span className="mx-2 text-zinc-700">|</span>
                  7d rolling window: {p.limit_7d_units} units
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                <Link
                  to={`/app/subscribe/${p.plan_id}`}
                  className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm hover:bg-zinc-800"
                >
                  Subscribe
                </Link>
              </div>
            </div>
          </div>
        ))}

        {plans.length === 0 ? (
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-6 text-sm text-zinc-400">
            No active plans.
          </div>
        ) : null}
      </div>
    </div>
  );
}

