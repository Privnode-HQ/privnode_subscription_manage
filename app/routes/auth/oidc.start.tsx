import { redirect } from "react-router";
import type { Route } from "./+types/oidc.start";
import { createOidcAuthorizationUrl } from "../../lib/server/auth/oidc.server";

export async function loader({ params }: Route.LoaderArgs) {
  const provider = params.provider;
  const url = await createOidcAuthorizationUrl(provider);
  throw redirect(url);
}

export default function OidcStart() {
  return null;
}

