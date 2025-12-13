import { isLocale, type Locale } from "../i18n";
import { parseCookieHeader, serializeCookie } from "./cookies.server";
import { env } from "./env.server";

export const LOCALE_COOKIE_NAME = "psm_locale";
const LOCALE_TTL_SECONDS = 60 * 60 * 24 * 365; // 1 year

function isSecureCookie(): boolean {
  try {
    const u = new URL(env.APP_BASE_URL);
    return u.protocol === "https:";
  } catch {
    return process.env.NODE_ENV === "production";
  }
}

export function getLocaleFromRequest(request: Request): Locale {
  const cookies = parseCookieHeader(request.headers.get("Cookie"));
  const fromCookie = cookies.get(LOCALE_COOKIE_NAME);
  if (isLocale(fromCookie)) return fromCookie;

  const acceptLanguage = request.headers.get("Accept-Language") ?? "";
  const al = acceptLanguage.toLowerCase();
  if (al.includes("zh")) return "zh";

  return "en";
}

export function commitLocaleCookie(locale: Locale): string {
  return serializeCookie(LOCALE_COOKIE_NAME, locale, {
    secure: isSecureCookie(),
    httpOnly: true,
    sameSite: "Lax",
    path: "/",
    maxAgeSeconds: LOCALE_TTL_SECONDS,
  });
}
