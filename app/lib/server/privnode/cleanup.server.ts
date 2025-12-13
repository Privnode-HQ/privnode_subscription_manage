import type { SubscriptionId } from "../../id";
import { getPrivnodeDialect, withPrivnodeTx } from "../db.server";
import { findEntryIndex, normalizeSubscriptionData } from "./subscription-data.server";

function p(dialect: "postgres" | "mysql", idx: number): string {
  return dialect === "mysql" ? "?" : `$${idx}`;
}

/**
 * Remove a subscription entry from a Privnode user's subscription_data.
 * Used for cleaning up expired/unavailable subscriptions.
 */
export async function removeSubscriptionFromPrivnode(params: {
  privnodeUserId: number;
  subscriptionId: SubscriptionId;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  return withPrivnodeTx(async (tx) => {
    const dialect = getPrivnodeDialect();
    const res = await tx.query(
      `SELECT id, subscription_data FROM users WHERE id = ${p(dialect, 1)} LIMIT 1 FOR UPDATE`,
      [params.privnodeUserId]
    );

    if (res.rowCount === 0) {
      return { ok: false, error: "privnode_user_not_found" };
    }

    const user = res.rows[0];
    const arr = normalizeSubscriptionData(user.subscription_data);
    const idx = findEntryIndex(arr, params.subscriptionId);

    if (idx === -1) {
      return { ok: false, error: "subscription_not_found" };
    }

    // Remove the subscription entry completely
    arr.splice(idx, 1);

    await tx.query(
      `UPDATE users SET subscription_data = ${p(dialect, 1)} WHERE id = ${p(dialect, 2)}`,
      [JSON.stringify(arr), params.privnodeUserId]
    );

    return { ok: true };
  });
}
