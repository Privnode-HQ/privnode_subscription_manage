import { randomBytes, createHash } from "node:crypto";
import { redirect } from "react-router";
import { getPlatformPool } from "../db.server";
import {
  openSignedValue,
  parseCookieHeader,
  sealSignedValue,
  serializeCookie,
} from "../cookies.server";
import { env } from "../env.server";

export type AuthedUser = {
  id: number;
  email: string;
  role: "user" | "admin";
};

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

function base64url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function newSessionId(): string {
  return `sess_${base64url(randomBytes(24))}`;
}

function isSecureCookie(): boolean {
  try {
    const u = new URL(env.APP_BASE_URL);
    return u.protocol === "https:";
  } catch {
    return process.env.NODE_ENV === "production";
  }
}

export async function createSession(userId: number): Promise<string> {
  const pool = getPlatformPool();
  const sessionId = newSessionId();
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);
  await pool.query(
    "INSERT INTO sessions(id, user_id, expires_at) VALUES ($1, $2, $3)",
    [sessionId, userId, expiresAt]
  );
  return sessionId;
}

export async function destroySession(sessionId: string): Promise<void> {
  const pool = getPlatformPool();
  await pool.query("DELETE FROM sessions WHERE id = $1", [sessionId]);
}

export function commitSessionCookie(sessionId: string): string {
  const sealed = sealSignedValue(sessionId, env.SESSION_COOKIE_SECRET);
  return serializeCookie(env.SESSION_COOKIE_NAME, sealed, {
    secure: isSecureCookie(),
    httpOnly: true,
    sameSite: "Lax",
    path: "/",
    maxAgeSeconds: SESSION_TTL_SECONDS,
  });
}

export function clearSessionCookie(): string {
  return serializeCookie(env.SESSION_COOKIE_NAME, "", {
    secure: isSecureCookie(),
    httpOnly: true,
    sameSite: "Lax",
    path: "/",
    maxAgeSeconds: 0,
  });
}

export async function getUserFromRequest(
  request: Request
): Promise<{ user: AuthedUser | null; sessionId: string | null }> {
  const cookies = parseCookieHeader(request.headers.get("Cookie"));
  const raw = cookies.get(env.SESSION_COOKIE_NAME);
  if (!raw) return { user: null, sessionId: null };
  const opened = openSignedValue(raw, env.SESSION_COOKIE_SECRET);
  if (!opened.ok) return { user: null, sessionId: null };
  const sessionId = opened.value;

  const pool = getPlatformPool();
  const res = await pool.query(
    `
      SELECT u.id, u.email, u.role
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.id = $1 AND s.expires_at > now()
      LIMIT 1
    `,
    [sessionId]
  );
  if (res.rowCount === 0) return { user: null, sessionId };
  const row = res.rows[0];
  return {
    user: { id: Number(row.id), email: row.email, role: row.role },
    sessionId,
  };
}

export async function requireUser(request: Request): Promise<AuthedUser> {
  const { user } = await getUserFromRequest(request);
  if (!user) throw redirect("/login");
  return user;
}

export async function requireAdmin(request: Request): Promise<AuthedUser> {
  const user = await requireUser(request);
  if (user.role !== "admin") throw redirect("/");
  return user;
}

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}
