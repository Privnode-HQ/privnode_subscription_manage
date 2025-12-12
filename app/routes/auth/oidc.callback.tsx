import { redirect } from "react-router";
import type { Route } from "./+types/oidc.callback";
import { handleOidcCallback } from "../../lib/server/auth/oidc.server";
import { commitSessionCookie, createSession } from "../../lib/server/auth/session.server";

export async function loader({ request, params }: Route.LoaderArgs) {
  const providerId = params.provider;
  const res = await handleOidcCallback({
    providerId,
    currentUrl: request.url,
  });
  if (!res.ok) throw redirect("/login");
  const sessionId = await createSession(res.userId);
  throw redirect("/app", {
    headers: {
      "Set-Cookie": commitSessionCookie(sessionId),
    },
  });
}

export default function OidcCallback() {
  return null;
}

