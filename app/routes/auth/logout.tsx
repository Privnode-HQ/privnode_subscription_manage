import { Form, redirect } from "react-router";
import type { Route } from "./+types/logout";
import { useI18n } from "../../lib/i18n";
import { clearSessionCookie, destroySession, getUserFromRequest } from "../../lib/server/auth/session.server";

export async function action({ request }: Route.ActionArgs) {
  const { sessionId } = await getUserFromRequest(request);
  if (sessionId) await destroySession(sessionId);
  throw redirect("/login", {
    headers: {
      "Set-Cookie": clearSessionCookie(),
    },
  });
}

export default function Logout() {
  const { t } = useI18n();
  return (
    <Form method="post">
      <button type="submit">{t("auth.logout")}</button>
    </Form>
  );
}
