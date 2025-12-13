import pg from "pg";
import mysql from "mysql2/promise";
import { env } from "./env.server";

const { Pool } = pg;

type PoolType = any;
type PoolClientType = any;

export type PrivnodeDialect = "postgres" | "mysql";

let platformPool: PoolType | undefined;
let privnodePool: PoolType | undefined;
let privnodeDialect: PrivnodeDialect | undefined;

export function getPlatformPool(): PoolType {
  if (!platformPool) {
    platformPool = new Pool({ connectionString: env.PLATFORM_DATABASE_URL });
  }
  return platformPool;
}

export function getPrivnodeDialect(): PrivnodeDialect {
  if (privnodeDialect) return privnodeDialect;
  const url = env.PRIVNODE_DATABASE_URL;
  // Do not rely on build-time env; this runs only when DB access is needed.
  const proto = new URL(url).protocol;
  if (proto === "mysql:" || proto === "mariadb:") {
    privnodeDialect = "mysql";
    return privnodeDialect;
  }
  if (proto === "postgres:" || proto === "postgresql:") {
    privnodeDialect = "postgres";
    return privnodeDialect;
  }
  throw new Error(
    `Unsupported PRIVNODE_DATABASE_URL protocol: ${proto} (expected postgres://, postgresql://, mysql://, or mariadb://)`
  );
}

function getPrivnodePool(): PoolType {
  if (privnodePool) return privnodePool;

  const dialect = getPrivnodeDialect();
  if (dialect === "postgres") {
    privnodePool = new Pool({ connectionString: env.PRIVNODE_DATABASE_URL });
    return privnodePool;
  }

  // mysql2: Pool implements getConnection() and query(); we always use explicit transactions.
  privnodePool = mysql.createPool(env.PRIVNODE_DATABASE_URL);
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
  const dialect = getPrivnodeDialect();

  if (dialect === "postgres") {
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

  // MySQL branch: wrap mysql2 connection to look like pg's query result shape.
  const conn = await pool.getConnection();
  const tx = {
    async query(text: string, params?: any[]) {
      const [rows] = await conn.query(text, params);
      if (Array.isArray(rows)) {
        return { rows, rowCount: rows.length };
      }
      const rowCount = (rows as any)?.affectedRows ?? 0;
      return { rows: [], rowCount };
    },
  } as any;

  try {
    await conn.beginTransaction();
    const res = await fn(tx);
    await conn.commit();
    return res;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}
