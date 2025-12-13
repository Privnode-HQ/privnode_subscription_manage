#!/usr/bin/env node
/**
 * Automatically expire subscriptions and clean up Privnode data.
 *
 * This script:
 * 1. Finds subscriptions that have expired (current_period_end <= now)
 * 2. Marks them as expired in Platform DB
 * 3. Removes the subscription entry from Privnode users' subscription_data
 */

import { getPlatformPool } from "../app/lib/server/db.server.ts";
import type { SubscriptionId } from "../app/lib/id.ts";
import { removeSubscriptionFromPrivnode } from "../app/lib/server/privnode/cleanup.server.ts";

type ExpiredSubscription = {
  subscription_id: SubscriptionId;
  privnode_user_id: number | null;
  current_period_end: number | null;
  stripe_status: string | null;
};

async function findExpiredSubscriptions(): Promise<ExpiredSubscription[]> {
  const pool = getPlatformPool();
  const nowSec = Math.floor(Date.now() / 1000);

  const res = await pool.query(
    `
      SELECT s.subscription_id, d.privnode_user_id, s.current_period_end, s.stripe_status
      FROM subscriptions s
      JOIN deployments d ON d.subscription_id = s.subscription_id
      WHERE s.expired_at IS NULL
        AND s.current_period_end IS NOT NULL
        AND s.current_period_end <= $1
        AND d.status NOT IN ('expired', 'disabled')
    `,
    [nowSec]
  );

  return res.rows;
}

async function markSubscriptionExpired(subscriptionId: SubscriptionId): Promise<void> {
  const pool = getPlatformPool();

  await pool.query(
    `
      UPDATE subscriptions
      SET expired_at = COALESCE(expired_at, now())
      WHERE subscription_id = $1
    `,
    [subscriptionId]
  );

  await pool.query(
    `
      UPDATE deployments
      SET status = 'expired'
      WHERE subscription_id = $1
        AND status <> 'expired'
    `,
    [subscriptionId]
  );
}

async function deleteSubscriptionFromPrivnode(
  privnodeUserId: number,
  subscriptionId: SubscriptionId
): Promise<boolean> {
  try {
    const result = await removeSubscriptionFromPrivnode({
      privnodeUserId,
      subscriptionId,
    });

    if (result.ok) {
      console.log(`  [OK] Removed subscription ${subscriptionId} from Privnode user ${privnodeUserId}`);
      return true;
    } else {
      console.log(`  [WARN] Could not remove subscription from Privnode: ${result.error}`);
      return false;
    }
  } catch (error) {
    console.error(`  [ERROR] Failed to remove subscription ${subscriptionId} from Privnode:`, error);
    return false;
  }
}

async function processExpiredSubscription(sub: ExpiredSubscription): Promise<void> {
  console.log(`\nProcessing expired subscription: ${sub.subscription_id}`);
  console.log(`  Period end: ${sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : 'N/A'}`);
  console.log(`  Privnode user: ${sub.privnode_user_id ?? 'N/A'}`);

  // Mark as expired in Platform DB
  await markSubscriptionExpired(sub.subscription_id);
  console.log(`  [OK] Marked as expired in Platform DB`);

  // Remove from Privnode if deployed
  if (sub.privnode_user_id) {
    await deleteSubscriptionFromPrivnode(sub.privnode_user_id, sub.subscription_id);
  }
}

async function main() {
  console.log("Starting subscription expiration check...");
  console.log(`Current time: ${new Date().toISOString()}`);

  const expired = await findExpiredSubscriptions();
  console.log(`\nFound ${expired.length} expired subscriptions`);

  if (expired.length === 0) {
    console.log("No subscriptions to expire.");
    return;
  }

  let processed = 0;
  let failed = 0;

  for (const sub of expired) {
    try {
      await processExpiredSubscription(sub);
      processed++;
    } catch (error) {
      console.error(`\nFailed to process ${sub.subscription_id}:`, error);
      failed++;
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Total found: ${expired.length}`);
  console.log(`Successfully processed: ${processed}`);
  console.log(`Failed: ${failed}`);
  console.log("Done.");

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
