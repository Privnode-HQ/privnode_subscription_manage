import pg from "pg";
import { env } from "./env.server";

const { Pool } = pg;

type PoolType = any;
type PoolClientType = any;

let platformPool: PoolType | undefined;
let privnodePool: PoolType | undefined;

export function getPlatformPool(): PoolType {
  if (!platformPool) {
    platformPool = new Pool({ connectionString: env.PLATFORM_DATABASE_URL });
  }
  return platformPool;
}

export function getPrivnodePool(): PoolType {
  if (!privnodePool) {
    privnodePool = new Pool({ connectionString: env.PRIVNODE_DATABASE_URL });
  }
  return privnodePool;
}

export type DbTx = PoolClientType;

export async function withPlatformTx<T>(fn: (tx: DbTx) => Promise<T>): Promise<T> {
  const pool = getPlatformPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const res = await fn(client);
    await client.query("COMMIT");
    return res;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function withPrivnodeTx<T>(fn: (tx: DbTx) => Promise<T>): Promise<T> {
  const pool = getPrivnodePool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const res = await fn(client);
    await client.query("COMMIT");
    return res;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
