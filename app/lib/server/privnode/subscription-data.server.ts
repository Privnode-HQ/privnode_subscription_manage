import type { PlanId, SubscriptionId } from "../../id";

export type SubscriptionDataLimit = {
  total: number;
  available: number;
  reset_at: number;
};

export type SubscriptionDataDuration = {
  start_at: number;
  end_at: number;
  auto_renew_enabled: boolean;
};

export type SubscriptionDataStatus =
  | "ordered"
  | "deploying"
  | "deployed"
  | "deactivated"
  | "disabled"
  | "expired";

export type SubscriptionDataEntry = {
  plan_name: string;
  plan_id: PlanId;
  subscription_id: SubscriptionId;
  "5h_limit": SubscriptionDataLimit;
  "7d_limit": SubscriptionDataLimit;
  duration: SubscriptionDataDuration;
  owner: number;
  status: SubscriptionDataStatus;
  last_reset_at?: number;
};

export function normalizeSubscriptionData(input: any): SubscriptionDataEntry[] {
  if (!input) return [];
  if (Array.isArray(input)) return input as SubscriptionDataEntry[];
  if (typeof input === "string") {
    const trimmed = input.trim();
    if (!trimmed || trimmed === "null") return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (!parsed) return [];
      if (Array.isArray(parsed)) return parsed as SubscriptionDataEntry[];
      // If it's an object, wrap it in an array
      if (typeof parsed === "object") return [];
    } catch (e) {
      // Invalid JSON
      return [];
    }
  }
  // For any other unexpected type, return empty array instead of throwing
  return [];
}

export function buildInitialSubscriptionEntry(params: {
  planName: string;
  planId: PlanId;
  subscriptionId: SubscriptionId;
  nowSec: number;
  ownerPrivnodeUserId: number;
  autoRenewEnabled: boolean;
  endAtSec: number;
  limit5hUnits: number;
  limit7dUnits: number;
}): SubscriptionDataEntry {
  const total5h = Math.floor(params.limit5hUnits * 500000);
  const total7d = Math.floor(params.limit7dUnits * 500000);

  return {
    plan_name: params.planName,
    plan_id: params.planId,
    subscription_id: params.subscriptionId,
    "5h_limit": {
      total: total5h,
      available: total5h,
      reset_at: params.nowSec,
    },
    "7d_limit": {
      total: total7d,
      available: total7d,
      reset_at: params.nowSec,
    },
    duration: {
      start_at: params.nowSec,
      end_at: params.endAtSec,
      auto_renew_enabled: params.autoRenewEnabled,
    },
    owner: params.ownerPrivnodeUserId,
    status: "deployed",
  };
}

export function findEntryIndex(
  arr: SubscriptionDataEntry[],
  subscriptionId: SubscriptionId
): number {
  return arr.findIndex((x) => x?.subscription_id === subscriptionId);
}

export function redeployEntryWithoutReset(params: {
  entry: SubscriptionDataEntry;
  nowSec: number;
  ownerPrivnodeUserId: number;
  autoRenewEnabled: boolean;
  endAtSec: number;
}): SubscriptionDataEntry {
  // Strict rule: do NOT reset available/reset_at when redeploying.
  return {
    ...params.entry,
    owner: params.ownerPrivnodeUserId,
    status: "deployed",
    duration: {
      ...params.entry.duration,
      start_at: params.nowSec,
      end_at: params.endAtSec,
      auto_renew_enabled: params.autoRenewEnabled,
    },
  };
}

export function deactivateEntryWithoutReset(entry: SubscriptionDataEntry): SubscriptionDataEntry {
  return {
    ...entry,
    status: "deactivated",
  };
}

export function transferEntryWithoutReset(params: {
  entry: SubscriptionDataEntry;
  nowSec: number;
  newOwnerPrivnodeUserId: number;
  autoRenewEnabled: boolean;
  endAtSec: number;
}): SubscriptionDataEntry {
  // Strict rule: do NOT reset available/reset_at when transferring.
  return {
    ...params.entry,
    owner: params.newOwnerPrivnodeUserId,
    status: "deployed",
    duration: {
      ...params.entry.duration,
      start_at: params.nowSec,
      end_at: params.endAtSec,
      auto_renew_enabled: params.autoRenewEnabled,
    },
  };
}
