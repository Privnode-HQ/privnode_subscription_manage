import assert from "node:assert";
import {
  isPlanId,
  isSubscriptionId,
  makePlanId,
  makeSubscriptionId,
} from "../app/lib/id.ts";
import {
  buildInitialSubscriptionEntry,
  deactivateEntryWithoutReset,
  redeployEntryWithoutReset,
  transferEntryWithoutReset,
} from "../app/lib/server/privnode/subscription-data.server.ts";

function main() {
  const planId = makePlanId();
  const subscriptionId = makeSubscriptionId();

  assert.ok(isPlanId(planId), `planId format invalid: ${planId}`);
  assert.ok(isSubscriptionId(subscriptionId), `subscriptionId format invalid: ${subscriptionId}`);

  const nowSec = 1_700_000_000;
  const endAtSec = nowSec + 30 * 24 * 60 * 60;

  const entry = buildInitialSubscriptionEntry({
    planName: "Test Plan",
    planId,
    subscriptionId,
    nowSec,
    ownerPrivnodeUserId: 42,
    autoRenewEnabled: true,
    endAtSec,
    limit5hUnits: 10,
    limit7dUnits: 20,
  });

  assert.equal(entry["5h_limit"].total, 10 * 500000);
  assert.equal(entry["5h_limit"].available, 10 * 500000);
  assert.equal(entry["5h_limit"].reset_at, nowSec);

  assert.equal(entry["7d_limit"].total, 20 * 500000);
  assert.equal(entry["7d_limit"].available, 20 * 500000);
  assert.equal(entry["7d_limit"].reset_at, nowSec);

  const deactivated = deactivateEntryWithoutReset(entry);
  assert.equal(deactivated.status, "deactivated");
  assert.equal(deactivated["5h_limit"].available, entry["5h_limit"].available);
  assert.equal(deactivated["7d_limit"].available, entry["7d_limit"].available);
  assert.equal(deactivated["5h_limit"].reset_at, entry["5h_limit"].reset_at);
  assert.equal(deactivated["7d_limit"].reset_at, entry["7d_limit"].reset_at);

  const redeployed = redeployEntryWithoutReset({
    entry: deactivated,
    nowSec: nowSec + 10,
    ownerPrivnodeUserId: 42,
    autoRenewEnabled: false,
    endAtSec: endAtSec + 10,
  });
  assert.equal(redeployed.status, "deployed");
  assert.equal(redeployed["5h_limit"].available, entry["5h_limit"].available);
  assert.equal(redeployed["7d_limit"].available, entry["7d_limit"].available);
  assert.equal(redeployed["5h_limit"].reset_at, entry["5h_limit"].reset_at);
  assert.equal(redeployed["7d_limit"].reset_at, entry["7d_limit"].reset_at);

  const transferred = transferEntryWithoutReset({
    entry: redeployed,
    nowSec: nowSec + 20,
    newOwnerPrivnodeUserId: 99,
    autoRenewEnabled: false,
    endAtSec: endAtSec + 20,
  });
  assert.equal(transferred.owner, 99);
  assert.equal(transferred["5h_limit"].available, entry["5h_limit"].available);
  assert.equal(transferred["7d_limit"].available, entry["7d_limit"].available);
  assert.equal(transferred["5h_limit"].reset_at, entry["5h_limit"].reset_at);
  assert.equal(transferred["7d_limit"].reset_at, entry["7d_limit"].reset_at);

  console.log("selfcheck OK");
}

main();
