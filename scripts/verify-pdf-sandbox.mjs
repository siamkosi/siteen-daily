import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "/app/node_modules/playwright-core/index.mjs";
import { pdfBrowserOptions } from "/app/src/lib/server/pdf-renderer.ts";

const options = pdfBrowserOptions();
assert.equal(process.platform, "linux");
assert.notEqual(process.getuid(), 0);
assert.equal(options.chromiumSandbox, true);
const browser = await chromium.launch(options);
try {
  const page = await browser.newPage();
  await page.goto("chrome://sandbox");
  const status = await page.locator("body").innerText();
  await mkdir("/tmp/pdf-sandbox", { recursive: true });
  await writeFile("/tmp/pdf-sandbox/status.txt", status);
  assert.match(status, /Layer 1 Sandbox\s+Namespace/i);
  assert.match(status, /PID namespaces\s+Yes/i);
  assert.match(status, /Network namespaces\s+Yes/i);
  assert.match(status, /Seccomp-BPF sandbox\s+(Yes|Enabled)/i);
  await writeFile(
    "/tmp/pdf-sandbox/result.json",
    JSON.stringify(
      {
        status: "passed",
        platform: process.platform,
        uid: process.getuid(),
        browser: browser.version(),
        namespace_sandbox: true,
        seccomp_bpf_sandbox: true,
      },
      null,
      2,
    ),
  );
  console.log(
    `PASS: actual Chromium ${browser.version()} namespace and Seccomp-BPF sandboxes enabled`,
  );
} finally {
  await browser.close();
}
