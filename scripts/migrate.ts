/** Standalone schema migration: npm run db:migrate */
import "dotenv/config";
import { migrate, getPool } from "../lib/db";

async function main() {
  await migrate();
  const res = await getPool().query(`SELECT current_database(), current_user`);
  console.log("✅ migrated:", res.rows[0]);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
