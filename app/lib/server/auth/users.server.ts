import { env } from "../env.server";

export function normalizeEmail(emailRaw: string): string {
  return emailRaw.trim().toLowerCase();
}

export function isAdminEmail(email: string): boolean {
  const list = (env.ADMIN_EMAILS ?? "tethys@agent-velo.com")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}
