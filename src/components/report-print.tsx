"use client";
/* eslint-disable @next/next/no-img-element -- Signed private Storage images are embedded by browser printing. */
import { Photo, Project, Report, thaiDate } from "@/lib/types";
import {
  emptyDetails,
  laborGroups,
  laborTotal,
  manHours,
  rounded,
  weatherOptions,
  workforceTotal,
  workforceHours,
  shiftDetails,
  disciplineOptions,
  selectedDiscipline,
} from "@/lib/report-details";

import { WeatherClock } from "./weather-clock";

type Row = {
  cells: string[];
  group?: boolean;
  material?: boolean;
  cost?: number;
};
function segments(text: string, max: number): string[] {
  const chars = Array.from(
    new Intl.Segmenter("th", { granularity: "grapheme" }).segment(text),
    (s) => s.segment,
  );
  const result: string[] = [];
  for (let i = 0; i < chars.length; i += max)
    result.push(chars.slice(i, i + max).join(""));
  return result.length ? result : [""];
}
function lines(text: string) {
  return text
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}
function pack(rows: Row[], width: number, capacity = 40): Row[][] {
  const pages: Row[][] = [[]];
  let used = 0;
  for (const row of rows) {
    const cost =
      row.cost ?? Math.max(1, Math.ceil(row.cells[0].length / width));
    if (used + cost > capacity && pages.at(-1)!.length) {
      pages.push([]);
      used = 0;
    }
    pages.at(-1)!.push(row);
    used += cost;
  }
  return pages;
}
function ReportTable({
  headers,
  rows,
  emptyRows = 0,
  className = "",
}: {
  headers: string[];
  rows: Row[];
  emptyRows?: number;
  className?: string;
}) {
  return (
    <table className={`dr-table ${className}`}>
      <thead>
        <tr>
          {headers.map((h) => (
            <th key={h}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} className={row.group ? "dr-group" : ""}>
            {row.group ? (
              <td colSpan={headers.length}>{row.cells[0]}</td>
            ) : (
              headers.map((_, n) => <td key={n}>{row.cells[n] ?? ""}</td>)
            )}
          </tr>
        ))}
        {Array.from(
          {
            length: Math.max(
              0,
              emptyRows -
                rows.reduce(
                  (n, r) => n + Math.max(1, Math.ceil(r.cells[0].length / 30)),
                  0,
                ),
            ),
          },
          (_, i) => (
            <tr key={`empty-${i}`} aria-hidden="true">
              {headers.map((_, n) => (
                <td key={n}>&nbsp;</td>
              ))}
            </tr>
          ),
        )}
      </tbody>
    </table>
  );
}
export function ReportPrint({
  report: r,
  project: p,
  workspaceName,
  photos,
  request = false,
  onPhotoError,
}: {
  report: Report;
  project: Project;
  workspaceName: string;
  photos: Photo[];
  request?: boolean;
  onPhotoError?: () => void;
}) {
  const d = r.report_details?.version === 1 ? r.report_details : emptyDetails();
  const m = d.meta;
  const shifts = shiftDetails(m);
  const number =
    m.report_number ||
    `${request ? "DRQ" : "DR"}-${r.report_date.replaceAll("-", "")}-${r.id.slice(0, 6).toUpperCase()}`;
  const labor: Row[] = [];
  for (const [group, title] of Object.entries(laborGroups)) {
    const rows = d.labor.filter((l) => l.group === group);

    labor.push({ cells: [title], group: true });
    if (!rows.length) labor.push({ cells: ["ยังไม่ระบุรายการ", "—", "—"] });
    for (const row of rows)
      labor.push({
        cells: [
          row.label,
          String(row.count),
          String(rounded(row.count * row.hours)),
        ],
      });
    labor.push({
      cells: [
        `รวม${title}`,
        rows.length ? String(laborTotal(rows)) : "—",
        rows.length ? String(manHours(rows)) : "—",
      ],
    });
  }
  if (!d.labor.length)
    labor.push({
      cells: ["แรงงานรวม (ไม่ได้แยกประเภท)", String(r.workers), "—"],
    });
  const equipment: Row[] = [];
  for (const [kind, title] of [
    ["machine", "เครื่องจักร"],
    ["tool", "เครื่องมือ"],
  ] as const) {
    const items = d.equipment.filter((e) => e.kind === kind);

    equipment.push({ cells: [title], group: true });
    if (!items.length)
      equipment.push({ cells: ["ยังไม่ระบุรายการ", "—", "—"] });
    for (const row of items)
      equipment.push({
        cells: [
          row.label,
          String(row.count),
          kind === "tool" && m.tools_count_only === "true"
            ? "—"
            : String(rounded(row.count * row.hours)),
        ],
      });
  }
  if (!d.equipment.length)
    for (const label of lines(r.equipment))
      for (const [i, part] of segments(label, 75).entries())
        equipment.push({ cells: [(i ? "(ต่อ) " : "") + part, "—", "—"] });
  const materials: Row[] = [];
  for (const row of d.material_rows ?? []) {
    const labels = segments(row.label, 24),
      notes = segments(row.notes, 16),
      units = segments(row.unit, 8);
    for (
      let i = 0;
      i < Math.max(labels.length, notes.length, units.length);
      i++
    )
      materials.push({
        material: true,
        cost: 2,
        cells: [
          labels[i] ?? "",
          i ? "" : row.kind === "used" ? "ใช้" : "รับเข้า",
          i || row.quantity === null ? "" : String(row.quantity),
          units[i] ?? "",
          notes[i] ?? "",
        ],
      });
  }
  if (r.materials.trim()) {
    materials.push({
      material: true,
      group: true,
      cost: 1,
      cells: ["ข้อความวัสดุเดิม"],
    });
    for (const part of segments(r.materials, 24))
      materials.push({
        material: true,
        cost: 2,
        cells: [part, "", "", "", ""],
      });
  }
  const progress: Row[] = [];
  if (d.progress.length)
    for (const row of d.progress)
      for (const [i, part] of segments(row.description, 120).entries())
        progress.push({
          cells: [
            (i ? "(ต่อ) " : "") + part,
            i ? "" : row.time,
            i ? "" : row.unit,
            i || row.quantity === null ? "" : String(row.quantity),
          ],
        });
  else
    for (const label of lines(r.work_done))
      for (const [i, part] of segments(label, 120).entries())
        progress.push({ cells: [(i ? "(ต่อ) " : "") + part, "", "", ""] });
  const laborPages = pack(labor, 30),
    equipmentPages = pack(equipment, 28),
    progressPages = pack(
      [...progress, ...materials],
      38,
      materials.length ? 34 : 40,
    );
  const matrixCount = Math.max(
    laborPages.length,
    equipmentPages.length,
    progressPages.length,
  );
  const notes = [
    ...(!request && m.request_reference
      ? [
          {
            title: "Daily Request อ้างอิง",
            text: m.request_number || m.request_reference,
          },
        ]
      : []),
    {
      title: request
        ? "4. ความเสี่ยง / ความปลอดภัยก่อนเริ่มงาน"
        : "4. ปัญหาและอุปสรรค / ความปลอดภัย",
      text: r.issues,
    },
    {
      title: request ? "5. มาตรการป้องกัน / ข้อควรปฏิบัติ" : "5. แนวทางแก้ไข",
      text: m.solution ?? "",
    },
    { title: "หมายเหตุ", text: m.notes ?? "" },
    { title: "แผนงานวันถัดไป", text: r.tomorrow },
    ...(d.equipment.length && r.equipment
      ? [{ title: "รายละเอียดเครื่องมือเพิ่มเติม", text: r.equipment }]
      : []),
  ];
  const notesLength = notes.reduce((n, s) => n + s.text.length, 0);
  const longNotes = notesLength > 420;
  const noteChunks = longNotes
    ? notes
        .filter((n) => n.text.trim())
        .flatMap((n) =>
          segments(n.text, 1000).map((text, i) => ({
            title: n.title + (i ? " (ต่อ)" : ""),
            text,
          })),
        )
    : [];
  const notePages: (typeof noteChunks)[] = [];
  let noteSize = 0;
  for (const note of noteChunks) {
    if (!notePages.length || noteSize + note.text.length + 100 > 1500) {
      notePages.push([]);
      noteSize = 0;
    }
    notePages.at(-1)!.push(note);
    noteSize += note.text.length + 100;
  }
  const photoPages = Array.from(
    { length: Math.ceil(photos.length / 6) },
    (_, i) => photos.slice(i * 6, i * 6 + 6),
  );
  const total = matrixCount + notePages.length + photoPages.length;
  function heading(page: number, subtitle?: string) {
    return (
      <>
        <header className="dr-header">
          {m.logo_set === "hampton" ? (
            <div
              className="dr-brand dr-logo-brand"
              aria-label="โลโก้เจ้าของโครงการ ที่ปรึกษา และผู้รับจ้าง"
            >
              <img
                src="/report-logos/apollo-asset.jpg"
                alt="APOLLO ASSET"
                loading="eager"
              />
              <img
                src="/report-logos/ampersand-ace.jpg"
                alt="AMPERSAND ACE"
                loading="eager"
              />
              <img
                src="/report-logos/27-engineering.jpg"
                alt="27 ENGINEERING"
                loading="eager"
              />
            </div>
          ) : (
            <div className="dr-brand">
              SiteEN <b>DAILY</b>
              <small>{workspaceName}</small>
            </div>
          )}
          <div className="dr-title">
            <span>แบบฟอร์มเอกสาร</span>
            <h1>
              {request ? "เอกสารขออนุมัติทำงานประจำวัน" : "รายงานประจำวัน"}
            </h1>
            <strong>{request ? "(Daily Request)" : "(Daily Report)"}</strong>
            {subtitle && <span>{subtitle}</span>}
          </div>
          <div className="dr-doc">
            <div>
              รหัสเอกสาร <b>{m.doc_code || "DRP"}</b>
            </div>
            <div>
              แก้ไขครั้งที่ <b>{m.revision || "0"}</b>
            </div>
            <div>
              แผ่นที่{" "}
              <b>
                {page} / {total}
              </b>
            </div>
          </div>
        </header>
        <div className="dr-project">
          <div>
            <b>โครงการ :</b> {p.name}
            <div className="dr-discipline">
              <b>ส่วนงาน :</b>
              <span>
                {disciplineOptions.map((value, i) => (
                  <span key={value}>
                    {i > 0 && " / "}
                    <span
                      className={
                        selectedDiscipline(m.discipline) === value
                          ? "dr-discipline-selected"
                          : ""
                      }
                    >
                      {value}
                    </span>
                  </span>
                ))}
                {!!m.discipline &&
                  !disciplineOptions.some(
                    (value) => value === selectedDiscipline(m.discipline),
                  ) && (
                    <span className="dr-discipline-legacy">
                      {" "}
                      (ข้อมูลเดิม: {m.discipline})
                    </span>
                  )}
              </span>
            </div>
            <b>{request ? "ผู้ขออนุมัติ :" : "ผู้รายงาน :"}</b>{" "}
            {m.reporter || "—"}
          </div>
          {request ? (
            <div className="dr-weather-panel" style={{ display: "block" }}>
              <b>แผนงานก่อนเริ่มงาน</b>
              <p>โปรดให้ผู้ควบคุมงานพิจารณาและลงนามภายนอกระบบ</p>
              <p>ไม่ใช่หลักฐานผลการทำงานจริง</p>
            </div>
          ) : (
            <div className="dr-weather-panel">
              <div>
                <b>สัญลักษณ์สภาพอากาศ :</b>
                {weatherOptions.map((weather) => (
                  <span className="dr-weather" key={weather.value}>
                    <i
                      className="weather-swatch"
                      style={{ background: weather.color }}
                      aria-hidden="true"
                    />
                    {weather.label}
                  </span>
                ))}
              </div>
              <WeatherClock meta={m} />
            </div>
          )}
          <div>
            <b>เลขที่ :</b> {number}
            <br />
            <b>วันที่ :</b> {thaiDate(r.report_date)}
            <br />
            <div className="dr-shift-options">
              <b>ช่วงเวลา :</b>
              <div>
                {[
                  {
                    key: "day",
                    label: "กลางวัน",
                    selected: shifts.day,
                    period: shifts.dayPeriod,
                  },
                  {
                    key: "night",
                    label: "กลางคืน",
                    selected: shifts.night,
                    period: shifts.nightPeriod,
                  },
                ].map((shift) => (
                  <div className="dr-shift-row" key={shift.key}>
                    <span
                      className="dr-shift-box"
                      data-selected={String(shift.selected)}
                      role="img"
                      aria-label={`${shift.selected ? "เลือก" : "ไม่ได้เลือก"}${shift.label}`}
                    >
                      {shift.selected ? "✓" : ""}
                    </span>
                    <span>{shift.label}</span>
                    <span>{shift.period}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="dr-parties">
          <span>เจ้าของโครงการ : {m.owner || p.client || "—"}</span>
          <span>ผู้ควบคุมงาน : {m.consultant || "—"}</span>
          <span>ผู้รับจ้าง : {m.contractor || workspaceName}</span>
        </div>
      </>
    );
  }
  function footer(page: number) {
    return (
      <footer className="dr-page-footer">
        <span>
          อ้างอิง: {r.id} •{" "}
          {r.status === "cancelled"
            ? "ยกเลิกแล้ว"
            : r.status === "draft"
              ? "ฉบับร่าง"
              : request
                ? "ส่งคำขอแล้ว • รอลงนามภายนอก"
                : "ส่งรายงานแล้ว"}{" "}
          • เวลาไทย
        </span>
        <span>
          หน้า {page} / {total}
        </span>
      </footer>
    );
  }
  return (
    <article className="print-report dr-document">
      {r.status === "cancelled" && (
        <span className="document-cancelled-watermark">
          ยกเลิกแล้ว / CANCELLED
        </span>
      )}
      {Array.from({ length: matrixCount }, (_, i) => (
        <section className="dr-sheet" key={`matrix-${i}`}>
          {heading(i + 1, i ? "ตารางรายละเอียด (ต่อ)" : undefined)}
          <div
            className={
              Math.max(
                ...[laborPages[i], equipmentPages[i], progressPages[i]].map(
                  (rows) =>
                    (rows ?? []).reduce(
                      (n, row) =>
                        n + Math.max(1, Math.ceil(row.cells[0].length / 30)),
                      0,
                    ),
                ),
              ) > 30
                ? "dr-matrix dr-dense"
                : "dr-matrix"
            }
          >
            <section>
              <h2>1. บุคลากร</h2>
              <ReportTable
                headers={["ตำแหน่ง / ประเภท", "จำนวน (คน)", "คน-ชม."]}
                rows={laborPages[i] ?? []}
                emptyRows={26}
              />
            </section>
            <section>
              <h2>2. เครื่องจักร / เครื่องมือ</h2>
              <ReportTable
                headers={["ประเภท / รายการ", "จำนวน", "เครื่อง-ชม."]}
                rows={equipmentPages[i] ?? []}
                emptyRows={26}
              />
            </section>
            <section>
              <h2>{request ? "3. แผนงานขออนุมัติ" : "3. ความก้าวหน้างาน"}</h2>
              <ReportTable
                headers={["รายละเอียดงาน", "เวลา", "หน่วย", "ปริมาณ"]}
                rows={(progressPages[i] ?? []).filter((row) => !row.material)}
                emptyRows={materials.length ? 0 : 26}
              />
              {(progressPages[i] ?? []).some((row) => row.material) && (
                <>
                  <h3 className="dr-material-title">
                    {request
                      ? "วัสดุที่วางแผนใช้ / รับเข้า"
                      : "วัสดุที่ใช้ / รับเข้าหน้างาน"}
                  </h3>
                  <ReportTable
                    className="dr-material-table"
                    headers={[
                      "รายการวัสดุ",
                      "ประเภท",
                      "จำนวน",
                      "หน่วย",
                      "หมายเหตุ",
                    ]}
                    rows={(progressPages[i] ?? []).filter(
                      (row) => row.material,
                    )}
                  />
                </>
              )}
            </section>
          </div>
          <div className="dr-totals">
            <strong>
              แรงงานรวม {d.labor.length ? workforceTotal(d.labor) : r.workers}{" "}
              คน
            </strong>
            <strong>
              รวมคน-ชั่วโมง{" "}
              {d.labor.length
                ? workforceHours(d.labor) + " คน-ชม."
                : "— (ยังไม่ระบุชั่วโมง)"}
            </strong>
            <span>ไม่รวมพนักงานปฏิบัติการ</span>
          </div>
          {i === matrixCount - 1 && (
            <>
              <div className="dr-notes">
                {longNotes ? (
                  <p>
                    ปัญหา แนวทางแก้ไข หมายเหตุ และรายละเอียดเพิ่มเติม:
                    ดูหน้ารายละเอียดแนบท้าย
                  </p>
                ) : (
                  notes
                    .filter(
                      (n) =>
                        n.text.trim() ||
                        n.title.startsWith("4.") ||
                        n.title.startsWith("5.") ||
                        n.title === "หมายเหตุ",
                    )
                    .map((n) => (
                      <div key={n.title}>
                        <b>{n.title}:</b>
                        <span>{n.text || "—"}</span>
                      </div>
                    ))
                )}
              </div>
              <div className="dr-signatures">
                <div>
                  <b>
                    {request
                      ? "ผู้ขออนุมัติ / วิศวกรสนาม"
                      : "ผู้รายงาน / ผู้ตรวจสอบ"}
                  </b>
                  <p>ลงชื่อ ________________________</p>
                  <p>({m.reporter || "________________________"})</p>
                  <p>ตำแหน่ง {m.reporter_title || "________________"}</p>
                  <p>วันที่ ________________________</p>
                </div>
                <div>
                  <b>
                    {request
                      ? "ผู้ควบคุมงาน / ผู้อนุมัติ"
                      : "ผู้ตรวจรับ / ผู้รับทราบ"}
                  </b>
                  <p>ลงชื่อ ________________________</p>
                  <p>({m.reviewer || "________________________"})</p>
                  <p>ตำแหน่ง {m.reviewer_title || "________________"}</p>
                  <p>วันที่ ________________________</p>
                </div>
                <div>
                  <b>
                    {request
                      ? "ผลพิจารณา (ลงนามภายนอก)"
                      : "การจัดเก็บ / ส่งต่อ"}
                  </b>
                  <p>{request ? "☐ อนุมัติ" : "☐ จัดเก็บที่หน่วยงาน"}</p>
                  <p>
                    {request ? "☐ อนุมัติพร้อมเงื่อนไข" : "☐ ผู้จัดการโครงการ"}
                  </p>
                  <p>
                    {request
                      ? "☐ ไม่อนุมัติ / ให้แก้ไข"
                      : "☐ ผู้ควบคุมงาน / ที่ปรึกษา"}
                  </p>
                  <p>
                    {request
                      ? "เงื่อนไข __________________"
                      : "☐ อื่น ๆ ______________"}
                  </p>
                </div>
              </div>
            </>
          )}
          {footer(i + 1)}
        </section>
      ))}
      {notePages.map((notes, i) => (
        <section className="dr-sheet dr-note-sheet" key={`note-${i}`}>
          {heading(matrixCount + i + 1, "รายละเอียดแนบท้าย")}
          {notes.map((n, j) => (
            <div className="dr-note-block" key={j}>
              <h2>{n.title}</h2>
              <p>{n.text}</p>
            </div>
          ))}
          {footer(matrixCount + i + 1)}
        </section>
      ))}
      {photoPages.map((items, page) => (
        <section className="dr-sheet dr-photo-sheet" key={`photos-${page}`}>
          {heading(matrixCount + notePages.length + page + 1)}
          <h2 className="dr-photo-title">รูปถ่ายความก้าวหน้างาน</h2>
          <div className="dr-photo-grid">
            {Array.from({ length: 6 }, (_, slot) => {
              const p = items[slot];
              return (
                <figure key={slot}>
                  <div className="dr-photo-number">
                    ภาพที่ {page * 6 + slot + 1}
                  </div>
                  <div className="dr-photo-image">
                    {p ? (
                      <img
                        src={p.url}
                        onError={onPhotoError}
                        data-photo-path={
                          p.url && !/^(data:|blob:)/i.test(p.url)
                            ? p.path
                            : undefined
                        }
                        alt={p.caption || `ภาพหน้างาน ${page * 6 + slot + 1}`}
                        loading="eager"
                      />
                    ) : (
                      <span>ไม่มีภาพแนบ</span>
                    )}
                  </div>
                  <figcaption>{p?.caption || "—"}</figcaption>
                </figure>
              );
            })}
          </div>
          {footer(matrixCount + notePages.length + page + 1)}
        </section>
      ))}
    </article>
  );
}
