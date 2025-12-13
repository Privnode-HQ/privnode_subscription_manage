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
import { signJwtHs256, verifyJwtHs256 } from "../app/lib/server/jwt.server.ts";
import {
  subscriptionAutoRenewEnabled,
  subscriptionCurrentPeriodEnd,
} from "../app/lib/server/stripe-helpers.server.ts";

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

  const secret = "test_secret_please_change";
  const nowSec2 = 1_700_000_000;
  const token = signJwtHs256({
    secret,
    payload: {
      iss: "test",
      aud: "test",
      jti: "jti_1",
      iat: nowSec2,
      nbf: nowSec2,
      exp: nowSec2 + 60,
    },
  });
  const ok = verifyJwtHs256({
    token,
    secret,
    nowSec: nowSec2,
    expectedIssuer: "test",
    expectedAudience: "test",
  });
  assert.equal(ok.ok, true);

  const expired = verifyJwtHs256({
    token,
    secret,
    nowSec: nowSec2 + 60,
    expectedIssuer: "test",
    expectedAudience: "test",
  });
  assert.equal(expired.ok, false);

  const badSig = verifyJwtHs256({
    token,
    secret: "wrong",
    nowSec: nowSec2,
    expectedIssuer: "test",
    expectedAudience: "test",
  });
  assert.equal(badSig.ok, false);

  const stripeSub: any = {
    cancel_at_period_end: false,
    items: {
      data: [
        { current_period_end: endAtSec + 10 },
        { current_period_end: endAtSec },
      ],
    },
  };
  assert.equal(subscriptionAutoRenewEnabled(stripeSub), true);
  assert.equal(subscriptionCurrentPeriodEnd(stripeSub), endAtSec);

  console.log("selfcheck OK");
}

main();
