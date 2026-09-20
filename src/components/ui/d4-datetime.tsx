/**
 * Centered modal date-time picker — large, responsive, middle of screen.
 */
import { useMemo, useState } from "react";
import { Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function parseLocalParts(value: string | null | undefined): Date | null {
  if (!value || !String(value).trim()) return null;
  const d = new Date(value);
  if (!Number.isNaN(d.getTime())) return d;
  const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6] || 0));
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
    <div className="flex flex-col items-center gap-1.5">
      <span className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-12 w-16 rounded-xl border-2 border-slate-200 bg-white text-center text-base font-bold text-slate-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 sm:h-14 sm:w-20 sm:text-lg"
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
    applyParts(
      new Date(
        day.getFullYear(),
        day.getMonth(),
        day.getDate(),
        base.getHours(),
        base.getMinutes(),
        base.getSeconds(),
      ),
    );
  }

  function setTimePart(part: "h" | "m" | "s", n: number) {
    const base = date ?? new Date();
    const next = new Date(base);
    if (part === "h") next.setHours(n);
    if (part === "m") next.setMinutes(n);
    if (part === "s") next.setSeconds(n);
    applyParts(next);
  }

  return (
    <div className="space-y-1.5">
      <Label className="font-semibold text-slate-800">
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </Label>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "flex h-12 w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-left text-sm shadow-sm transition hover:border-slate-300 sm:h-14 sm:text-base",
          !date && "text-slate-400",
          date && "font-semibold text-slate-900",
        )}
      >
        <CalendarIcon className="h-5 w-5 shrink-0 text-slate-500" />
        <span className="min-w-0 flex-1 truncate">{display}</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] w-[min(100vw-1.25rem,26rem)] overflow-y-auto rounded-2xl p-4 sm:max-w-md sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-center text-lg font-extrabold text-slate-900">
              {label}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center">
            <Calendar
              mode="single"
              selected={date ?? undefined}
              onSelect={onPickDay}
              defaultMonth={date ?? new Date()}
              className="rounded-xl border border-slate-100 p-2"
            />
            <div className="mt-4 flex items-end justify-center gap-4 sm:gap-6">
              <Wheel label="Hour" value={date?.getHours() ?? 0} max={24} onChange={(n) => setTimePart("h", n)} />
              <Wheel label="Min" value={date?.getMinutes() ?? 0} max={60} onChange={(n) => setTimePart("m", n)} />
              <Wheel label="Sec" value={date?.getSeconds() ?? 0} max={60} onChange={(n) => setTimePart("s", n)} />
            </div>
            <div className="mt-5 flex w-full gap-2">
              <Button type="button" variant="outline" className="flex-1 font-semibold" onClick={() => applyParts(new Date())}>
                Now
              </Button>
              <Button
                type="button"
                variant="outline"
                className="flex-1 font-semibold"
                onClick={() => {
                  onChange("");
                }}
              >
                Clear
              </Button>
              <Button type="button" className="flex-1 font-semibold" onClick={() => setOpen(false)}>
                Done
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
