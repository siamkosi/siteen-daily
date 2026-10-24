"use client";
import {
  ReportDetails,
  MaterialRow,
  LaborRow,
  EquipmentRow,
  ProgressRow,
  laborGroups,
  workforceTotal,
  workforceHours,
  rounded,
  weatherOptions,
  shiftDetails,
  disciplineOptions,
  selectedDiscipline,
} from "@/lib/report-details";

import type { Report } from "@/lib/types";
import { WeatherClock } from "./weather-clock";
import { RequestPlanEditor } from "./request-plan-editor";

export function ReportDetailsEditor({
  value: d,
  onChange,
  legacyWorkers,
  initial,
  request = false,
}: {
  value: ReportDetails;
  onChange: (d: ReportDetails) => void;
  legacyWorkers?: number;
  initial?: Report;
  request?: boolean;
}) {
  const shifts = shiftDetails({ ...d.meta, shift: d.meta.shift ?? "day" });
  function meta(k: string, v: string) {
    onChange({ ...d, meta: { ...d.meta, [k]: v } });
  }
  function labor(i: number, patch: Partial<LaborRow>) {
    onChange({
      ...d,
      labor: d.labor.map((r, n) => (n === i ? { ...r, ...patch } : r)),
    });
  }
  function equipment(i: number, patch: Partial<EquipmentRow>) {
    onChange({
      ...d,
      equipment: d.equipment.map((r, n) => (n === i ? { ...r, ...patch } : r)),
    });
  }
  function material(i: number, patch: Partial<MaterialRow>) {
    onChange({
      ...d,
      material_rows: (d.material_rows ?? []).map((r, n) =>
        n === i ? { ...r, ...patch } : r,
      ),
    });
  }
  function progress(i: number, patch: Partial<ProgressRow>) {
    onChange({
      ...d,
      progress: d.progress.map((r, n) => (n === i ? { ...r, ...patch } : r)),
    });
  }
  return (
    <>
      <section id="report-document" className="panel">
        <div className="form-section-title">
          <span>02</span>
          <h2>{request ? "เอกสาร / ผู้ขอ" : "หัวเอกสารและผู้รับผิดชอบ"}</h2>
        </div>
        <div className="form-grid document-grid">
          {[
            ["report_number", request ? "เลขที่คำขอ" : "เลขที่รายงาน"],
            ["discipline", "ส่วนงาน"],
            ["doc_code", "รหัสเอกสาร"],
            ["revision", "แก้ไขครั้งที่"],
            ["owner", "เจ้าของโครงการ"],
            ["consultant", "ผู้ควบคุมงาน / ที่ปรึกษา"],
            ["contractor", "ผู้รับจ้าง"],
            ["reporter", request ? "ชื่อผู้ขออนุมัติ" : "ชื่อผู้รายงาน"],
            [
              "reporter_title",
              request ? "ตำแหน่งผู้ขออนุมัติ" : "ตำแหน่งผู้รายงาน",
            ],
            [
              "reviewer",
              request
                ? "ชื่อผู้ควบคุมงาน / ผู้อนุมัติ"
                : "ชื่อผู้ตรวจสอบ / ผู้ตรวจรับ",
            ],
            [
              "reviewer_title",
              request ? "ตำแหน่งผู้อนุมัติ" : "ตำแหน่งผู้ตรวจสอบ",
            ],
          ].map(([k, label]) => (
            <label key={k}>
              {label}
              {k === "discipline" ? (
                <select
                  aria-label={label}
                  value={selectedDiscipline(d.meta.discipline)}
                  onChange={(e) => meta(k, e.target.value)}
                >
                  <option value="">เลือกส่วนงาน</option>
                  {disciplineOptions.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                  {!!d.meta.discipline &&
                    !disciplineOptions.some(
                      (value) =>
                        value === selectedDiscipline(d.meta.discipline),
                    ) && (
                      <option value={d.meta.discipline}>
                        {d.meta.discipline} (ข้อมูลเดิม)
                      </option>
                    )}
                </select>
              ) : (
                <input
                  value={d.meta[k] ?? ""}
                  maxLength={300}
                  onChange={(e) => meta(k, e.target.value)}
                />
              )}
            </label>
          ))}
          {!request && (
            <fieldset className="shift-editor">
              <legend>ช่วงเวลาทำงาน (เลือกได้ทั้งสองช่วง)</legend>
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
                <div className="shift-editor-row" key={shift.key}>
                  <label>
                    <input
                      type="checkbox"
                      checked={shift.selected}
                      onChange={(e) => {
                        const day =
                          shift.key === "day" ? e.target.checked : shifts.day;
                        const night =
                          shift.key === "night"
                            ? e.target.checked
                            : shifts.night;
                        onChange({
                          ...d,
                          meta: {
                            ...d.meta,
                            shift:
                              day && night
                                ? "both"
                                : day
                                  ? "day"
                                  : night
                                    ? "night"
                                    : "",
                            day_period: shifts.dayPeriod,
                            night_period: shifts.nightPeriod,
                          },
                        });
                      }}
                    />
                    {shift.label}
                  </label>
                  <label>
                    ช่วงเวลา{shift.label}
                    <input
                      value={shift.period}
                      maxLength={300}
                      required={shift.selected}
                      onChange={(e) =>
                        meta(`${shift.key}_period`, e.target.value)
                      }
                    />
                  </label>
                </div>
              ))}
            </fieldset>
          )}
        </div>
        <label className="report-logo-option">
          <input
            type="checkbox"
            checked={d.meta.logo_set === "hampton"}
            onChange={(e) =>
              meta("logo_set", e.target.checked ? "hampton" : "")
            }
          />
          ใช้โลโก้ APOLLO ASSET / AMPERSAND ACE / 27 ENGINEERING ในหัวรายงาน
        </label>
        {!request && (
          <div className="weather-editor">
            <div>
              <h3>นาฬิกาสภาพอากาศรายชั่วโมง</h3>
              <p>
                กรอกสภาพอากาศที่นี่เพียงจุดเดียว แต่ละช่วง 06:00–18:00 น.
                ตามจริง
              </p>
              <div className="weather-hour-grid">
                {Array.from({ length: 12 }, (_, i) => {
                  const hour = i + 6,
                    key = `weather_${String(hour).padStart(2, "0")}`;
                  return (
                    <label key={key}>
                      {String(hour).padStart(2, "0")}:00–
                      {String(hour + 1).padStart(2, "0")}:00
                      <select
                        value={d.meta[key] ?? ""}
                        onChange={(e) => meta(key, e.target.value)}
                      >
                        <option value="">ยังไม่บันทึก</option>
                        {weatherOptions.map((w) => (
                          <option key={w.value} value={w.value}>
                            {w.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  );
                })}
              </div>
            </div>
            <WeatherClock meta={d.meta} />
          </div>
        )}
      </section>
      {request ? (
        <RequestPlanEditor value={d} onChange={onChange} />
      ) : (
        <>
          <section id="report-labor" className="panel structured-editor">
            <div className="form-section-title">
              <span>03</span>
              <h2>บุคลากรและชั่วโมงทำงาน</h2>
              <small className="section-count">{d.labor.length} รายการ</small>
            </div>
            <p>
              จำนวน × ชั่วโมงต่อคน = คน-ชั่วโมง เมื่อเพิ่มรายการรายประเภท
              ระบบรวมเฉพาะพนักงานรายวันและผู้รับเหมาเป็นยอดแรงงานรวมอัตโนมัติ
            </p>
            {d.labor.map((r, i) => (
              <div className="entry-row labor-entry" key={i}>
                <label>
                  ประเภทบุคลากร {i + 1}
                  <select
                    value={r.group}
                    onChange={(e) =>
                      labor(i, { group: e.target.value as LaborRow["group"] })
                    }
                  >
                    {Object.entries(laborGroups).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  รายการบุคลากร {i + 1}
                  <input
                    required
                    maxLength={200}
                    value={r.label}
                    onChange={(e) => labor(i, { label: e.target.value })}
                  />
                </label>
                <label>
                  จำนวนคน {i + 1}
                  <input
                    type="number"
                    min={0}
                    max={10000}
                    step={1}
                    required
                    value={r.count}
                    onChange={(e) =>
                      labor(i, { count: Number(e.target.value) })
                    }
                  />
                </label>
                <label>
                  ชั่วโมงต่อคน {i + 1}
                  <input
                    type="number"
                    min={0}
                    max={24}
                    step="0.25"
                    required
                    value={r.hours}
                    onChange={(e) =>
                      labor(i, { hours: Number(e.target.value) })
                    }
                  />
                </label>
                <span className="entry-total">
                  {rounded(r.count * r.hours)} คน-ชม.
                </span>
                <button
                  type="button"
                  aria-label={`ลบรายการบุคลากร ${i + 1}`}
                  className="text-button danger"
                  onClick={() =>
                    onChange({ ...d, labor: d.labor.filter((_, n) => n !== i) })
                  }
                >
                  ลบ
                </button>
              </div>
            ))}
            {!d.labor.length && !!legacyWorkers && (
              <p>
                จำนวนแรงงานเดิม {legacyWorkers} คน
                ยังไม่มีรายการบุคลากรแยกประเภท เมื่อเพิ่มรายการ
                ระบบจะใช้ยอดจากตารางนี้
              </p>
            )}
            <div className="category-actions">
              {(["daily", "subcontract"] as const).map((group) => (
                <button
                  key={group}
                  type="button"
                  className="button secondary"
                  disabled={d.labor.length >= 50}
                  onClick={() =>
                    onChange({
                      ...d,
                      labor: [
                        ...d.labor,
                        { group, label: "", count: 0, hours: 8 },
                      ],
                    })
                  }
                >
                  เพิ่ม{laborGroups[group]}
                </button>
              ))}
            </div>
            <div className="structured-actions">
              <button
                type="button"
                className="button secondary"
                disabled={d.labor.length >= 50}
                onClick={() =>
                  onChange({
                    ...d,
                    labor: [
                      ...d.labor,
                      { group: "staff", label: "", count: 0, hours: 8 },
                    ],
                  })
                }
              >
                เพิ่มบุคลากร
              </button>
              <strong>
                แรงงานรวม{" "}
                {d.labor.length
                  ? workforceTotal(d.labor)
                  : (legacyWorkers ?? 0)}{" "}
                คน / {d.labor.length ? workforceHours(d.labor) : "—"} คน-ชั่วโมง
                (ไม่รวมพนักงานปฏิบัติการ)
              </strong>
            </div>
          </section>
          <section id="report-equipment" className="panel structured-editor">
            <div className="form-section-title">
              <span>04</span>
              <h2>เครื่องจักรและเครื่องมือรายรายการ</h2>
              <small className="section-count">
                {d.equipment.length} รายการ
              </small>
            </div>
            <label className="count-only-option">
              <input
                type="checkbox"
                checked={d.meta.tools_count_only === "true"}
                onChange={(e) =>
                  meta("tools_count_only", String(e.target.checked))
                }
              />
              เครื่องมือ: บันทึกเฉพาะจำนวน ไม่ระบุชั่วโมงใช้งาน
            </label>
            {d.equipment.map((r, i) => (
              <div className="entry-row equipment-entry" key={i}>
                <label>
                  ประเภทเครื่องจักร {i + 1}
                  <select
                    value={r.kind}
                    onChange={(e) =>
                      equipment(i, {
                        kind: e.target.value as EquipmentRow["kind"],
                      })
                    }
                  >
                    <option value="machine">เครื่องจักร</option>
                    <option value="tool">เครื่องมือ</option>
                  </select>
                </label>
                <label>
                  รายการเครื่องจักร {i + 1}
                  <input
                    required
                    maxLength={200}
                    value={r.label}
                    onChange={(e) => equipment(i, { label: e.target.value })}
                  />
                </label>
                <label>
                  จำนวนเครื่อง {i + 1}
                  <input
                    type="number"
                    min={0}
                    max={10000}
                    step={1}
                    required
                    value={r.count}
                    onChange={(e) =>
                      equipment(i, { count: Number(e.target.value) })
                    }
                  />
                </label>
                <label>
                  ชั่วโมงต่อเครื่อง {i + 1}
                  <input
                    type="number"
                    min={0}
                    max={24}
                    step="0.25"
                    required
                    value={r.hours}
                    disabled={
                      r.kind === "tool" && d.meta.tools_count_only === "true"
                    }
                    onChange={(e) =>
                      equipment(i, { hours: Number(e.target.value) })
                    }
                  />
                </label>
                <span className="entry-total">
                  {r.kind === "tool" && d.meta.tools_count_only === "true"
                    ? "—"
                    : `${rounded(r.count * r.hours)} เครื่อง-ชม.`}
                </span>
                <button
                  type="button"
                  className="text-button danger"
                  aria-label={`ลบเครื่องจักร ${i + 1}`}
                  onClick={() =>
                    onChange({
                      ...d,
                      equipment: d.equipment.filter((_, n) => n !== i),
                    })
                  }
                >
                  ลบ
                </button>
              </div>
            ))}
            <button
              type="button"
              className="button secondary"
              disabled={d.equipment.length >= 40}
              onClick={() =>
                onChange({
                  ...d,
                  equipment: [
                    ...d.equipment,
                    { kind: "machine", label: "", count: 0, hours: 8 },
                  ],
                })
              }
            >
              เพิ่มเครื่องจักร / เครื่องมือ
            </button>
            <button
              type="button"
              className="button secondary"
              disabled={d.equipment.length >= 40}
              onClick={() =>
                onChange({
                  ...d,
                  equipment: [
                    ...d.equipment,
                    { kind: "tool", label: "", count: 0, hours: 0 },
                  ],
                })
              }
            >
              เพิ่มเครื่องมือ
            </button>
          </section>
          <section id="report-materials" className="panel structured-editor">
            <div className="form-section-title">
              <span>05</span>
              <h2>วัสดุที่ใช้ / รับเข้าหน้างาน</h2>
              <small className="section-count">
                {d.material_rows?.length ?? 0} รายการ
              </small>
            </div>
            <p>
              แสดงในคอลัมน์กลางของรายงาน ใต้เครื่องจักรและเครื่องมือ
              แยกจากเครื่อง-ชั่วโมง
            </p>
            {!d.material_rows?.length && (
              <div className="report-empty-materials">
                <strong>ยังไม่มีรายการวัสดุ</strong>
                <span>เพิ่มเฉพาะวัสดุที่ใช้หรือรับเข้าหน้างานในวันนี้</span>
              </div>
            )}
            {(d.material_rows ?? []).map((r, i) => (
              <div className="entry-row material-entry" key={i}>
                <label>
                  รายการวัสดุ {i + 1}
                  <input
                    required
                    maxLength={200}
                    value={r.label}
                    onChange={(e) => material(i, { label: e.target.value })}
                  />
                </label>
                <label>
                  ประเภทวัสดุ {i + 1}
                  <select
                    value={r.kind}
                    onChange={(e) =>
                      material(i, {
                        kind: e.target.value as MaterialRow["kind"],
                      })
                    }
                  >
                    <option value="used">ใช้</option>
                    <option value="received">รับเข้า</option>
                  </select>
                </label>
                <label>
                  จำนวนวัสดุ {i + 1}
                  <input
                    type="number"
                    min={0}
                    max={1e9}
                    step="any"
                    value={r.quantity ?? ""}
                    onChange={(e) =>
                      material(i, {
                        quantity:
                          e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                  />
                </label>
                <label>
                  หน่วยวัสดุ {i + 1}
                  <input
                    required
                    maxLength={30}
                    value={r.unit}
                    onChange={(e) => material(i, { unit: e.target.value })}
                  />
                </label>
                <label>
                  หมายเหตุวัสดุ {i + 1}
                  <input
                    maxLength={300}
                    value={r.notes}
                    onChange={(e) => material(i, { notes: e.target.value })}
                  />
                </label>
                <button
                  type="button"
                  className="text-button danger"
                  aria-label={`ลบวัสดุ ${i + 1}`}
                  onClick={() =>
                    onChange({
                      ...d,
                      material_rows: (d.material_rows ?? []).filter(
                        (_, n) => n !== i,
                      ),
                    })
                  }
                >
                  ลบ
                </button>
              </div>
            ))}
            <button
              type="button"
              className="button secondary"
              disabled={(d.material_rows?.length ?? 0) >= 40}
              onClick={() =>
                onChange({
                  ...d,
                  material_rows: [
                    ...(d.material_rows ?? []),
                    {
                      label: "",
                      kind: "received",
                      quantity: null,
                      unit: "",
                      notes: "",
                    },
                  ],
                })
              }
            >
              เพิ่มวัสดุ
            </button>
            {!!initial?.materials && (
              <label className="legacy-field">
                ข้อความวัสดุเดิม (เก็บแยกจากตาราง ไม่เดาจำนวนและหน่วย)
                <textarea
                  aria-label="ข้อความวัสดุเดิม"
                  name="materials"
                  maxLength={10000}
                  defaultValue={initial.materials}
                />
              </label>
            )}
          </section>
          <section id="report-progress" className="panel structured-editor">
            <div className="form-section-title">
              <span>06</span>
              <h2>
                {request
                  ? "แผนงานขออนุมัติรายรายการ"
                  : "ความก้าวหน้างานรายรายการ"}
              </h2>
              <small className="section-count">
                {d.progress.length} รายการ
              </small>
            </div>
            {d.progress.map((r, i) => (
              <div className="entry-row progress-entry" key={i}>
                <label>
                  เวลางาน {i + 1}
                  <input
                    maxLength={50}
                    value={r.time}
                    onChange={(e) => progress(i, { time: e.target.value })}
                  />
                </label>
                <label>
                  รายละเอียดงาน {i + 1}
                  <textarea
                    aria-label={`รายละเอียดงาน ${i + 1}`}
                    required
                    maxLength={1000}
                    rows={2}
                    value={r.description}
                    onChange={(e) =>
                      progress(i, { description: e.target.value })
                    }
                  />
                </label>
                <label>
                  หน่วยงาน {i + 1}
                  <input
                    maxLength={30}
                    value={r.unit}
                    onChange={(e) => progress(i, { unit: e.target.value })}
                  />
                </label>
                <label>
                  ปริมาณงาน {i + 1}
                  <input
                    type="number"
                    min={0}
                    max={1e9}
                    step="any"
                    value={r.quantity ?? ""}
                    onChange={(e) =>
                      progress(i, {
                        quantity:
                          e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                  />
                </label>
                <button
                  type="button"
                  className="text-button danger"
                  aria-label={`ลบงาน ${i + 1}`}
                  onClick={() =>
                    onChange({
                      ...d,
                      progress: d.progress.filter((_, n) => n !== i),
                    })
                  }
                >
                  ลบ
                </button>
              </div>
            ))}
            <button
              type="button"
              className="button secondary"
              disabled={d.progress.length >= 60}
              onClick={() =>
                onChange({
                  ...d,
                  progress: [
                    ...d.progress,
                    { time: "", description: "", unit: "", quantity: null },
                  ],
                })
              }
            >
              เพิ่มรายการงาน
            </button>
          </section>
          <section id="report-issues" className="panel structured-editor">
            <div className="form-section-title">
              <span>07</span>
              <h2>
                {request
                  ? "ความเสี่ยง มาตรการป้องกัน และหมายเหตุ"
                  : "ปัญหา แนวทางแก้ไข และหมายเหตุ"}
              </h2>
            </div>
            <div className="form-grid">
              <label>
                {request
                  ? "ความเสี่ยง / ข้อควรระวังก่อนเริ่มงาน"
                  : "ปัญหา / อุปสรรค / ความปลอดภัย"}
                <textarea
                  aria-label={
                    request
                      ? "ความเสี่ยง / ข้อควรระวังก่อนเริ่มงาน"
                      : "ปัญหา / อุปสรรค / ความปลอดภัย"
                  }
                  name="issues"
                  maxLength={10000}
                  rows={3}
                  defaultValue={initial?.issues}
                />
              </label>
              <label>
                {request ? "มาตรการป้องกันก่อนเริ่มงาน" : "แนวทางแก้ไข"}
                <textarea
                  maxLength={10000}
                  rows={3}
                  value={d.meta.solution ?? ""}
                  onChange={(e) => meta("solution", e.target.value)}
                />
              </label>
              <label>
                หมายเหตุ
                <textarea
                  maxLength={10000}
                  rows={3}
                  value={d.meta.notes ?? ""}
                  onChange={(e) => meta("notes", e.target.value)}
                />
              </label>
            </div>
            {(!!initial?.equipment || !!initial?.tomorrow) && (
              <details className="legacy-field">
                <summary>ข้อมูลเพิ่มเติมจากรายงานเดิม</summary>
                {!!initial.equipment && (
                  <label>
                    รายละเอียดเครื่องมือเดิม
                    <textarea
                      aria-label="รายละเอียดเครื่องมือเดิม"
                      name="equipment"
                      maxLength={10000}
                      defaultValue={initial.equipment}
                    />
                  </label>
                )}
                {!!initial.tomorrow && (
                  <label>
                    แผนงานวันถัดไปเดิม
                    <textarea
                      aria-label="แผนงานวันถัดไปเดิม"
                      name="tomorrow"
                      maxLength={10000}
                      defaultValue={initial.tomorrow}
                    />
                  </label>
                )}
              </details>
            )}
          </section>
        </>
      )}
    </>
  );
}
