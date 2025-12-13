import { Form, Link, useActionData, useLoaderData } from "react-router";
import type { Route } from "./+types/login";
import { LanguageSwitcher } from "../../components/language-switcher";
import { useI18n } from "../../lib/i18n";
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
  const { t } = useI18n();

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-xl px-6 py-12">
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="text-sm uppercase tracking-wide text-zinc-400">
              {t("app.brand")}
            </div>
            <LanguageSwitcher />
          </div>

          <h1 className="mt-2 text-xl font-semibold">{t("login.title")}</h1>
          <p className="mt-2 text-sm text-zinc-400">{t("login.subtitle")}</p>

          <div className="mt-6">
            <Form method="post" className="space-y-3">
              <label className="block text-sm text-zinc-300">
                {t("login.email")}
                <input
                  name="email"
                  type="email"
                  required
                  className="mt-1 w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-zinc-600"
                  placeholder={t("login.emailPlaceholder")}
                />
              </label>
              <button
                type="submit"
                className="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm hover:bg-zinc-800"
              >
                {t("login.sendMagicLink")}
              </button>
            </Form>

            {actionData && (
              <div className="mt-4 rounded border border-zinc-800 bg-zinc-950 p-3 text-sm">
                {actionData.ok ? (
                  <div className="text-zinc-300">
                    {t("login.magicLinkHint")}
                    {actionData.devLink ? (
                      <div className="mt-2">
                        {t("login.devLink")} {" "}
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
              <div className="text-xs uppercase tracking-wide text-zinc-500">{t("login.oidc")}</div>
              <div className="mt-2 grid gap-2">
                {data.oidcProviders.map((p) => (
                  <Link
                    key={p.id}
                    className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm hover:bg-zinc-800"
                    to={`/auth/oidc/${encodeURIComponent(p.id)}`}
                  >
                    {t("login.continueWith", { provider: p.id })}
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
