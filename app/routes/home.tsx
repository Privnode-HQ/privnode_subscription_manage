import { redirect } from "react-router";
import type { Route } from "./+types/home";
import { getUserFromRequest } from "../lib/server/auth/session.server";

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await getUserFromRequest(request);
  throw redirect(user ? "/app" : "/login");
}

export default function Home() {
  return null;
}

