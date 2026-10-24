"use client";
/* eslint-disable @next/next/no-img-element -- Local logos are embedded in the exported PDF. */
import { Project, Report, thaiDate } from "@/lib/types";
import { emptyDetails } from "@/lib/report-details";
import { requestTimeParts } from "@/lib/request-times";

// Keep long plans within A4 while repeating the project and document header.
function planPages(progress: { description: string; time: string }[]) {
  const rows = progress.flatMap((row, index) => {
    const { start, end } = requestTimeParts(row.time);
    const description = `${index + 1}. ${row.description}${row.time && (!start || !end) ? ` (เวลาเดิม: ${row.time})` : ""}`;
    const lines = description.split("\n").flatMap((line, paragraph) => {
      const chars = Array.from(
        new Intl.Segmenter("th", { granularity: "grapheme" }).segment(line),
        (s) => s.segment,
      );
      const result: string[] = [];
      for (let i = 0; i < chars.length; i += 44)
        result.push(chars.slice(i, i + 44).join(""));
      return (result.length ? result : [""]).map((text, i) =>
        paragraph > 0 && i === 0 ? `\n${text}` : text,
      );
    });
    return lines.map((text, i) => ({
      task: index,
      continuation: i > 0,
      description: text,
      start,
      end: `${end}${start && end && end < start ? " (วันถัดไป)" : ""}`,
    }));
  });
  const pages: { rows: typeof rows; lines: number }[] = [];
  for (let i = 0; i < rows.length; i += 20) {
    const chunk = rows.slice(i, i + 20);
    const grouped: typeof rows = [];
    for (const row of chunk) {
      const last = grouped.at(-1);
      if (last?.task === row.task) last.description += row.description;
      else
        grouped.push({
          ...row,
          description: row.continuation
            ? `${row.task + 1}. (ต่อ) ${row.description}`
            : row.description,
        });
    }
    pages.push({ rows: grouped, lines: chunk.length });
  }
  return pages.length ? pages : [{ rows: [], lines: 0 }];
}

export function RequestPrint({
  report: r,
  project: p,
  workspaceName,
}: {
  report: Report;
  project: Project;
  workspaceName: string;
}) {
  const d = r.report_details?.version === 1 ? r.report_details : emptyDetails();
  const m = d.meta;
  const number =
    m.report_number ||
    `DRQ-${r.report_date.replaceAll("-", "")}-${r.id.slice(0, 6).toUpperCase()}`;
  const pages = planPages(
    d.progress.length ? d.progress : [{ description: r.work_done, time: "" }],
  );
  return (
    <article
      className="print-report dr-document dr-request-document"
      aria-label="Daily Request สำหรับพิมพ์"
    >
      {r.status === "cancelled" && (
        <span className="document-cancelled-watermark">
          ยกเลิกแล้ว / CANCELLED
        </span>
      )}
      {pages.map(({ rows, lines }, page) => (
        <section className="dr-sheet dr-request-sheet" key={page}>
          <header className="dr-header">
            <div
              className={`dr-brand ${m.logo_set === "hampton" ? "dr-logo-brand" : ""}`}
            >
              {m.logo_set === "hampton" ? (
                <>
                  <img
                    src="/report-logos/apollo-asset.jpg"
                    alt="APOLLO ASSET"
                  />
                  <img
                    src="/report-logos/ampersand-ace.jpg"
                    alt="AMPERSAND ACE"
                  />
                  <img
                    src="/report-logos/27-engineering.jpg"
                    alt="27 ENGINEERING"
                  />
                </>
              ) : (
                <div>
                  {workspaceName}
                  <small>SiteEN DAILY</small>
                </div>
              )}
            </div>
            <div className="dr-title">
              <h1>DAILY REQUEST</h1>
              <strong>เอกสารขออนุมัติทำงานประจำวัน</strong>
              <span>ให้ผู้ควบคุมงานลงนามในเอกสารภายนอก</span>
            </div>
            <div className="dr-doc">
              <div>
                <span>เลขที่คำขอ</span>
                <b>{number}</b>
              </div>
              <div>
                <span>รหัสเอกสาร</span>
                <b>{m.doc_code || "DRQ"}</b>
              </div>
              <div>
                <span>แก้ไขครั้งที่</span>
                <b>{m.revision || "0"}</b>
              </div>
            </div>
          </header>
          <div className="dr-project">
            <div>
              <b>ข้อมูลทั่วไป</b>
              <br />
              โครงการ: {p.name}
              <br />
              สถานที่: {p.location || "—"}
            </div>
            <div>
              <b>วันที่ขอทำงาน</b>
              <br />
              {thaiDate(r.report_date)}
              <br />
              ส่วนงาน: {m.discipline || "—"}
            </div>
            <div>
              <b>เอกสาร / ผู้ขอ</b>
              <br />
              {m.reporter || "—"}
              <br />
              {m.reporter_title || "Site Engineer"}
            </div>
          </div>
          <div className="dr-parties">
            <span>เจ้าของโครงการ: {m.owner || p.client || "—"}</span>
            <span>ผู้ควบคุมงาน / ที่ปรึกษา: {m.consultant || "—"}</span>
            <span>ผู้รับจ้าง: {m.contractor || workspaceName}</span>
          </div>
          <h2 className="dr-request-plan-title">
            แผนงานขออนุมัติ{page > 0 ? " (ต่อ)" : ""}
          </h2>
          <table className="dr-table dr-request-table">
            <thead>
              <tr>
                <th>ทำงานอะไร / รายละเอียดงาน</th>
                <th>เวลาเริ่ม</th>
                <th>เวลาเสร็จ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i}>
                  <td>{row.description || "\u00a0"}</td>
                  <td>{row.start}</td>
                  <td>{row.end}</td>
                </tr>
              ))}
              {Array.from({ length: Math.max(0, 12 - lines) }, (_, i) => (
                <tr key={`empty-${i}`} aria-hidden="true">
                  <td>&nbsp;</td>
                  <td />
                  <td />
                </tr>
              ))}
            </tbody>
          </table>
          {page === pages.length - 1 && (
            <div className="dr-signatures dr-request-signatures">
              <div>
                <b>ผู้ขออนุมัติ</b>
                <p>ลงชื่อ ................................................</p>
                <p>
                  ({m.reporter || "........................................"})
                </p>
                <p>{m.reporter_title || "Site Engineer"}</p>
                <p>วันที่ ................................................</p>
              </div>
              <div>
                <b>ผู้ควบคุมงาน / ผู้อนุมัติ (ลงนามภายนอก)</b>
                <p>□ อนุมัติ　 □ ไม่อนุมัติ　 □ ให้แก้ไข</p>
                <p>ลงชื่อ ................................................</p>
                <p>
                  ({m.reviewer || "........................................"})
                </p>
                <p>
                  {m.reviewer_title || "ผู้ควบคุมงาน"}　วันที่
                  ........................
                </p>
              </div>
            </div>
          )}
          <footer className="dr-page-footer">
            <span>
              {number} •{" "}
              {r.status === "cancelled"
                ? "ยกเลิกแล้ว"
                : r.status === "draft"
                  ? "ฉบับร่าง"
                  : "ส่งคำขอแล้ว • รอลงนามภายนอก"}
            </span>
            <span>
              หน้า {page + 1} / {pages.length}
            </span>
          </footer>
        </section>
      ))}
    </article>
  );
}
