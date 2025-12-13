import { Form, useLocation, useSubmit } from "react-router";
import { supportedLocales, useI18n } from "../lib/i18n";

export function LanguageSwitcher(props: { className?: string }) {
  const { locale, t } = useI18n();
  const location = useLocation();
  const submit = useSubmit();

  const redirectTo = `${location.pathname}${location.search}`;

  return (
    <Form
      method="post"
      action="/locale"
      className={props.className}
      onChange={(e) => {
        const form = (e.currentTarget as HTMLFormElement) ?? null;
        if (form) submit(form);
      }}
    >
      <input type="hidden" name="redirectTo" value={redirectTo} />
      <label className="flex items-center gap-2 text-xs text-zinc-400">
        <span className="sr-only">{t("locale.label")}</span>
        <select
          name="locale"
          defaultValue={locale}
          className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-200"
        >
          {supportedLocales.map((l) => (
            <option key={l} value={l}>
              {t(l === "en" ? "locale.en" : "locale.zh")}
            </option>
          ))}
        </select>
      </label>
    </Form>
  );
}
