import { Form, Link, Outlet, useLoaderData } from "react-router";
import type { Route } from "./+types/layout";
import { requireUser } from "../../lib/server/auth/session.server";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  return { user };
}

function NavLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      className="rounded px-2 py-1 text-sm text-zinc-300 hover:bg-zinc-900 hover:text-zinc-100"
      to={to}
    >
      {children}
    </Link>
  );
}

export default function AppLayout() {
  const { user } = useLoaderData<typeof loader>();

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Privnode / Subscription Station
            </div>
            <div className="h-4 w-px bg-zinc-800" />
            <nav className="flex items-center gap-1">
              <NavLink to="/app">Dashboard</NavLink>
              <NavLink to="/app/plans">Plans</NavLink>
              <NavLink to="/app/subscriptions">Subscriptions</NavLink>
              <NavLink to="/app/billing-portal">Billing Portal</NavLink>
              {user.role === "admin" ? (
                <NavLink to="/app/admin/plans">Admin: Plans</NavLink>
              ) : null}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-xs text-zinc-400">{user.email}</div>
            <Form method="post" action="/logout">
              <button
                className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs hover:bg-zinc-800"
                type="submit"
              >
                Logout
              </button>
            </Form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-6">
        <Outlet />
      </main>
    </div>
  );
}

