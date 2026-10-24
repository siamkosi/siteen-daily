// Uses the real renderer, synthetic content, and no Auth/DB/network fixtures.
// Node 24's TypeScript stripping avoids an extra runtime compiler dependency.
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  renderPdf,
  pdfBrowserOptions,
} from "../src/lib/server/pdf-renderer.ts";

const output = process.argv[2] || "output/qa/pdf-runtime";
await mkdir(output, { recursive: true });
const image = (await readFile("public/branding/siteen-daily.png")).toString(
  "base64",
);
const document = {
  kind: "report",
  id: "11111111-1111-4111-8111-111111111111",
  workspaceId: "22222222-2222-4222-8222-222222222222",
};
const css = `@page{size:A4;margin:15mm}body{font-family:"Noto Sans Thai",sans-serif;font-size:14px;color:#23352e}.page{break-after:page}.page:last-child{break-after:auto}h1{font-size:24px}table{width:100%;border-collapse:collapse}td,th{border:1px solid #88998c;padding:9px;text-align:left}img{width:240px;height:240px;object-fit:contain}`;
for (const kind of ["report", "request"]) {
  const label = kind === "report" ? "Daily Report" : "Daily Request";
  const html = `<div class="print-report"><section class="page"><h1>${label} - SiteEN DAILY</h1><p>ทดสอบเอกสารภาษาไทย ข้อมูลสมมติสำหรับตรวจระบบ PDF</p><table><tr><th>งานประจำวัน</th><th>เวลา</th></tr><tr><td>ตรวจแบบหล่อและเตรียมเทคอนกรีต</td><td>08:00 - 17:00</td></tr></table><p>ผู้จัดทำ: วิศวกรสนามตัวอย่าง</p></section><section class="page"><h1>รูปประกอบหน้าที่สอง</h1><img alt="โลโก้สำหรับทดสอบ" src="data:image/png;base64,${image}"><p>ฟอนต์ไทยและรูปภาพต้องแสดงครบ</p></section></div>`;
  const pdf = await renderPdf({
    document: { ...document, kind },
    filename: `siteen-${kind}-smoke`,
    html,
    css,
    cancellation: { cancelled: kind === "request" },
  });
  assert.equal(Buffer.from(pdf).subarray(0, 5).toString(), "%PDF-");
  assert.ok(pdf.length > 10000, "Expected embedded font and image");
  await writeFile(path.join(output, `${kind}.pdf`), pdf);
}
await writeFile(
  path.join(output, "result.json"),
  JSON.stringify(
    {
      status: "passed",
      platform: process.platform,
      architecture: process.arch,
      browser: pdfBrowserOptions().channel,
      sandbox: pdfBrowserOptions().chromiumSandbox,
      documents: ["report.pdf", "request.pdf"],
      linux_verified: process.platform === "linux",
    },
    null,
    2,
  ),
);
console.log(
  `PASS: ${process.platform} ${pdfBrowserOptions().channel}; Thai report/request PDFs and images generated`,
);
