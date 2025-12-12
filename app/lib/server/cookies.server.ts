import { createHmac, timingSafeEqual } from "node:crypto";

function base64url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function sign(value: string, secret: string): string {
  const mac = createHmac("sha256", secret).update(value).digest();
  return base64url(mac);
}

export function sealSignedValue(value: string, secret: string): string {
  return `${value}.${sign(value, secret)}`;
}

export function openSignedValue(
  sealed: string,
  secret: string
): { ok: true; value: string } | { ok: false } {
  const idx = sealed.lastIndexOf(".");
  if (idx <= 0) return { ok: false };
  const value = sealed.slice(0, idx);
  const sig = sealed.slice(idx + 1);
  const expected = sign(value, secret);
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return { ok: false };
    if (!timingSafeEqual(a, b)) return { ok: false };
    return { ok: true, value };
  } catch {
    return { ok: false };
  }
}

export function parseCookieHeader(cookieHeader: string | null): Map<string, string> {
  const out = new Map<string, string>();
  if (!cookieHeader) return out;
  const parts = cookieHeader.split(";");
  for (const part of parts) {
    const [k, ...rest] = part.trim().split("=");
    if (!k) continue;
    out.set(k, decodeURIComponent(rest.join("=")));
  }
  return out;
}

export function serializeCookie(
  name: string,
  value: string,
  opts: {
    httpOnly?: boolean;
    secure?: boolean;
    path?: string;
    sameSite?: "Lax" | "Strict" | "None";
    maxAgeSeconds?: number;
  } = {}
): string {
  const segs: string[] = [];
  segs.push(`${name}=${encodeURIComponent(value)}`);
  segs.push(`Path=${opts.path ?? "/"}`);
  if (opts.httpOnly ?? true) segs.push("HttpOnly");
  if (opts.secure ?? true) segs.push("Secure");
  segs.push(`SameSite=${opts.sameSite ?? "Lax"}`);
  if (opts.maxAgeSeconds != null) segs.push(`Max-Age=${opts.maxAgeSeconds}`);
  return segs.join("; ");
}

