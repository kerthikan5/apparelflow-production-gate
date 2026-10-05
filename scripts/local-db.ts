import EmbeddedPostgres from "embedded-postgres";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

const envPath = ".env";
if (!existsSync(envPath)) {
  const password = randomBytes(24).toString("hex");
  writeFileSync(
    envPath,
    `DATABASE_URL="postgresql://apparelflow:${password}@127.0.0.1:54329/apparelflow?schema=public"\nAPP_ORIGIN="http://localhost:3000"\nDEMO_PASSWORD="ApparelFlow-Demo-2026!"\nNEXT_PUBLIC_DEMO_PASSWORD="ApparelFlow-Demo-2026!"\n`,
  );
}
const envText = readFileSync(envPath, "utf8");
const match = envText.match(/^DATABASE_URL="?([^"\r\n]+)"?/m);
if (!match) throw new Error("DATABASE_URL missing in .env");
const url = new URL(match[1]);
if (url.hostname !== "127.0.0.1" || url.port !== "54329")
  throw new Error(
    "Existing .env points elsewhere; use that database. Local helper requires 127.0.0.1:54329.",
  );
const pg = new EmbeddedPostgres({
  databaseDir: ".postgres",
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  port: 54329,
  persistent: true,
  authMethod: "scram-sha-256",
  postgresFlags: ["-h", "127.0.0.1"],
  onLog: () => {},
  onError: console.error,
});
if (!existsSync(".postgres/PG_VERSION")) await pg.initialise();
await pg.start();
const client = pg.getPgClient();
await client.connect();
for (const name of ["apparelflow", "apparelflow_test"]) {
  const result = await client.query(
    "SELECT 1 FROM pg_database WHERE datname=$1",
    [name],
  );
  if (!result.rowCount) await pg.createDatabase(name);
}
await client.end();
if (!existsSync(".env.test"))
  writeFileSync(
    ".env.test",
    envText
      .replace("/apparelflow?", "/apparelflow_test?")
      .replace("localhost:3000", "localhost:3100"),
  );
console.log(
  "PostgreSQL ready on 127.0.0.1:54329. Persistent development and isolated test databases are ready. Ctrl+C stops the server.",
);
async function stop() {
  await pg.stop();
  process.exit(0);
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
setInterval(() => {}, 60000);
