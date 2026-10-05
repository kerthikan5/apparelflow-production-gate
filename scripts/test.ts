import { spawn, spawnSync } from "node:child_process";
import { setTimeout } from "node:timers/promises";
const url = new URL(process.env.DATABASE_URL ?? "");
if (!url.pathname.endsWith("_test"))
  throw new Error(
    "Tests require a dedicated database whose name ends with _test.",
  );
process.env.APP_ORIGIN = "http://localhost:3100";
function run(file: string, args: string[]) {
  const result = spawnSync(process.execPath, [file, ...args], {
    stdio: "inherit",
    env: process.env,
  });
  if (result.status !== 0) throw new Error(`Command failed: ${file}`);
}
run("node_modules/prisma/build/index.js", ["migrate", "deploy"]);
run("node_modules/tsx/dist/cli.mjs", ["prisma/seed.ts"]);
const server = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    ...(process.env.TEST_PRODUCTION === "1" ? ["start"] : ["dev", "--webpack"]),
    "-p",
    "3100",
  ],
  { stdio: "inherit", env: process.env },
);
try {
  let ready = false;
  for (let n = 0; n < 90; n++) {
    try {
      const r = await fetch("http://localhost:3100/api/me");
      if (r.status === 401) {
        ready = true;
        break;
      }
    } catch {}
    await setTimeout(1000);
  }
  if (!ready) throw new Error("Test HTTP server did not become ready.");
  run("node_modules/tsx/dist/cli.mjs", [
    "--test",
    "--test-concurrency=1",
    "tests/integration.test.ts",
  ]);
} finally {
  if (process.platform === "win32" && server.pid)
    spawnSync("taskkill", ["/pid", String(server.pid), "/T", "/F"], {
      stdio: "ignore",
    });
  else server.kill("SIGTERM");
}
