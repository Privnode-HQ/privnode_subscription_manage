import type { SubscriptionId } from "../../id";
import { getPlatformPool } from "../db.server";

export type DeploymentRow = {
  subscription_id: SubscriptionId;
  privnode_user_id: number | null;
  privnode_username: string | null;
  status: "ordered" | "deploying" | "deployed" | "deactivated" | "disabled" | "expired";
  deployed_at: string | null;
  deactivated_at: string | null;
  transferred_at: string | null;
};

export async function getDeployment(subscriptionId: SubscriptionId): Promise<DeploymentRow | null> {
  const pool = getPlatformPool();
  const res = await pool.query(
    `
      SELECT subscription_id, privnode_user_id, privnode_username, status,
             deployed_at, deactivated_at, transferred_at
      FROM deployments
      WHERE subscription_id = $1
      LIMIT 1
    `,
    [subscriptionId]
  );
  return res.rows[0] ?? null;
}

export async function listDeploymentsForUser(userId: number): Promise<DeploymentRow[]> {
  const pool = getPlatformPool();
  const res = await pool.query(
    `
      SELECT d.subscription_id, d.privnode_user_id, d.privnode_username, d.status,
             d.deployed_at, d.deactivated_at, d.transferred_at
      FROM deployments d
      JOIN subscriptions s ON s.subscription_id = d.subscription_id
      WHERE s.buyer_user_id = $1
      ORDER BY d.updated_at DESC
    `,
    [userId]
  );
  return res.rows;
}

export async function markDeployed(params: {
  subscriptionId: SubscriptionId;
  privnodeUserId: number;
  privnodeUsername: string;
}): Promise<void> {
  const pool = getPlatformPool();
  await pool.query(
    `
      UPDATE deployments
      SET status = 'deployed',
          privnode_user_id = $2,
          privnode_username = $3,
          deployed_at = COALESCE(deployed_at, now())
      WHERE subscription_id = $1
    `,
    [params.subscriptionId, params.privnodeUserId, params.privnodeUsername]
  );
}

export async function markDeactivated(params: {
  subscriptionId: SubscriptionId;
}): Promise<void> {
  const pool = getPlatformPool();
  await pool.query(
    `
      UPDATE deployments
      SET status = 'deactivated',
          deactivated_at = now()
      WHERE subscription_id = $1
    `,
    [params.subscriptionId]
  );
}

export async function markTransferred(params: {
  subscriptionId: SubscriptionId;
  toPrivnodeUserId: number;
  toPrivnodeUsername: string;
}): Promise<void> {
  const pool = getPlatformPool();
  await pool.query(
    `
      UPDATE deployments
      SET status = 'deployed',
          privnode_user_id = $2,
          privnode_username = $3,
          transferred_at = now()
      WHERE subscription_id = $1
    `,
    [params.subscriptionId, params.toPrivnodeUserId, params.toPrivnodeUsername]
  );
}

