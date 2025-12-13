import { createHmac, timingSafeEqual } from "node:crypto";

type JwtHeader = {
  alg: "HS256";
  typ?: "JWT";
};

function base64urlEncode(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64urlDecode(input: string): Buffer {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + pad, "base64");
}

function jsonEncode(obj: unknown): string {
  return JSON.stringify(obj);
}

function jsonDecode(input: string): any {
  return JSON.parse(input);
}

function signHs256(input: string, secret: string): string {
  return base64urlEncode(createHmac("sha256", secret).update(input).digest());
}

export function signJwtHs256<TPayload extends Record<string, unknown>>(params: {
  payload: TPayload;
  secret: string;
  header?: JwtHeader;
}): string {
  const header: JwtHeader = params.header ?? { alg: "HS256", typ: "JWT" };
  if (header.alg !== "HS256") throw new Error("Unsupported JWT alg");

  const encodedHeader = base64urlEncode(Buffer.from(jsonEncode(header), "utf8"));
  const encodedPayload = base64urlEncode(Buffer.from(jsonEncode(params.payload), "utf8"));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = signHs256(signingInput, params.secret);
  return `${signingInput}.${signature}`;
}

export type VerifyJwtResult<TPayload> =
  | { ok: true; header: JwtHeader; payload: TPayload }
  | { ok: false; error: string };

export function verifyJwtHs256<TPayload extends Record<string, unknown>>(params: {
  token: string;
  secret: string;
  nowSec?: number;
  expectedIssuer?: string;
  expectedAudience?: string;
}): VerifyJwtResult<TPayload> {
  const parts = params.token.split(".");
  if (parts.length !== 3) return { ok: false, error: "jwt_format_invalid" };
  const [h, p, s] = parts;
  if (!h || !p || !s) return { ok: false, error: "jwt_format_invalid" };

  let header: JwtHeader;
  let payload: any;
  try {
    header = jsonDecode(base64urlDecode(h).toString("utf8"));
    payload = jsonDecode(base64urlDecode(p).toString("utf8"));
  } catch {
    return { ok: false, error: "jwt_decode_failed" };
  }

  if (header?.alg !== "HS256") return { ok: false, error: "jwt_alg_invalid" };

  const signingInput = `${h}.${p}`;
  const expectedSig = signHs256(signingInput, params.secret);
  try {
    const a = Buffer.from(s);
    const b = Buffer.from(expectedSig);
    if (a.length !== b.length) return { ok: false, error: "jwt_signature_invalid" };
    if (!timingSafeEqual(a, b)) return { ok: false, error: "jwt_signature_invalid" };
  } catch {
    return { ok: false, error: "jwt_signature_invalid" };
  }

  const nowSec = params.nowSec ?? Math.floor(Date.now() / 1000);
  if (typeof payload?.exp === "number" && nowSec >= payload.exp) {
    return { ok: false, error: "jwt_expired" };
  }
  if (typeof payload?.nbf === "number" && nowSec < payload.nbf) {
    return { ok: false, error: "jwt_not_active" };
  }
  if (params.expectedIssuer && payload?.iss !== params.expectedIssuer) {
    return { ok: false, error: "jwt_issuer_invalid" };
  }
  if (params.expectedAudience && payload?.aud !== params.expectedAudience) {
    return { ok: false, error: "jwt_audience_invalid" };
  }

  return { ok: true, header, payload: payload as TPayload };
}

