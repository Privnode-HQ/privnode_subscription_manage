import type { Route } from "./+types/index";
import { requireUser } from "../../lib/server/auth/session.server";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  return { user };
}

export default function AppIndex() {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-6">
      <h1 className="text-lg font-semibold">Dashboard</h1>
      <p className="mt-2 text-sm text-zinc-400">
        This system sells and manages subscription bundles. It does not proxy any API traffic.
      </p>
    </div>
  );
}

