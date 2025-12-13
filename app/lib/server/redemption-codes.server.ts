import { randomBytes } from "node:crypto";
import type { PlanId, SubscriptionId } from "../id";
import { isPlanId, makeSubscriptionId } from "../id";
import { env } from "./env.server";
import { signJwtHs256, verifyJwtHs256 } from "./jwt.server";
import { getPlatformPool, withPlatformTx } from "./db.server";
import { getPlanById } from "./models/plans.server";

export type RedemptionCodeRow = {
  jti: string;
  created_by_user_id: number;
  plan_id: PlanId;
  duration_days: number;
  max_uses: number;
  used_count: number;
  expires_at: string;
  custom_plan_name: string | null;
  custom_plan_description: string | null;
  custom_limit_5h_units: number | null;
  custom_limit_7d_units: number | null;
  created_at: string;
  revoked_at: string | null;
};

export type RedemptionCodeWithPlan = RedemptionCodeRow & {
  plan_name: string;
  plan_description: string | null;
};

export async function listRedemptionCodes(params?: {
  limit?: number;
}): Promise<RedemptionCodeWithPlan[]> {
  const limit = Math.max(1, Math.min(200, Math.floor(params?.limit ?? 50)));
  const pool = getPlatformPool();
  const res = await pool.query(
    `
      SELECT
        rc.jti, rc.created_by_user_id, rc.plan_id, rc.duration_days,
        rc.max_uses, rc.used_count, rc.expires_at,
        rc.custom_plan_name, rc.custom_plan_description,
        rc.custom_limit_5h_units, rc.custom_limit_7d_units,
        rc.created_at, rc.revoked_at,
        p.name AS plan_name,
        p.description AS plan_description
      FROM redemption_codes rc
      JOIN plans p ON p.plan_id = rc.plan_id
      ORDER BY rc.created_at DESC
      LIMIT $1
    `,
    [limit]
  );
  return res.rows;
}

export type RedemptionCodeJwtPayload = {
  iss: "privnode_subscription_manage";
  aud: "privnode_subscription_manage";
  jti: string;
  iat: number;
  nbf: number;
  exp: number;

  plan_id: PlanId;
  duration_days: number;
  max_uses: number;

  custom?: {
    plan_name?: string;
    plan_description?: string;
    limit_5h_units?: number;
    limit_7d_units?: number;
  };
};

function base64url(bytes: Buffer): string {
  return bytes
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function newJti(): string {
  return `rcd_${base64url(randomBytes(24))}`;
}

function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}

export async function createRedemptionCode(params: {
  actorUserId: number;
  planId: PlanId;
  durationDays: number;
  maxUses: number;
  expiresInDays: number;
  customPlanName?: string;
  customPlanDescription?: string;
  customLimit5hUnits?: number;
  customLimit7dUnits?: number;
}): Promise<{ jti: string; token: string }> {
  const plan = await getPlanById(params.planId);
  if (!plan) throw new Error("plan_not_found");

  const durationDays = Math.floor(params.durationDays);
  const maxUses = Math.floor(params.maxUses);
  const expiresInDays = Math.floor(params.expiresInDays);
  if (durationDays <= 0) throw new Error("duration_days_invalid");
  if (maxUses <= 0) throw new Error("max_uses_invalid");
  if (expiresInDays <= 0) throw new Error("expires_in_days_invalid");

  const jti = newJti();
  const iat = nowSec();
  const exp = iat + expiresInDays * 24 * 60 * 60;
  const payload: RedemptionCodeJwtPayload = {
    iss: "privnode_subscription_manage",
    aud: "privnode_subscription_manage",
    jti,
    iat,
    nbf: iat,
    exp,
    plan_id: params.planId,
    duration_days: durationDays,
    max_uses: maxUses,
    custom:
      params.customPlanName ||
      params.customPlanDescription ||
      params.customLimit5hUnits != null ||
      params.customLimit7dUnits != null
        ? {
            plan_name: params.customPlanName || undefined,
            plan_description: params.customPlanDescription || undefined,
            limit_5h_units: params.customLimit5hUnits,
            limit_7d_units: params.customLimit7dUnits,
          }
        : undefined,
  };

  const token = signJwtHs256({ payload, secret: env.REDEMPTION_CODE_JWT_SECRET });

  await withPlatformTx(async (tx) => {
    await tx.query(
      `
        INSERT INTO redemption_codes(
          jti, created_by_user_id, plan_id, duration_days,
          max_uses, expires_at,
          custom_plan_name, custom_plan_description,
          custom_limit_5h_units, custom_limit_7d_units
        ) VALUES ($1,$2,$3,$4,$5,to_timestamp($6),$7,$8,$9,$10)
      `,
      [
        jti,
        params.actorUserId,
        params.planId,
        durationDays,
        maxUses,
        exp,
        params.customPlanName || null,
        params.customPlanDescription || null,
        params.customLimit5hUnits ?? null,
        params.customLimit7dUnits ?? null,
      ]
    );
    await tx.query(
      "INSERT INTO audit_logs(actor_user_id, action, subject_plan_id, meta) VALUES ($1, $2, $3, $4)",
      [
        params.actorUserId,
        "redemption_code.create",
        params.planId,
        { jti, durationDays, maxUses, exp },
      ]
    );
  });

  return { jti, token };
}

export type RedeemResult =
  | { ok: true; subscriptionId: SubscriptionId; alreadyRedeemed: boolean }
  | { ok: false; error: string };

export async function redeemRedemptionCode(params: {
  userId: number;
  token: string;
}): Promise<RedeemResult> {
  const verified = verifyJwtHs256<RedemptionCodeJwtPayload>({
    token: params.token,
    secret: env.REDEMPTION_CODE_JWT_SECRET,
    expectedIssuer: "privnode_subscription_manage",
    expectedAudience: "privnode_subscription_manage",
  });
  if (!verified.ok) return { ok: false, error: verified.error };

  const payload = verified.payload;
  if (!payload?.jti || typeof payload.jti !== "string") {
    return { ok: false, error: "jti_missing" };
  }
  if (!payload?.plan_id || typeof payload.plan_id !== "string" || !isPlanId(payload.plan_id)) {
    return { ok: false, error: "plan_id_invalid" };
  }
  const durationDays = Math.floor(Number(payload.duration_days));
  const maxUses = Math.floor(Number(payload.max_uses));
  if (!Number.isFinite(durationDays) || durationDays <= 0) {
    return { ok: false, error: "duration_days_invalid" };
  }
  if (!Number.isFinite(maxUses) || maxUses <= 0) {
    return { ok: false, error: "max_uses_invalid" };
  }

  const subscriptionId = makeSubscriptionId();
  const now = nowSec();
  const endAtSec = now + durationDays * 24 * 60 * 60;

  return await withPlatformTx(async (tx) => {
    const res = await tx.query(
      `
        SELECT jti, plan_id, duration_days, max_uses, used_count, expires_at, revoked_at,
               custom_plan_name, custom_plan_description, custom_limit_5h_units, custom_limit_7d_units
        FROM redemption_codes
        WHERE jti = $1
        FOR UPDATE
      `,
      [payload.jti]
    );
    if (res.rowCount === 0) return { ok: false as const, error: "redemption_code_not_found" };
    const row = res.rows[0] as RedemptionCodeRow;

    if (row.revoked_at) return { ok: false as const, error: "redemption_code_revoked" };
    if (new Date(row.expires_at).getTime() <= Date.now()) {
      return { ok: false as const, error: "redemption_code_expired" };
    }

    if (row.plan_id !== payload.plan_id) return { ok: false as const, error: "redemption_code_mismatch" };
    if (Number(row.duration_days) !== durationDays)
      return { ok: false as const, error: "redemption_code_mismatch" };
    if (Number(row.max_uses) !== maxUses) return { ok: false as const, error: "redemption_code_mismatch" };

    const already = await tx.query(
      `
        SELECT subscription_id
        FROM redemption_code_redemptions
        WHERE jti = $1 AND redeemed_by_user_id = $2
        LIMIT 1
      `,
      [payload.jti, params.userId]
    );
    if (already.rowCount > 0) {
      return {
        ok: true as const,
        subscriptionId: already.rows[0].subscription_id as SubscriptionId,
        alreadyRedeemed: true,
      };
    }

    if (Number(row.used_count) >= Number(row.max_uses)) {
      return { ok: false as const, error: "redemption_code_no_uses_left" };
    }

    await tx.query(
      `
        INSERT INTO subscriptions(
          subscription_id, buyer_user_id, plan_id,
          stripe_customer_id, stripe_subscription_id, stripe_status,
          auto_renew_enabled, current_period_end, ordered_at,
          redeemed_code_jti,
          custom_plan_name, custom_plan_description,
          custom_limit_5h_units, custom_limit_7d_units
        ) VALUES ($1,$2,$3,NULL,NULL,NULL,$4,$5, now(), $6, $7, $8, $9, $10)
      `,
      [
        subscriptionId,
        params.userId,
        payload.plan_id,
        false,
        endAtSec,
        payload.jti,
        row.custom_plan_name,
        row.custom_plan_description,
        row.custom_limit_5h_units,
        row.custom_limit_7d_units,
      ]
    );

    await tx.query(
      `
        INSERT INTO deployments(subscription_id, status)
        VALUES ($1, 'ordered')
        ON CONFLICT(subscription_id) DO NOTHING
      `,
      [subscriptionId]
    );

    await tx.query(
      `
        INSERT INTO redemption_code_redemptions(jti, redeemed_by_user_id, subscription_id)
        VALUES ($1, $2, $3)
      `,
      [payload.jti, params.userId, subscriptionId]
    );

    await tx.query(
      `
        UPDATE redemption_codes
        SET used_count = used_count + 1
        WHERE jti = $1
      `,
      [payload.jti]
    );

    await tx.query(
      "INSERT INTO audit_logs(actor_user_id, action, subject_subscription_id, subject_plan_id, meta) VALUES ($1, $2, $3, $4, $5)",
      [
        params.userId,
        "redemption_code.redeem",
        subscriptionId,
        payload.plan_id,
        { jti: payload.jti, durationDays, endAtSec },
      ]
    );

    return { ok: true as const, subscriptionId, alreadyRedeemed: false };
  });
}
