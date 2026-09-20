/**
 * D4EXAM-branded date & time picker — day, month, year, hour, minute, second.
 * Value is stored as local datetime string suitable for `new Date(value)`.
 */
import { useMemo } from "react";
import { CalendarClock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function daysInMonth(year: number, month1to12: number) {
  return new Date(year, month1to12, 0).getDate();
}

export function parseLocalParts(value: string | null | undefined): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} | null {
  if (!value || !String(value).trim()) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    // datetime-local style YYYY-MM-DDTHH:mm[:ss]
    const m = String(value).match(
      /^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?/,
    );
    if (!m) return null;
    return {
      year: Number(m[1]),
      month: Number(m[2]),
      day: Number(m[3]),
      hour: Number(m[4]),
      minute: Number(m[5]),
      second: Number(m[6] || 0),
    };
  }
  return {
    year: d.getFullYear(),
    month: d.getMonth() + 1,
    day: d.getDate(),
    hour: d.getHours(),
    minute: d.getMinutes(),
    second: d.getSeconds(),
  };
}

export function toLocalIso(parts: {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}): string {
  const maxDay = daysInMonth(parts.year, parts.month);
  const day = Math.min(parts.day, maxDay);
  return `${parts.year}-${pad(parts.month)}-${pad(day)}T${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)}`;
}

function SelectBox({
  label,
  value,
  options,
  onChange,
  wide,
}: {
  label: string;
  value: number | "";
  options: { value: number; label: string }[];
  onChange: (n: number) => void;
  wide?: boolean;
}) {
  return (
    <label className={cn("flex min-w-0 flex-col gap-1", wide && "sm:col-span-2")}>
      <span className="text-[10px] font-bold uppercase tracking-wider text-sky-200/90">{label}</span>
      <select
        value={value === "" ? "" : value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={cn(
          "h-10 w-full rounded-lg border border-white/15 bg-[#0b1b3a] px-2 text-sm font-semibold text-white shadow-inner",
          "outline-none focus:border-sky-400/60 focus:ring-2 focus:ring-sky-400/30",
          "appearance-none",
        )}
      >
        <option value="" disabled className="bg-[#0b1b3a] text-slate-400">
          —
        </option>
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-[#0b1b3a] text-white">
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function D4DateTimeField({
  label,
  hint,
  value,
  onChange,
  required,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (next: string) => void;
  required?: boolean;
}) {
  const parts = parseLocalParts(value);
  const now = new Date();
  const year = parts?.year ?? now.getFullYear();
  const month = parts?.month ?? now.getMonth() + 1;
  const day = parts?.day ?? now.getDate();
  const hour = parts?.hour ?? 0;
  const minute = parts?.minute ?? 0;
  const second = parts?.second ?? 0;

  const years = useMemo(() => {
    const y0 = now.getFullYear() - 1;
    return Array.from({ length: 6 }, (_, i) => y0 + i);
  }, [now.getFullYear()]);

  const dayMax = daysInMonth(year, month);

  function emit(patch: Partial<{ year: number; month: number; day: number; hour: number; minute: number; second: number }>) {
    const next = {
      year: patch.year ?? year,
      month: patch.month ?? month,
      day: patch.day ?? day,
      hour: patch.hour ?? hour,
      minute: patch.minute ?? minute,
      second: patch.second ?? second,
    };
    next.day = Math.min(next.day, daysInMonth(next.year, next.month));
    onChange(toLocalIso(next));
  }

  const preview = parts
    ? new Date(toLocalIso({ year, month, day, hour, minute, second })).toLocaleString(undefined, {
        weekday: "short",
        day: "2-digit",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : "Not set";

  return (
    <div className="space-y-2">
      <Label className="font-semibold text-slate-800">
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </Label>
      {hint ? <p className="text-xs text-slate-500">{hint}</p> : null}
      <div className="overflow-hidden rounded-2xl border border-[#0b1b3a]/30 bg-gradient-to-br from-[#0b1b3a] via-[#122548] to-[#0b1b3a] p-3 shadow-md shadow-slate-900/10 sm:p-4">
        <div className="mb-3 flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-white/10 text-sky-200">
            <CalendarClock className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-sky-300/90">D4EXAM schedule</p>
            <p className="truncate text-sm font-semibold text-white">{preview}</p>
          </div>
          {value ? (
            <button
              type="button"
              className="ml-auto shrink-0 rounded-lg px-2 py-1 text-[11px] font-semibold text-sky-200/90 hover:bg-white/10"
              onClick={() => onChange("")}
            >
              Clear
            </button>
          ) : null}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <SelectBox
            label="Day"
            value={parts ? day : ""}
            onChange={(n) => emit({ day: n })}
            options={Array.from({ length: dayMax }, (_, i) => ({
              value: i + 1,
              label: pad(i + 1),
            }))}
          />
          <SelectBox
            label="Month"
            value={parts ? month : ""}
            onChange={(n) => emit({ month: n })}
            options={MONTHS.map((m, i) => ({ value: i + 1, label: m }))}
            wide
          />
          <SelectBox
            label="Year"
            value={parts ? year : ""}
            onChange={(n) => emit({ year: n })}
            options={years.map((y) => ({ value: y, label: String(y) }))}
          />
          <SelectBox
            label="Hour"
            value={parts ? hour : ""}
            onChange={(n) => emit({ hour: n })}
            options={Array.from({ length: 24 }, (_, i) => ({
              value: i,
              label: pad(i),
            }))}
          />
          <SelectBox
            label="Min"
            value={parts ? minute : ""}
            onChange={(n) => emit({ minute: n })}
            options={Array.from({ length: 60 }, (_, i) => ({
              value: i,
              label: pad(i),
            }))}
          />
          <SelectBox
            label="Sec"
            value={parts ? second : ""}
            onChange={(n) => emit({ second: n })}
            options={Array.from({ length: 60 }, (_, i) => ({
              value: i,
              label: pad(i),
            }))}
          />
        </div>
      </div>
    </div>
  );
}
