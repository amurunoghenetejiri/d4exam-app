/**
 * Compact date-time popup: tap the field → calendar + hour/min/sec wheels.
 */
import { useMemo, useState } from "react";
import { Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function parseLocalParts(value: string | null | undefined): Date | null {
  if (!value || !String(value).trim()) return null;
  const d = new Date(value);
  if (!Number.isNaN(d.getTime())) return d;
  const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return null;
  return new Date(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    Number(m[4]),
    Number(m[5]),
    Number(m[6] || 0),
  );
}

export function toLocalIso(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function Wheel({
  label,
  value,
  max,
  onChange,
}: {
  label: string;
  value: number;
  max: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-9 w-14 rounded-md border border-slate-200 bg-white text-center text-sm font-semibold text-slate-900 outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
      >
        {Array.from({ length: max }, (_, i) => (
          <option key={i} value={i}>
            {pad(i)}
          </option>
        ))}
      </select>
    </div>
  );
}

export function D4DateTimeField({
  label,
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
  const [open, setOpen] = useState(false);
  const date = parseLocalParts(value);
  const display = useMemo(() => {
    if (!date) return "Tap to set date & time";
    return date.toLocaleString(undefined, {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }, [date]);

  function applyParts(nextDate: Date) {
    onChange(toLocalIso(nextDate));
  }

  function onPickDay(day: Date | undefined) {
    if (!day) return;
    const base = date ?? new Date();
    const next = new Date(
      day.getFullYear(),
      day.getMonth(),
      day.getDate(),
      base.getHours(),
      base.getMinutes(),
      base.getSeconds(),
    );
    applyParts(next);
  }

  function setTimePart(part: "h" | "m" | "s", n: number) {
    const base = date ?? new Date();
    const next = new Date(base);
    if (part === "h") next.setHours(n);
    if (part === "m") next.setMinutes(n);
    if (part === "s") next.setSeconds(n);
    applyParts(next);
  }

  function useNow() {
    applyParts(new Date());
  }

  return (
    <div className="space-y-1.5">
      <Label className="font-semibold text-slate-800">
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex h-11 w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-left text-sm shadow-sm transition hover:border-slate-300",
              !date && "text-slate-400",
              date && "font-medium text-slate-900",
            )}
          >
            <CalendarIcon className="h-4 w-4 shrink-0 text-slate-500" />
            <span className="min-w-0 flex-1 truncate">{display}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto max-w-[min(100vw-1.5rem,22rem)] p-3" align="start">
          <Calendar
            mode="single"
            selected={date ?? undefined}
            onSelect={onPickDay}
            defaultMonth={date ?? new Date()}
            className="rounded-lg"
          />
          <div className="mt-3 flex items-end justify-center gap-3 border-t border-slate-100 pt-3">
            <Wheel label="Hour" value={date?.getHours() ?? 0} max={24} onChange={(n) => setTimePart("h", n)} />
            <Wheel label="Min" value={date?.getMinutes() ?? 0} max={60} onChange={(n) => setTimePart("m", n)} />
            <Wheel label="Sec" value={date?.getSeconds() ?? 0} max={60} onChange={(n) => setTimePart("s", n)} />
          </div>
          <div className="mt-3 flex gap-2">
            <Button type="button" variant="outline" size="sm" className="flex-1" onClick={useNow}>
              Now
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
            >
              Clear
            </Button>
            <Button type="button" size="sm" className="flex-1 font-semibold" onClick={() => setOpen(false)}>
              Done
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
