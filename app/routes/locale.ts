import { redirect } from "react-router";
import type { Route } from "./+types/locale";
import { isLocale } from "../lib/i18n";
import { commitLocaleCookie } from "../lib/server/locale.server";

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const localeRaw = String(form.get("locale") ?? "");
  const redirectToRaw = String(form.get("redirectTo") ?? "/");

  const locale = isLocale(localeRaw) ? localeRaw : "en";
  const redirectTo = redirectToRaw.startsWith("/") ? redirectToRaw : "/";

  throw redirect(redirectTo, {
    headers: {
      "Set-Cookie": commitLocaleCookie(locale),
    },
  });
}

export default function LocaleRoute() {
  return null;
}
