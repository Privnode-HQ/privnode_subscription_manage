import { getPlatformPool, withPlatformTx } from "../db.server";
import { env } from "../env.server";
import { isAdminEmail, normalizeEmail } from "./users.server";
import {
  authorizationCodeGrant,
  buildAuthorizationUrl,
  calculatePKCECodeChallenge,
  discovery,
  fetchUserInfo,
  randomPKCECodeVerifier,
  randomState,
  skipSubjectCheck,
} from "openid-client";

type OidcProviderConfig = {
  id: string;
  issuer: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scope: string;
};

function getProviders(): OidcProviderConfig[] {
  if (!env.OIDC_PROVIDERS_JSON) return [];
  const parsed = JSON.parse(env.OIDC_PROVIDERS_JSON);
  if (!Array.isArray(parsed)) throw new Error("OIDC_PROVIDERS_JSON must be an array");
  return parsed;
}

export function listOidcProviders(): Array<Pick<OidcProviderConfig, "id">> {
  return getProviders().map((p) => ({ id: p.id }));
}

function getProvider(providerId: string): OidcProviderConfig {
  const p = getProviders().find((x) => x.id === providerId);
  if (!p) throw new Error(`Unknown OIDC provider: ${providerId}`);
  return p;
}

let clientCache = new Map<string, any>();

async function getClient(providerId: string) {
  if (clientCache.has(providerId)) return clientCache.get(providerId);
  const p = getProvider(providerId);
  const config = await discovery(new URL(p.issuer), p.clientId, {
    client_secret: p.clientSecret,
    redirect_uris: [p.redirectUri],
    response_types: ["code"],
  });
  clientCache.set(providerId, { config, provider: p });
  return clientCache.get(providerId);
}

export async function createOidcAuthorizationUrl(providerId: string): Promise<string> {
  const { config, provider } = await getClient(providerId);
  const state = randomState();
  const codeVerifier = randomPKCECodeVerifier();
  const codeChallenge = await calculatePKCECodeChallenge(codeVerifier);

  const pool = getPlatformPool();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  await pool.query(
    "INSERT INTO oidc_states(state, provider_id, code_verifier, expires_at) VALUES ($1, $2, $3, $4)",
    [state, providerId, codeVerifier, expiresAt]
  );

  const authUrl = buildAuthorizationUrl(config, {
    redirect_uri: provider.redirectUri,
    scope: provider.scope,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });
  return authUrl.toString();
}

export async function handleOidcCallback(params: {
  providerId: string;
  currentUrl: string;
}): Promise<
  | { ok: true; userId: number }
  | { ok: false; error: "invalid_state" | "no_email" | "exchange_failed" }
> {
  const { providerId, currentUrl } = params;
  const { config } = await getClient(providerId);
  const url = new URL(currentUrl);
  const state = url.searchParams.get("state") ?? "";
  const code = url.searchParams.get("code") ?? "";
  if (!state || !code) return { ok: false, error: "exchange_failed" };

  const pool = getPlatformPool();
  const stateRow = await pool.query(
    `
      DELETE FROM oidc_states
      WHERE state = $1 AND provider_id = $2 AND expires_at > now()
      RETURNING code_verifier
    `,
    [state, providerId]
  );
  if (stateRow.rowCount === 0) return { ok: false, error: "invalid_state" };
  const codeVerifier = stateRow.rows[0].code_verifier as string;

  try {
    const tokens = await authorizationCodeGrant(config, url, {
      pkceCodeVerifier: codeVerifier,
      expectedState: state,
    });

    const idClaims = tokens.claims();
    const expectedSub = idClaims?.sub;
    const userinfo = tokens.access_token
      ? await fetchUserInfo(
          config,
          tokens.access_token,
          expectedSub ? expectedSub : skipSubjectCheck
        )
      : null;

    const sub = (userinfo as any)?.sub ?? expectedSub;
    const email = (userinfo as any)?.email
      ? normalizeEmail(String((userinfo as any).email))
      : idClaims?.email
        ? normalizeEmail(String((idClaims as any).email))
        : undefined;

    if (!email) return { ok: false, error: "no_email" };
    if (!sub) return { ok: false, error: "exchange_failed" };

    // Link account by (provider_id, subject) and ensure user exists.
    const userId = await withPlatformTx(async (tx) => {
      const existing = await tx.query(
        `
          SELECT user_id
          FROM oidc_accounts
          WHERE provider_id = $1 AND subject = $2
          LIMIT 1
        `,
        [providerId, sub]
      );

      if (existing.rowCount > 0) {
        return Number(existing.rows[0].user_id);
      }

      const role = isAdminEmail(email) ? "admin" : "user";
      const user = await tx.query(
          `
            INSERT INTO users(email, role)
            VALUES ($1, $2)
            ON CONFLICT(email) DO UPDATE SET email = EXCLUDED.email
            RETURNING id
          `,
          [email, role]
        );
      const newUserId = Number(user.rows[0].id);

      await tx.query(
          "INSERT INTO oidc_accounts(user_id, provider_id, subject, email) VALUES ($1, $2, $3, $4) ON CONFLICT(provider_id, subject) DO NOTHING",
          [newUserId, providerId, sub, email]
        );
      return newUserId;
    });

    return { ok: true, userId };
  } catch {
    return { ok: false, error: "exchange_failed" };
  }
}
