// 번호 순서의 .sql 마이그레이션 중 아직 적용되지 않은 파일만 적용한다.
// 사용: npm run db:migrate  (DATABASE_URL 대상)
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { Pool } from "@neondatabase/serverless";

const migrationsDir = fileURLToPath(new URL("./migrations/", import.meta.url));

export async function migrate(connectionString) {
  // 여러 문장이 든 .sql 파일과 트랜잭션을 쓰려면 HTTP가 아닌 세션(WebSocket) 연결이 필요하다.
  const pool = new Pool({ connectionString });
  const client = await pool.connect();
  try {
    await client.query(
      "CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
    );
    const { rows } = await client.query("SELECT name FROM schema_migrations");
    const applied = new Set(rows.map((r) => r.name));
    const files = (await readdir(migrationsDir)).filter((f) => f.endsWith(".sql")).sort();

    for (const file of files) {
      if (applied.has(file)) continue;
      const body = await readFile(path.join(migrationsDir, file), "utf8");
      await client.query("BEGIN");
      try {
        await client.query(body);
        await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw new Error(`Migration ${file} failed: ${error.message}`, { cause: error });
      }
      console.log(`applied ${file}`);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  await migrate(url);
}
