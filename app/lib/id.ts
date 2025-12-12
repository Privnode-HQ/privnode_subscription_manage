import { randomBytes } from "node:crypto";

const BASE62 = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

function toBase62(bytes: Uint8Array): string {
  // Convert random bytes -> base62 string.
  // This is not a reversible encoding; we just need uniformly-distributed chars.
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += BASE62[bytes[i] % BASE62.length];
  }
  return out;
}

export type PlanId = `pln_${string}`;
export type SubscriptionId = `sub_${string}`;

export function makePlanId(): PlanId {
  return `pln_${toBase62(randomBytes(16))}` as PlanId;
}

export function makeSubscriptionId(): SubscriptionId {
  return `sub_${toBase62(randomBytes(16))}` as SubscriptionId;
}

export function isPlanId(v: string): v is PlanId {
  return /^pln_[0-9a-zA-Z]{16}$/.test(v);
}

export function isSubscriptionId(v: string): v is SubscriptionId {
  return /^sub_[0-9a-zA-Z]{16}$/.test(v);
}

