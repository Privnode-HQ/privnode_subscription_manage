import type { PlanId } from "../../id";
import { getPlatformPool } from "../db.server";

export type Plan = {
  plan_id: PlanId;
  name: string;
  description: string | null;
  limit_5h_units: number;
  limit_7d_units: number;
  stripe_product_id: string;
  stripe_price_id: string;
  is_active: boolean;
  is_hidden: boolean;
  created_at: string;
};

export async function listActivePlans(): Promise<Plan[]> {
  const pool = getPlatformPool();
  const res = await pool.query(
    `
      SELECT plan_id, name, description, limit_5h_units, limit_7d_units,
             stripe_product_id, stripe_price_id, is_active, is_hidden, created_at
      FROM plans
      WHERE is_active = TRUE AND is_hidden = FALSE
      ORDER BY created_at DESC
    `
  );
  return res.rows;
}

export async function listAllPlans(): Promise<Plan[]> {
  const pool = getPlatformPool();
  const res = await pool.query(
    `
      SELECT plan_id, name, description, limit_5h_units, limit_7d_units,
             stripe_product_id, stripe_price_id, is_active, is_hidden, created_at
      FROM plans
      ORDER BY created_at DESC
    `
  );
  return res.rows;
}

export async function getPlanById(planId: PlanId): Promise<Plan | null> {
  const pool = getPlatformPool();
  const res = await pool.query(
    `
      SELECT plan_id, name, description, limit_5h_units, limit_7d_units,
             stripe_product_id, stripe_price_id, is_active, is_hidden, created_at
      FROM plans
      WHERE plan_id = $1
      LIMIT 1
    `,
    [planId]
  );
  return res.rows[0] ?? null;
}

export async function setPlanHidden(params: {
  planId: PlanId;
  isHidden: boolean;
}): Promise<void> {
  const pool = getPlatformPool();
  await pool.query(
    `UPDATE plans SET is_hidden = $2 WHERE plan_id = $1`,
    [params.planId, params.isHidden]
  );
}
