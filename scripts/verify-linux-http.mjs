// Linux image integration check. Fake config only; no Auth/DB calls or host ports.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir, readFile, writeFile, open } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";

const output = "/tmp/siteen-api-check";
await mkdir(output, { recursive: true });
assert.equal(process.platform, "linux");
assert.notEqual(process.getuid(), 0);
const processStatus = await readFile("/proc/self/status", "utf8");
assert.match(processStatus, /^NoNewPrivs:\s+1$/m);
assert.match(processStatus, /^Seccomp:\s+2$/m);
assert.match(processStatus, /^CapEff:\s+0+$/m);
await assert.rejects(readFile("/app/.env.local"), { code: "ENOENT" });
const serverLog = await open(`${output}/server.log`, "w");
const server = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "start",
    "--hostname",
    "127.0.0.1",
    "--port",
    "3000",
  ],
  { stdio: ["ignore", serverLog.fd, serverLog.fd] },
);
const checks = [];
try {
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    if (server.exitCode !== null)
      throw Error(`Server exited: ${server.exitCode}`);
    try {
      const response = await fetch("http://127.0.0.1:3000/api/health", {
        signal: AbortSignal.timeout(1000),
      });
      if (response.ok) {
        assert.equal(response.headers.get("cache-control"), "no-store");
        assert.deepEqual(await response.json(), { status: "ok" });
        ready = true;
        break;
      }
    } catch {
      /* Server may still be starting. */
    }
    await delay(500);
  }
  assert.ok(ready, "Next.js health route did not become ready");
  checks.push("health-200-no-store");
  const login = await fetch("http://127.0.0.1:3000/login");
  assert.equal(login.status, 200);
  assert.match(await login.text(), /SiteEN DAILY/);
  checks.push("login-200");
  for (const [origin, expected] of [
    [process.env.APP_ORIGIN, 401],
    ["https://other.example.test", 403],
    [null, 403],
  ]) {
    const headers = { "content-type": "application/json" };
    if (origin) headers.origin = origin;
    const response = await fetch("http://127.0.0.1:3000/api/reports/pdf", {
      method: "POST",
      headers,
      body: "{}",
    });
    assert.equal(response.status, expected);
    assert.equal(response.headers.get("cache-control"), "no-store");
    checks.push(
      `pdf-${origin === process.env.APP_ORIGIN ? "anonymous" : origin ? "foreign-origin" : "missing-origin"}-${expected}`,
    );
  }
  await writeFile(
    `${output}/result.json`,
    JSON.stringify(
      {
        status: "passed",
        platform: process.platform,
        uid: process.getuid(),
        no_new_privileges: true,
        seccomp: true,
        env_file_excluded: true,
        checks,
      },
      null,
      2,
    ),
  );
  console.log(
    `PASS: Linux Next.js HTTP; ${checks.join(", ")}; non-root, seccomp and no-new-privileges`,
  );
} finally {
  const stopped = once(server, "exit");
  server.kill("SIGTERM");
  await Promise.race([stopped, delay(5000)]);
  if (server.exitCode === null) server.kill("SIGKILL");
  await serverLog.close();
}
