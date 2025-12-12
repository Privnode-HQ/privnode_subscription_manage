import { Form, Link, useActionData, useLoaderData } from "react-router";
import type { Route } from "./+types/login";
import { requestMagicLink } from "../../lib/server/auth/magic-link.server";
import { listOidcProviders } from "../../lib/server/auth/oidc.server";

export async function loader({}: Route.LoaderArgs) {
  return { oidcProviders: listOidcProviders() };
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const email = String(form.get("email") ?? "");
  const res = await requestMagicLink(email);
  return res;
}

export default function Login() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-xl px-6 py-12">
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-6">
          <div className="text-sm uppercase tracking-wide text-zinc-400">
            Privnode Subscription Station
          </div>
          <h1 className="mt-2 text-xl font-semibold">Sign in</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Magic Link (Email) or OIDC.
          </p>

          <div className="mt-6">
            <Form method="post" className="space-y-3">
              <label className="block text-sm text-zinc-300">
                Email
                <input
                  name="email"
                  type="email"
                  required
                  className="mt-1 w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-zinc-600"
                  placeholder="you@company.com"
                />
              </label>
              <button
                type="submit"
                className="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm hover:bg-zinc-800"
              >
                Send Magic Link
              </button>
            </Form>

            {actionData && (
              <div className="mt-4 rounded border border-zinc-800 bg-zinc-950 p-3 text-sm">
                {actionData.ok ? (
                  <div className="text-zinc-300">
                    If the email exists / can receive mail, you will get a sign-in link.
                    {actionData.devLink ? (
                      <div className="mt-2">
                        Dev link:{" "}
                        <a className="underline" href={actionData.devLink}>
                          {actionData.devLink}
                        </a>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="text-red-300">{actionData.error}</div>
                )}
              </div>
            )}
          </div>

          {data.oidcProviders.length > 0 ? (
            <div className="mt-6">
              <div className="text-xs uppercase tracking-wide text-zinc-500">
                OIDC
              </div>
              <div className="mt-2 grid gap-2">
                {data.oidcProviders.map((p) => (
                  <Link
                    key={p.id}
                    className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm hover:bg-zinc-800"
                    to={`/auth/oidc/${encodeURIComponent(p.id)}`}
                  >
                    Continue with {p.id}
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}
