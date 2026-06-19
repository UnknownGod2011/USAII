import { closeSync, existsSync, openSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const database = join(process.cwd(), "prisma", "dev.db");
if (!existsSync(database)) closeSync(openSync(database, "a"));
process.env.DATABASE_URL ||= "file:./dev.db";

const prismaCli = join(process.cwd(), "node_modules", "prisma", "build", "index.js");
const result = spawnSync(process.execPath, [prismaCli, "db", "push", "--skip-generate"], {
  cwd: process.cwd(),
  stdio: "inherit",
  shell: false,
  env: process.env,
});
if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
if (result.status !== 0) process.exit(result.status || 1);
