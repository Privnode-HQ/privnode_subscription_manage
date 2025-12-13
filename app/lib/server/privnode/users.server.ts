import type { SubscriptionId } from "../../id";
import { getPrivnodeDialect, withPrivnodeTx, type PrivnodeDialect } from "../db.server";
import {
  deactivateEntryWithoutReset,
  findEntryIndex,
  normalizeSubscriptionData,
  redeployEntryWithoutReset,
  transferEntryWithoutReset,
  type SubscriptionDataEntry,
} from "./subscription-data.server";

export type PrivnodeUserRow = {
  id: number;
  username: string;
  group: string | null;
  subscription_data: any;
};

function p(dialect: PrivnodeDialect, idx: number): string {
  return dialect === "mysql" ? "?" : `$${idx}`;
}

function ident(dialect: PrivnodeDialect, name: string): string {
  return dialect === "mysql" ? `\`${name}\`` : `"${name}"`;
}

export async function findPrivnodeUserByIdentifier(
  identifier: string
): Promise<PrivnodeUserRow | null> {
  const raw = identifier.trim();
  if (!raw) return null;
  return withPrivnodeTx(async (tx) => {
    const dialect = getPrivnodeDialect();
    let res;
    if (/^\d+$/.test(raw)) {
      res = await tx.query(
        `SELECT id, username, ${ident(dialect, "group")} as ${ident(
          dialect,
          "group"
        )}, subscription_data FROM users WHERE id = ${p(dialect, 1)} LIMIT 1`,
        [Number(raw)]
      );
    } else {
      res = await tx.query(
        `SELECT id, username, ${ident(dialect, "group")} as ${ident(
          dialect,
          "group"
        )}, subscription_data FROM users WHERE username = ${p(dialect, 1)} LIMIT 1`,
        [raw]
      );
    }
    return (res.rows[0] as any) ?? null;
  });
}

export async function getSubscriptionDataEntryForUser(params: {
  privnodeUserId: number;
  subscriptionId: SubscriptionId;
}): Promise<SubscriptionDataEntry | null> {
  return withPrivnodeTx(async (tx) => {
    const dialect = getPrivnodeDialect();
    const res = await tx.query(
      `SELECT subscription_data FROM users WHERE id = ${p(dialect, 1)} LIMIT 1`,
      [params.privnodeUserId]
    );
    if (res.rowCount === 0) return null;
    const arr = normalizeSubscriptionData(res.rows[0].subscription_data);
    const idx = findEntryIndex(arr, params.subscriptionId);
    return idx === -1 ? null : arr[idx];
  });
}

export async function deploySubscriptionToPrivnode(params: {
  identifier: string;
  subscriptionId: SubscriptionId;
  buildInitial: (ownerPrivnodeUserId: number) => SubscriptionDataEntry;
  nowSec: number;
  endAtSec: number;
  autoRenewEnabled: boolean;
}): Promise<{ privnodeUserId: number; privnodeUsername: string } | { error: string }> {
  return withPrivnodeTx(async (tx) => {
    const dialect = getPrivnodeDialect();
    const user = await findPrivnodeUserRowForUpdate(tx, dialect, params.identifier);
    if (!user) return { error: "privnode_user_not_found" };

    const arr = normalizeSubscriptionData(user.subscription_data);
    const idx = findEntryIndex(arr, params.subscriptionId);

    if (idx === -1) {
      arr.push(params.buildInitial(user.id));
    } else {
      // Redeploy is only allowed from deactivated; do not reset quota.
      const existing = arr[idx];
      if (existing.status !== "deactivated") {
        return { error: "already_present_not_deactivated" };
      }
      arr[idx] = redeployEntryWithoutReset({
        entry: existing,
        nowSec: params.nowSec,
        ownerPrivnodeUserId: user.id,
        endAtSec: params.endAtSec,
        autoRenewEnabled: params.autoRenewEnabled,
      });
    }

    await tx.query(
      `UPDATE users SET ${ident(dialect, "group")} = ${p(dialect, 1)}, subscription_data = ${p(
        dialect,
        2
      )} WHERE id = ${p(dialect, 3)}`,
      ["subscription", JSON.stringify(arr), user.id]
    );

    return { privnodeUserId: user.id, privnodeUsername: user.username };
  });
}

export async function deactivateSubscriptionOnPrivnode(params: {
  privnodeUserId: number;
  subscriptionId: SubscriptionId;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  return withPrivnodeTx(async (tx) => {
    const dialect = getPrivnodeDialect();
    const res = await tx.query(
      `SELECT id, username, ${ident(dialect, "group")} as ${ident(
        dialect,
        "group"
      )}, subscription_data FROM users WHERE id = ${p(
        dialect,
        1
      )} LIMIT 1 FOR UPDATE`,
      [params.privnodeUserId]
    );
    const user = (res.rows[0] as any) as PrivnodeUserRow | undefined;
    if (!user) return { ok: false, error: "privnode_user_not_found" };
    const arr = normalizeSubscriptionData(user.subscription_data);
    const idx = findEntryIndex(arr, params.subscriptionId);
    if (idx === -1) return { ok: false, error: "subscription_not_found" };

    arr[idx] = deactivateEntryWithoutReset(arr[idx]);

    // Check if there are any remaining deployed subscriptions
    const hasDeployedSubscriptions = arr.some(entry => entry.status === "deployed");
    const newGroup = hasDeployedSubscriptions ? user.group : "default";

    await tx.query(
      `UPDATE users SET ${ident(dialect, "group")} = ${p(dialect, 1)}, subscription_data = ${p(
        dialect,
        2
      )} WHERE id = ${p(dialect, 3)}`,
      [newGroup, JSON.stringify(arr), user.id]
    );
    return { ok: true };
  });
}

export async function transferSubscriptionBetweenPrivnodeUsers(params: {
  fromPrivnodeUserId: number;
  toIdentifier: string;
  subscriptionId: SubscriptionId;
  nowSec: number;
  endAtSec: number;
  autoRenewEnabled: boolean;
}): Promise<
  | { ok: true; toPrivnodeUserId: number; toPrivnodeUsername: string }
  | { ok: false; error: string }
> {
  return withPrivnodeTx(async (tx) => {
    const dialect = getPrivnodeDialect();
    const fromRes = await tx.query(
      `SELECT id, username, ${ident(dialect, "group")} as ${ident(
        dialect,
        "group"
      )}, subscription_data FROM users WHERE id = ${p(
        dialect,
        1
      )} LIMIT 1 FOR UPDATE`,
      [params.fromPrivnodeUserId]
    );
    const fromUser = (fromRes.rows[0] as any) as PrivnodeUserRow | undefined;
    if (!fromUser) return { ok: false, error: "from_user_not_found" };

    const toUser = await findPrivnodeUserRowForUpdate(tx, dialect, params.toIdentifier);
    if (!toUser) return { ok: false, error: "to_user_not_found" };

    const fromArr = normalizeSubscriptionData(fromUser.subscription_data);
    const idx = findEntryIndex(fromArr, params.subscriptionId);
    if (idx === -1) return { ok: false, error: "subscription_not_found_on_source" };
    const entry = fromArr[idx];

    // Remove from source, append to target (no duplicates).
    fromArr.splice(idx, 1);

    const toArr = normalizeSubscriptionData(toUser.subscription_data);
    if (findEntryIndex(toArr, params.subscriptionId) !== -1) {
      return { ok: false, error: "subscription_already_exists_on_target" };
    }

    const transferred = transferEntryWithoutReset({
      entry,
      nowSec: params.nowSec,
      newOwnerPrivnodeUserId: toUser.id,
      endAtSec: params.endAtSec,
      autoRenewEnabled: params.autoRenewEnabled,
    });

    toArr.push(transferred);

    await tx.query(
      `UPDATE users SET subscription_data = ${p(dialect, 1)} WHERE id = ${p(dialect, 2)}`,
      [JSON.stringify(fromArr), fromUser.id]
    );
    await tx.query(
      `UPDATE users SET ${ident(dialect, "group")} = ${p(dialect, 1)}, subscription_data = ${p(
        dialect,
        2
      )} WHERE id = ${p(dialect, 3)}`,
      ["subscription", JSON.stringify(toArr), toUser.id]
    );

    return { ok: true, toPrivnodeUserId: toUser.id, toPrivnodeUsername: toUser.username };
  });
}

async function findPrivnodeUserRowForUpdate(
  tx: any,
  dialect: PrivnodeDialect,
  identifier: string
): Promise<PrivnodeUserRow | null> {
  const raw = identifier.trim();
  if (!raw) return null;
  let res;
  if (/^\d+$/.test(raw)) {
    res = await tx.query(
      `SELECT id, username, ${ident(dialect, "group")} as ${ident(
        dialect,
        "group"
      )}, subscription_data FROM users WHERE id = ${p(
        dialect,
        1
      )} LIMIT 1 FOR UPDATE`,
      [Number(raw)]
    );
  } else {
    res = await tx.query(
      `SELECT id, username, ${ident(dialect, "group")} as ${ident(
        dialect,
        "group"
      )}, subscription_data FROM users WHERE username = ${p(
        dialect,
        1
      )} LIMIT 1 FOR UPDATE`,
      [raw]
    );
  }
  return (res.rows[0] as any) ?? null;
}
