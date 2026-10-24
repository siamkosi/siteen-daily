import { supabase } from "./supabase";
import type { PdfDocument } from "./server/pdf-handler";
import { signPhotoPaths } from "./photos";

function dataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("อ่านรูปภาพไม่สำเร็จ"));
    reader.readAsDataURL(blob);
  });
}
export async function exportReportPdf(
  filename: string,
  documentIdentity: PdfDocument,
) {
  const session = supabase ? await supabase.auth.getSession() : null;
  const token = session?.data.session?.access_token;
  if (session?.error || !token)
    throw new Error("กรุณาเข้าสู่ระบบด้วยบัญชีจริงก่อนส่งออก PDF");
  const report = document.querySelector<HTMLElement>(".print-report");
  if (!report) throw new Error("ไม่พบรายงานสำหรับส่งออก");
  await document.fonts.ready;
  const clone = report.cloneNode(true) as HTMLElement;
  clone
    .querySelectorAll(
      "script,iframe,object,embed,.document-cancelled-watermark",
    )
    .forEach((el) => el.remove());
  // Signing at export time also covers suspended tabs and a click before React's
  // background renewal has committed. Always use print paths, never thumbnails.
  const storageImages = Array.from(
    clone.querySelectorAll<HTMLImageElement>("img[data-photo-path]"),
  );
  const freshUrls = storageImages.length
    ? await signPhotoPaths(storageImages.map((img) => img.dataset.photoPath!))
    : new Map<string, string>();
  const images = new Map<string, Promise<string>>();
  await Promise.all(
    Array.from(clone.querySelectorAll("img")).map(async (img) => {
      // Fetch directly: setting a fresh URL on the cloned <img> would also
      // start a browser image request, downloading every attachment twice.
      const src = img.dataset.photoPath
        ? freshUrls.get(img.dataset.photoPath)!
        : img.src;
      if (!images.has(src))
        images.set(
          src,
          fetch(src).then(async (response) => {
            if (!response.ok)
              throw new Error(
                "โหลดรูปภาพสำหรับ PDF ไม่สำเร็จ กรุณาเปิดรายงานใหม่แล้วลองอีกครั้ง",
              );
            return dataUrl(await response.blob());
          }),
        );
      img.removeAttribute("srcset");
      img.loading = "eager";
      img.src = await images.get(src)!;
    }),
  );
  const sheets = await Promise.all(
    Array.from(
      document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'),
    )
      .filter((link) => new URL(link.href).origin === location.origin)
      .map(async (link) => {
        const response = await fetch(link.href);
        if (!response.ok) throw new Error("โหลดรูปแบบรายงานไม่สำเร็จ");
        return response.text();
      }),
  );
  const response = await fetch("/api/reports/pdf", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      html: clone.outerHTML,
      css: sheets.join("\n"),
      filename,
      document: documentIdentity,
    }),
  });
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(result.error || "ส่งออก PDF ไม่สำเร็จ");
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename + ".pdf";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
