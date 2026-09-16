/**
 * Full-screen in-exam calculator (basic + scientific).
 * Student title is always "Calculator" (never shows Basic/Scientific).
 * Behaves like a normal phone calculator: auto-evaluates on operators; = shows result.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Calculator as CalcIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { App as CapApp } from "@capacitor/app";
import { isNativeShell } from "@/native/platform";

export type CalculatorMode = "basic" | "scientific";
type AngleMode = "DEG" | "RAD" | "GRAD";
type Props = { open: boolean; mode: CalculatorMode; onClose: () => void };

function toRad(x: number, angle: AngleMode): number {
  if (angle === "DEG") return (x * Math.PI) / 180;
  if (angle === "GRAD") return (x * Math.PI) / 200;
  return x;
}
function fromRad(x: number, angle: AngleMode): number {
  if (angle === "DEG") return (x * 180) / Math.PI;
  if (angle === "GRAD") return (x * 200) / Math.PI;
  return x;
}

function formatResult(v: number): string {
  if (!Number.isFinite(v)) return "Error";
  if (Object.is(v, -0)) return "0";
  if (Number.isInteger(v) && Math.abs(v) < 1e15) return String(v);
  const s = Number(v.toPrecision(12)).toString();
  return s;
}

function applyBinary(a: number, op: string, b: number): number {
  switch (op) {
    case "+":
      return a + b;
    case "−":
    case "-":
      return a - b;
    case "×":
    case "*":
      return a * b;
    case "÷":
    case "/":
      return b === 0 ? NaN : a / b;
    case "%":
      return a % b;
    case "^":
      return Math.pow(a, b);
    default:
      return b;
  }
}

type KeyDef = { label: string; action: string; className?: string; span?: number };

const BASIC: KeyDef[][] = [
  [
    { label: "AC", action: "clear", className: "bg-amber-500 text-white font-bold" },
    { label: "⌫", action: "back", className: "bg-amber-500 text-white font-bold" },
    { label: "%", action: "percent", className: "bg-slate-600/60 text-white" },
    { label: "÷", action: "÷", className: "bg-slate-600/60 text-white" },
  ],
  [
    { label: "7", action: "7" },
    { label: "8", action: "8" },
    { label: "9", action: "9" },
    { label: "×", action: "×", className: "bg-slate-600/60 text-white" },
  ],
  [
    { label: "4", action: "4" },
    { label: "5", action: "5" },
    { label: "6", action: "6" },
    { label: "−", action: "−", className: "bg-slate-600/60 text-white" },
  ],
  [
    { label: "1", action: "1" },
    { label: "2", action: "2" },
    { label: "3", action: "3" },
    { label: "+", action: "+", className: "bg-slate-600/60 text-white" },
  ],
  [
    { label: "0", action: "0", span: 2 },
    { label: ".", action: "." },
    { label: "=", action: "=", className: "bg-[#2563eb] text-white font-bold" },
  ],
];

function sci(shift: boolean): KeyDef[][] {
  return [
    [
      { label: "SHIFT", action: "shift", className: shift ? "bg-[#2563eb] text-white" : "bg-[#3b82f6] text-white" },
      { label: "DEG", action: "angle", className: "bg-slate-600/70 text-white text-[10px]" },
      { label: "⌫", action: "back", className: "bg-amber-500 text-white font-bold" },
      { label: "AC", action: "clear", className: "bg-amber-500 text-white font-bold" },
    ],
    [
      { label: shift ? "sin⁻¹" : "sin", action: shift ? "asin" : "sin" },
      { label: shift ? "cos⁻¹" : "cos", action: shift ? "acos" : "cos" },
      { label: shift ? "tan⁻¹" : "tan", action: shift ? "atan" : "tan" },
      { label: "log", action: "log10" },
      { label: "ln", action: "ln" },
      { label: "√", action: "sqrt" },
    ],
    [
      { label: "π", action: "π" },
      { label: "e", action: "e" },
      { label: "x²", action: "sq" },
      { label: "x³", action: "cube" },
      { label: "xʸ", action: "^" },
      { label: "x⁻¹", action: "inv" },
    ],
    [
      { label: "(", action: "(" },
      { label: ")", action: ")" },
      { label: "%", action: "percent", className: "bg-slate-600/60 text-white" },
      { label: "÷", action: "÷", className: "bg-slate-600/60 text-white" },
      { label: "×", action: "×", className: "bg-slate-600/60 text-white" },
      { label: "−", action: "−", className: "bg-slate-600/60 text-white" },
    ],
    [
      { label: "7", action: "7" },
      { label: "8", action: "8" },
      { label: "9", action: "9" },
      { label: "4", action: "4" },
      { label: "5", action: "5" },
      { label: "6", action: "6" },
    ],
    [
      { label: "1", action: "1" },
      { label: "2", action: "2" },
      { label: "3", action: "3" },
      { label: "0", action: "0" },
      { label: ".", action: "." },
      { label: "+", action: "+", className: "bg-slate-600/60 text-white" },
    ],
    [{ label: "=", action: "=", className: "bg-[#2563eb] text-white font-bold", span: 6 }],
  ];
}

const OPS = new Set(["+", "−", "-", "×", "*", "÷", "/", "^"]);

export function ExamCalculator({ open, mode, onClose }: Props) {
  const [display, setDisplay] = useState("0");
  const [acc, setAcc] = useState<number | null>(null);
  const [pendingOp, setPendingOp] = useState<string | null>(null);
  const [entering, setEntering] = useState(false);
  const [history, setHistory] = useState("");
  const [shift, setShift] = useState(false);
  const [angle, setAngle] = useState<AngleMode>("DEG");
  const [justEvaluated, setJustEvaluated] = useState(false);

  useEffect(() => {
    if (!open) {
      setDisplay("0");
      setAcc(null);
      setPendingOp(null);
      setEntering(false);
      setHistory("");
      setShift(false);
      setJustEvaluated(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onCustom = () => onClose();
    window.addEventListener("d4-close-calculator", onCustom);
    try {
      (window as unknown as { __d4CloseCalc?: () => void }).__d4CloseCalc = onClose;
    } catch {
      /* ignore */
    }
    let handle: { remove: () => Promise<void> } | null = null;
    let cancelled = false;
    if (isNativeShell()) {
      void (async () => {
        try {
          handle = await CapApp.addListener("backButton", () => {
            onClose();
          });
          if (cancelled) {
            await handle?.remove();
            handle = null;
          }
        } catch {
          /* ignore */
        }
      })();
    }
    return () => {
      cancelled = true;
      window.removeEventListener("d4-close-calculator", onCustom);
      void handle?.remove();
    };
  }, [open, onClose]);

  const currentValue = useCallback((): number => {
    const n = Number(display);
    return Number.isFinite(n) ? n : 0;
  }, [display]);

  const applyUnary = useCallback(
    (fn: (x: number) => number) => {
      try {
        const v = fn(currentValue());
        const s = formatResult(v);
        setDisplay(s);
        setEntering(false);
        setJustEvaluated(true);
        setHistory("");
        setShift(false);
      } catch {
        setDisplay("Error");
        setJustEvaluated(true);
      }
    },
    [currentValue],
  );

  const applyAction = useCallback(
    (action: string) => {
      if (action === "clear") {
        setDisplay("0");
        setAcc(null);
        setPendingOp(null);
        setEntering(false);
        setHistory("");
        setJustEvaluated(false);
        setShift(false);
        return;
      }
      if (action === "back") {
        if (!entering || justEvaluated) {
          setDisplay("0");
          setEntering(false);
          setJustEvaluated(false);
          return;
        }
        setDisplay((d) => {
          if (d.length <= 1 || (d.length === 2 && d.startsWith("-"))) return "0";
          return d.slice(0, -1);
        });
        return;
      }
      if (action === "shift") {
        setShift((s) => !s);
        return;
      }
      if (action === "angle") {
        setAngle((a) => (a === "DEG" ? "RAD" : a === "RAD" ? "GRAD" : "DEG"));
        return;
      }

      if (/^[0-9]$/.test(action)) {
        if (!entering || justEvaluated || display === "Error") {
          setDisplay(action);
          setEntering(true);
          setJustEvaluated(false);
          if (justEvaluated) {
            setAcc(null);
            setPendingOp(null);
            setHistory("");
          }
        } else {
          setDisplay((d) => (d === "0" ? action : d + action));
        }
        return;
      }
      if (action === ".") {
        if (!entering || justEvaluated || display === "Error") {
          setDisplay("0.");
          setEntering(true);
          setJustEvaluated(false);
          if (justEvaluated) {
            setAcc(null);
            setPendingOp(null);
            setHistory("");
          }
        } else if (!display.includes(".")) {
          setDisplay((d) => d + ".");
        }
        return;
      }

      if (action === "π") {
        setDisplay(formatResult(Math.PI));
        setEntering(false);
        setJustEvaluated(true);
        return;
      }
      if (action === "e") {
        setDisplay(formatResult(Math.E));
        setEntering(false);
        setJustEvaluated(true);
        return;
      }

      if (action === "sin") return applyUnary((x) => Math.sin(toRad(x, angle)));
      if (action === "cos") return applyUnary((x) => Math.cos(toRad(x, angle)));
      if (action === "tan") return applyUnary((x) => Math.tan(toRad(x, angle)));
      if (action === "asin") return applyUnary((x) => fromRad(Math.asin(x), angle));
      if (action === "acos") return applyUnary((x) => fromRad(Math.acos(x), angle));
      if (action === "atan") return applyUnary((x) => fromRad(Math.atan(x), angle));
      if (action === "log10") return applyUnary((x) => Math.log10(x));
      if (action === "ln") return applyUnary((x) => Math.log(x));
      if (action === "sqrt") return applyUnary((x) => Math.sqrt(x));
      if (action === "sq") return applyUnary((x) => x * x);
      if (action === "cube") return applyUnary((x) => x * x * x);
      if (action === "inv") return applyUnary((x) => (x === 0 ? NaN : 1 / x));
      if (action === "percent") return applyUnary((x) => x / 100);

      if (action === "=") {
        if (pendingOp != null && acc != null) {
          const result = applyBinary(acc, pendingOp, currentValue());
          const s = formatResult(result);
          setDisplay(s);
          setAcc(null);
          setPendingOp(null);
          setHistory("");
          setEntering(false);
          setJustEvaluated(true);
        } else {
          setJustEvaluated(true);
          setEntering(false);
        }
        setShift(false);
        return;
      }

      if (OPS.has(action)) {
        const val = currentValue();
        if (pendingOp != null && acc != null && entering) {
          const result = applyBinary(acc, pendingOp, val);
          const s = formatResult(result);
          if (s === "Error") {
            setDisplay("Error");
            setAcc(null);
            setPendingOp(null);
            setHistory("");
            setEntering(false);
            setJustEvaluated(true);
            return;
          }
          setDisplay(s);
          setAcc(result);
          setHistory(`${s} ${action}`);
        } else {
          setAcc(val);
          setHistory(`${formatResult(val)} ${action}`);
        }
        setPendingOp(action);
        setEntering(false);
        setJustEvaluated(false);
        setShift(false);
        return;
      }
    },
    [display, entering, justEvaluated, pendingOp, acc, angle, currentValue, applyUnary],
  );

  const rows = useMemo(() => (mode === "scientific" ? sci(shift) : BASIC), [mode, shift]);
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[220] flex h-[100dvh] w-full flex-col bg-[#020617]"
      role="dialog"
      aria-modal="true"
      aria-label="Calculator"
      style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex h-full w-full max-w-lg flex-col self-center sm:max-w-xl">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#1e3a5f] px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-[#2563eb]/20 text-[#60a5fa]">
              <CalcIcon className="h-4.5 w-4.5" />
            </div>
            <div>
              <p className="text-sm font-bold tracking-tight text-white">Calculator</p>
              {mode === "scientific" && (
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{angle}</p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-full text-slate-300 hover:bg-white/10"
            aria-label="Close calculator"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mx-3 mt-3 shrink-0 rounded-xl border border-[#1e3a5f] bg-[#06101f] px-4 py-4 text-right">
          <p className="min-h-[1.25rem] truncate text-xs text-slate-400">{history || " "}</p>
          <p className="mt-1 break-all font-mono text-3xl font-bold tabular-nums text-white sm:text-4xl">
            {display}
          </p>
        </div>

        <div className="mt-3 flex min-h-0 flex-1 flex-col px-3 pb-3">
          <div className="flex flex-1 flex-col gap-1.5">
            {rows.map((row, ri) => (
              <div
                key={ri}
                className="grid flex-1 gap-1.5"
                style={{
                  gridTemplateColumns: `repeat(${row.reduce((a, k) => a + (k.span || 1), 0)}, minmax(0, 1fr))`,
                }}
              >
                {row.map((k) => (
                  <button
                    key={`${ri}-${k.label}-${k.action}`}
                    type="button"
                    onClick={() => applyAction(k.action)}
                    className={cn(
                      "min-h-[2.75rem] rounded-xl bg-[#12263f] text-base font-semibold text-slate-100 transition hover:bg-[#1a3354] active:scale-[0.97]",
                      k.className,
                    )}
                    style={k.span ? { gridColumn: `span ${k.span}` } : undefined}
                  >
                    {k.label === "DEG" ? angle : k.label}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ExamCalculatorFab({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Calculator"
      title="Calculator"
      className={cn(
        "fixed z-[130] grid h-12 w-12 place-items-center rounded-full bg-[#2563eb] text-white shadow-lg shadow-blue-900/40 hover:bg-[#1d4ed8] active:scale-95",
        "left-[max(0.75rem,env(safe-area-inset-left))]",
        "bottom-[max(0.75rem,env(safe-area-inset-bottom))]",
      )}
    >
      <CalcIcon className="h-5 w-5" />
    </button>
  );
}
