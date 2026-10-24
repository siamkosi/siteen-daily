function normalizedTime(value = "") {
  const match = value.trim().match(/^(\d{1,2})[:.](\d{2})(?:\s*น\.?)?$/);
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) return "";
  return `${match[1].padStart(2, "0")}:${match[2]}`;
}

export function requestTimeParts(value = "") {
  const [start, end] = value.split(/[–—-]/);
  return { start: normalizedTime(start), end: normalizedTime(end) };
}

export function validateRequestTimes(rows: { time: string }[]) {
  for (const [index, row] of rows.entries()) {
    const { start, end } = requestTimeParts(row.time);
    if (!start || !end)
      throw new Error(`กรุณาระบุเวลาเริ่มและเวลาเสร็จของงาน ${index + 1}`);
    if (start === end)
      throw new Error(`เวลาเริ่มและเวลาเสร็จของงาน ${index + 1} ต้องต่างกัน`);
  }
}
