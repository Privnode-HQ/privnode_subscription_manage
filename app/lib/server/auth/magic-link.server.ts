import { randomBytes } from "node:crypto";
import { getPlatformPool } from "../db.server";
import { env } from "../env.server";
import { sha256Hex } from "./session.server";
import { isAdminEmail, normalizeEmail } from "./users.server";

function base64url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export type MagicLinkSendResult =
  | { ok: true; devLink?: string }
  | { ok: false; error: string };

export async function requestMagicLink(emailRaw: string): Promise<MagicLinkSendResult> {
  const email = normalizeEmail(emailRaw);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { ok: false, error: "Invalid email" };
  }

  const token = base64url(randomBytes(32));
  const tokenHash = sha256Hex(token);
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  const pool = getPlatformPool();
  await pool.query(
    "INSERT INTO magic_link_tokens(token_hash, email, expires_at) VALUES ($1, $2, $3)",
    [tokenHash, email, expiresAt]
  );

  const link = `${env.APP_BASE_URL.replace(/\/$/, "")}/auth/magic?token=${encodeURIComponent(token)}`;
  await sendMagicLinkEmail(email, link);

  // In dev/no-SMTP, surface the link for convenience.
  if (!env.SMTP_URL) return { ok: true, devLink: link };
  return { ok: true };
}

export async function consumeMagicLink(token: string): Promise<
  | { ok: true; userId: number }
  | { ok: false; error: "invalid_or_expired" }
> {
  const tokenHash = sha256Hex(token);
  const pool = getPlatformPool();

  const res = await pool.query(
    `
      UPDATE magic_link_tokens
      SET consumed_at = now()
      WHERE token_hash = $1
        AND consumed_at IS NULL
        AND expires_at > now()
      RETURNING email
    `,
    [tokenHash]
  );
  if (res.rowCount === 0) return { ok: false, error: "invalid_or_expired" };

  const email = res.rows[0].email as string;
  const role = isAdminEmail(email) ? "admin" : "user";

  // Upsert user by email.
  const user = await pool.query(
    `
      INSERT INTO users(email, role)
      VALUES ($1, $2)
      ON CONFLICT(email) DO UPDATE SET email = EXCLUDED.email
      RETURNING id
    `,
    [email, role]
  );

  return { ok: true, userId: Number(user.rows[0].id) };
}

async function sendMagicLinkEmail(toEmail: string, link: string): Promise<void> {
  if (!env.SMTP_URL || !env.MAGIC_LINK_FROM_EMAIL) {
    // Dev mode fallback.
    console.log(`[magic-link] to=${toEmail} link=${link}`);
    return;
  }

  const nodemailer = await import("nodemailer");
  const transporter = nodemailer.createTransport(env.SMTP_URL);
  await transporter.sendMail({
    from: env.MAGIC_LINK_FROM_EMAIL,
    to: toEmail,
    subject: "Your sign-in link",
    text: `Sign in: ${link}`,
  });
}
