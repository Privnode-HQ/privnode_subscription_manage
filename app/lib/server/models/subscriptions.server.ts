import type { PlanId, SubscriptionId } from "../../id";
import { getPlatformPool } from "../db.server";

export type SubscriptionRow = {
  subscription_id: SubscriptionId;
  buyer_user_id: number;
  plan_id: PlanId;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_status: string | null;
  auto_renew_enabled: boolean;
  current_period_end: number | null;
  redeemed_code_jti: string | null;
  custom_plan_name: string | null;
  custom_plan_description: string | null;
  custom_limit_5h_units: number | null;
  custom_limit_7d_units: number | null;
  created_at: string;
};

export type SubscriptionWithPlan = SubscriptionRow & {
  plan_name: string;
  plan_description: string | null;
  limit_5h_units: number;
  limit_7d_units: number;
};

export async function createSubscriptionRecord(params: {
  subscriptionId: SubscriptionId;
  buyerUserId: number;
  planId: PlanId;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  stripeStatus: string;
  autoRenewEnabled: boolean;
  currentPeriodEnd: number | null;
}): Promise<void> {
  const pool = getPlatformPool();
  await pool.query(
    `
      INSERT INTO subscriptions(
        subscription_id, buyer_user_id, plan_id,
        stripe_customer_id, stripe_subscription_id, stripe_status,
        auto_renew_enabled, current_period_end, ordered_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8, now())
    `,
    [
      params.subscriptionId,
      params.buyerUserId,
      params.planId,
      params.stripeCustomerId,
      params.stripeSubscriptionId,
      params.stripeStatus,
      params.autoRenewEnabled,
      params.currentPeriodEnd,
    ]
  );

  await pool.query(
    `
      INSERT INTO deployments(subscription_id, status)
      VALUES ($1, 'ordered')
      ON CONFLICT(subscription_id) DO NOTHING
    `,
    [params.subscriptionId]
  );
}

export async function listSubscriptionsForUser(
  buyerUserId: number
): Promise<SubscriptionWithPlan[]> {
  const pool = getPlatformPool();
  const res = await pool.query(
    `
      SELECT
        s.subscription_id, s.buyer_user_id, s.plan_id,
        s.stripe_customer_id, s.stripe_subscription_id, s.stripe_status,
        s.auto_renew_enabled, s.current_period_end,
        s.redeemed_code_jti,
        s.custom_plan_name, s.custom_plan_description,
        s.custom_limit_5h_units, s.custom_limit_7d_units,
        s.created_at,
        COALESCE(s.custom_plan_name, p.name) AS plan_name,
        COALESCE(s.custom_plan_description, p.description) AS plan_description,
        COALESCE(s.custom_limit_5h_units, p.limit_5h_units) AS limit_5h_units,
        COALESCE(s.custom_limit_7d_units, p.limit_7d_units) AS limit_7d_units
      FROM subscriptions s
      JOIN plans p ON p.plan_id = s.plan_id
      WHERE s.buyer_user_id = $1
      ORDER BY s.created_at DESC
    `,
    [buyerUserId]
  );
  return res.rows;
}

export async function getSubscriptionForUser(params: {
  buyerUserId: number;
  subscriptionId: SubscriptionId;
}): Promise<SubscriptionWithPlan | null> {
  const pool = getPlatformPool();
  const res = await pool.query(
    `
      SELECT
        s.subscription_id, s.buyer_user_id, s.plan_id,
        s.stripe_customer_id, s.stripe_subscription_id, s.stripe_status,
        s.auto_renew_enabled, s.current_period_end,
        s.redeemed_code_jti,
        s.custom_plan_name, s.custom_plan_description,
        s.custom_limit_5h_units, s.custom_limit_7d_units,
        s.created_at,
        COALESCE(s.custom_plan_name, p.name) AS plan_name,
        COALESCE(s.custom_plan_description, p.description) AS plan_description,
        COALESCE(s.custom_limit_5h_units, p.limit_5h_units) AS limit_5h_units,
        COALESCE(s.custom_limit_7d_units, p.limit_7d_units) AS limit_7d_units
      FROM subscriptions s
      JOIN plans p ON p.plan_id = s.plan_id
      WHERE s.buyer_user_id = $1 AND s.subscription_id = $2
      LIMIT 1
    `,
    [params.buyerUserId, params.subscriptionId]
  );
  return res.rows[0] ?? null;
}

export async function updateSubscriptionFromStripe(params: {
  stripeSubscriptionId: string;
  stripeStatus: string;
  autoRenewEnabled: boolean;
  currentPeriodEnd: number | null;
}): Promise<void> {
  const pool = getPlatformPool();

  const isExpired = params.stripeStatus === "canceled" || params.stripeStatus === "incomplete_expired";

  await pool.query(
    `
      UPDATE subscriptions
      SET stripe_status = $2,
          auto_renew_enabled = $3,
          current_period_end = $4,
          expired_at = CASE WHEN $5 THEN COALESCE(expired_at, now()) ELSE expired_at END
      WHERE stripe_subscription_id = $1
    `,
    [
      params.stripeSubscriptionId,
      params.stripeStatus,
      params.autoRenewEnabled,
      params.currentPeriodEnd,
      isExpired,
    ]
  );

  if (isExpired) {
    // Station state only. Do NOT touch Privnode data here.
    await pool.query(
      `
        UPDATE deployments d
        SET status = 'expired'
        FROM subscriptions s
        WHERE s.subscription_id = d.subscription_id
          AND s.stripe_subscription_id = $1
          AND d.status <> 'expired'
      `,
      [params.stripeSubscriptionId]
    );
  }
}
