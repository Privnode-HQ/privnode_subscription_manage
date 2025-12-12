import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const DATABASE_URL = process.env.PLATFORM_DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("Missing PLATFORM_DATABASE_URL");
}

const { Pool } = pg;
const pool = new Pool({ connectionString: DATABASE_URL });

const migrationsDir = path.join(process.cwd(), "db", "migrations");

function listMigrationFiles() {
  return fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

async function main() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    const applied = await client.query(
      "SELECT version FROM schema_migrations ORDER BY version ASC"
    );
    const appliedSet = new Set(applied.rows.map((r) => r.version));

    for (const file of listMigrationFiles()) {
      if (appliedSet.has(file)) continue;
      const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
      process.stdout.write(`Applying ${file}... `);
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations(version) VALUES ($1)", [
        file,
      ]);
      process.stdout.write("done\n");
    }

    await client.query("COMMIT");
    process.stdout.write("Migrations complete.\n");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

await main();

