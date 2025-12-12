import { redirect } from "react-router";
import type { Route } from "./+types/magic";
import { consumeMagicLink } from "../../lib/server/auth/magic-link.server";
import { commitSessionCookie, createSession } from "../../lib/server/auth/session.server";

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") ?? "";
  if (!token) throw redirect("/login");

  const res = await consumeMagicLink(token);
  if (!res.ok) throw redirect("/login");

  const sessionId = await createSession(res.userId);
  throw redirect("/app", {
    headers: {
      "Set-Cookie": commitSessionCookie(sessionId),
    },
  });
}

export default function Magic() {
  return null;
}

