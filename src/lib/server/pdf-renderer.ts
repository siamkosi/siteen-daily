import { chromium, type Browser, type LaunchOptions } from "playwright-core";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { PdfPayload } from "./pdf-handler";

// Server configuration only. HTTP callers cannot choose a browser or its flags.
export function pdfBrowserOptions(
  env: {
    PDF_BROWSER?: string;
    PDF_CHROMIUM_SANDBOX?: string;
    NODE_ENV?: string;
  } = process.env,
  platform: NodeJS.Platform = process.platform,
): LaunchOptions {
  const browser =
    env.PDF_BROWSER || (platform === "win32" ? "msedge" : "chromium");
  if (browser !== "chromium" && browser !== "msedge")
    throw new Error("PDF_BROWSER must be chromium or msedge");
  const sandbox = env.PDF_CHROMIUM_SANDBOX;
  if (sandbox !== undefined && sandbox !== "true" && sandbox !== "false")
    throw new Error("PDF_CHROMIUM_SANDBOX must be true or false");
  if (
    platform === "linux" &&
    sandbox === "false" &&
    env.NODE_ENV === "production"
  )
    throw new Error("The Linux production PDF browser requires its sandbox");
  return {
    channel: browser,
    headless: true,
    timeout: 15000,
    chromiumSandbox: platform === "linux" ? sandbox !== "false" : false,
  };
}

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );
}

export async function renderPdf(payload: PdfPayload): Promise<Uint8Array> {
  let browser: Browser | undefined;
  let watchdog: ReturnType<typeof setTimeout> | undefined;
  try {
    const font = (
      await readFile(path.join(process.cwd(), "public/fonts/NotoSansThai.ttf"))
    ).toString("base64");
    browser = await chromium.launch(pdfBrowserOptions());
    watchdog = setTimeout(() => {
      void browser?.close().catch(() => undefined);
    }, 30000);
    const context = await browser.newContext({
      javaScriptEnabled: false,
      serviceWorkers: "block",
      acceptDownloads: false,
    });
    await context.route("**/*", (route) => route.abort());
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    const csp =
      "default-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src data:; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
    const css =
      payload.css +
      `\n@font-face{font-family:"Noto Sans Thai";src:url(data:font/ttf;base64,${font}) format("truetype");font-weight:100 900;font-style:normal} *{animation:none!important;transition:none!important} #pdf-cancelled-mark{display:block!important;position:fixed!important;top:43%!important;left:5%!important;right:5%!important;z-index:2147483647!important;text-align:center!important;transform:rotate(-24deg)!important;font-family:"Noto Sans Thai",sans-serif!important;font-size:40px!important;font-weight:700!important;color:rgba(160,0,0,.35)!important;pointer-events:none!important}`;
    const title = escapeHtml(
      `${payload.document.kind === "request" ? "Daily Request" : "Daily Report"} - ${payload.filename || payload.document.id} | SiteEN DAILY`,
    );
    const cancellationMark = payload.cancellation?.cancelled
      ? '<div id="pdf-cancelled-mark">ยกเลิกแล้ว / CANCELLED</div>'
      : "";
    await page.setContent(
      `<!doctype html><html lang="th"><head><meta charset="utf-8"><title>${title}</title><meta http-equiv="Content-Security-Policy" content="${csp}"><style>${css}</style></head><body><div class="main-shell"><main>${payload.html}</main></div>${cancellationMark}</body></html>`,
      { waitUntil: "load", timeout: 15000 },
    );
    await page.emulateMedia({ media: "print" });
    await page.evaluate(() => document.fonts.ready);
    await page
      .locator("img")
      .evaluateAll((images) =>
        Promise.all(images.map((img) => (img as HTMLImageElement).decode())),
      );
    return new Uint8Array(
      await page.pdf({
        format: "A4",
        preferCSSPageSize: true,
        printBackground: true,
        displayHeaderFooter: false,
      }),
    );
  } finally {
    clearTimeout(watchdog);
    await browser?.close();
  }
}
