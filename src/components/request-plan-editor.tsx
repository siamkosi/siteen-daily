"use client";
import type { ReportDetails } from "@/lib/report-details";
import { requestTimeParts } from "@/lib/request-times";

export function RequestPlanEditor({
  value,
  onChange,
}: {
  value: ReportDetails;
  onChange: (d: ReportDetails) => void;
}) {
  function update(
    index: number,
    patch: Partial<ReportDetails["progress"][number]>,
  ) {
    onChange({
      ...value,
      progress: value.progress.map((r, i) =>
        i === index ? { ...r, ...patch } : r,
      ),
    });
  }
  return (
    <section id="report-progress" className="panel structured-editor">
      <div className="form-section-title">
        <span>06</span>
        <h2>แผนงานขออนุมัติ</h2>
        <small className="section-count">{value.progress.length} รายการ</small>
      </div>
      <p>
        ระบุว่าจะทำงานอะไร เวลาเริ่ม และเวลาเสร็จของแต่ละงาน
        หากเวลาเสร็จน้อยกว่าเวลาเริ่ม จะหมายถึงวันถัดไป
      </p>
      {value.progress.map((row, i) => {
        const { start, end } = requestTimeParts(row.time);
        return (
          <div className="entry-row request-plan-entry" key={i}>
            <label>
              รายละเอียดงาน {i + 1}
              <textarea
                aria-label={`รายละเอียดงาน ${i + 1}`}
                required
                rows={3}
                maxLength={1000}
                value={row.description}
                onChange={(e) => update(i, { description: e.target.value })}
              />
            </label>
            <label>
              เวลาเริ่มงาน {i + 1}
              <input
                type="time"
                aria-label={`เวลาเริ่มงาน ${i + 1}`}
                required
                value={start}
                onChange={(e) =>
                  update(i, { time: `${e.target.value}–${end}` })
                }
              />
            </label>
            <label>
              เวลาเสร็จงาน {i + 1}
              <input
                type="time"
                aria-label={`เวลาเสร็จงาน ${i + 1}`}
                required
                value={end}
                onChange={(e) =>
                  update(i, { time: `${start}–${e.target.value}` })
                }
              />
              {start && end && end < start && <small>เสร็จวันถัดไป</small>}
            </label>
            <button
              type="button"
              className="text-button danger"
              aria-label={`ลบงาน ${i + 1}`}
              onClick={() =>
                onChange({
                  ...value,
                  progress: value.progress.filter((_, n) => n !== i),
                })
              }
            >
              ลบ
            </button>
            {row.time && (!start || !end) && (
              <small>เวลาเดิม: {row.time} — กรุณาตรวจเวลาเริ่มและเสร็จ</small>
            )}
          </div>
        );
      })}
      <button
        type="button"
        className="button secondary"
        disabled={value.progress.length >= 60}
        onClick={() =>
          onChange({
            ...value,
            progress: [
              ...value.progress,
              { time: "", description: "", unit: "", quantity: null },
            ],
          })
        }
      >
        เพิ่มรายการงาน
      </button>
    </section>
  );
}
