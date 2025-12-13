import type { Route } from "./+types/index";
import { useI18n } from "../../lib/i18n";
import { requireUser } from "../../lib/server/auth/session.server";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  return { user };
}

export default function AppIndex() {
  const { t } = useI18n();

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-6">
      <h1 className="text-lg font-semibold">{t("dashboard.title")}</h1>
      <p className="mt-2 text-sm text-zinc-400">{t("dashboard.blurb")}</p>
    </div>
  );
}
