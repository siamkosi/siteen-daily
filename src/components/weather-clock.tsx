import { weatherOptions } from "@/lib/report-details";

// Each sector represents a recorded hour, rather than the current device time.
export function WeatherClock({ meta }: { meta: Record<string, string> }) {
  const point = (hour: number, radius: number) => {
    const angle = (((hour % 12) * 30 - 90) * Math.PI) / 180;
    return [50 + radius * Math.cos(angle), 50 + radius * Math.sin(angle)];
  };
  return (
    <svg
      className="weather-clock"
      viewBox="0 0 100 108"
      role="img"
      aria-label="นาฬิกาสภาพอากาศรายชั่วโมง 06:00 ถึง 18:00 น."
    >
      <title>สภาพอากาศรายชั่วโมง 06:00–18:00 น.</title>
      {Array.from({ length: 12 }, (_, i) => {
        const hour = i + 6;
        const weather = weatherOptions.find(
          (w) => w.value === meta[`weather_${String(hour).padStart(2, "0")}`],
        );
        const [x1, y1] = point(hour, 35),
          [x2, y2] = point(hour + 1, 35);
        return (
          <path
            key={hour}
            d={`M50 50 L${x1} ${y1} A35 35 0 0 1 ${x2} ${y2} Z`}
            fill={weather?.color ?? "#f3f3f3"}
            stroke="#333"
            strokeWidth="0.6"
          >
            <title>{`${String(hour).padStart(2, "0")}:00–${hour + 1}:00 ${weather?.label ?? "ยังไม่บันทึก"}`}</title>
          </path>
        );
      })}
      {[12, 3, 6, 9].map((h) => {
        const [x, y] = point(h, 43);
        return (
          <text
            key={h}
            x={x}
            y={y + 2}
            textAnchor="middle"
            fontSize="7"
            fill="#111"
          >
            {h}
          </text>
        );
      })}
      <circle cx="50" cy="50" r="1.3" fill="#222" />
      <text x="50" y="102" textAnchor="middle" fontSize="6.5" fill="#333">
        06:00–18:00 น.
      </text>
    </svg>
  );
}
