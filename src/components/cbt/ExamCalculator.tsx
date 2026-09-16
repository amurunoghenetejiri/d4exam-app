/**
 * In-exam calculator (basic + scientific). Student title is always "Calculator".
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Calculator as CalcIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { App as CapApp } from "@capacitor/app";
import { isNativeShell } from "@/native/platform";

export type CalculatorMode = "basic" | "scientific";
type AngleMode = "DEG" | "RAD" | "GRAD";
type Props = { open: boolean; mode: CalculatorMode; onClose: () => void };

function tokenize(expr: string): string[] {
  const s = expr.replace(/\s+/g, "").replace(/×/g, "*").replace(/÷/g, "/").replace(/−/g, "-");
  const tokens: string[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/[0-9.]/.test(c)) {
      let n = c;
      i++;
      while (i < s.length && /[0-9.]/.test(s[i])) n += s[i++];
      tokens.push(n);
      continue;
    }
    if (c === "π") {
      tokens.push("π");
      i++;
      continue;
    }
    if (c === "e" && (i === 0 || !/[0-9.]/.test(s[i - 1]))) {
      tokens.push("e");
      i++;
      continue;
    }
    if ("+-*/%^()".includes(c)) {
      tokens.push(c);
      i++;
      continue;
    }
    const rest = s.slice(i);
    const fns = ["asin", "acos", "atan", "sin", "cos", "tan", "log10", "ln", "sqrt", "cbrt", "abs"];
    let matched = false;
    for (const f of fns) {
      if (rest.startsWith(f)) {
        tokens.push(f);
        i += f.length;
        matched = true;
        break;
      }
    }
    if (!matched) throw new Error("Invalid expression");
  }
  return tokens;
}

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

function evaluate(tokens: string[], angle: AngleMode): number {
  let pos = 0;
  function peek() {
    return tokens[pos];
  }
  function consume() {
    return tokens[pos++];
  }
  function parsePrimary(): number {
    const t = consume();
    if (t === undefined) throw new Error("Unexpected end");
    if (t === "π") return Math.PI;
    if (t === "e") return Math.E;
    if (t === "(") {
      const v = parseExpr();
      if (consume() !== ")") throw new Error("Expected )");
      return v;
    }
    if (t === "-") return -parsePrimary();
    if (t === "+") return parsePrimary();
    const fns: Record<string, (x: number) => number> = {
      sin: (x) => Math.sin(toRad(x, angle)),
      cos: (x) => Math.cos(toRad(x, angle)),
      tan: (x) => Math.tan(toRad(x, angle)),
      asin: (x) => fromRad(Math.asin(x), angle),
      acos: (x) => fromRad(Math.acos(x), angle),
      atan: (x) => fromRad(Math.atan(x), angle),
      log10: (x) => Math.log10(x),
      ln: (x) => Math.log(x),
      sqrt: (x) => Math.sqrt(x),
      cbrt: (x) => Math.cbrt(x),
      abs: (x) => Math.abs(x),
    };
    if (fns[t]) {
      if (peek() === "(") {
        consume();
        const v = parseExpr();
        if (consume() !== ")") throw new Error("Expected )");
        return fns[t](v);
      }
      return fns[t](parsePrimary());
    }
    const n = Number(t);
    if (!Number.isFinite(n)) throw new Error("Invalid number");
    return n;
  }
  function parsePower(): number {
    let left = parsePrimary();
    while (peek() === "^") {
      consume();
      const right = parsePower();
      left = Math.pow(left, right);
    }
    return left;
  }
  function parseTerm(): number {
    let left = parsePower();
    while (peek() === "*" || peek() === "/" || peek() === "%") {
      const op = consume();
      const right = parsePower();
      if (op === "*") left *= right;
      else if (op === "/") left /= right;
      else left %= right;
    }
    return left;
  }
  function parseExpr(): number {
    let left = parseTerm();
    while (peek() === "+" || peek() === "-") {
      const op = consume();
      const right = parseTerm();
      if (op === "+") left += right;
      else left -= right;
    }
    return left;
  }
  const result = parseExpr();
  if (pos < tokens.length) throw new Error("Unexpected token");
  if (!Number.isFinite(result)) throw new Error("Math error");
  return result;
}

function safeEval(expr: string, angle: AngleMode): number {
  const tokens = tokenize(expr);
  if (!tokens.length) return 0;
  return evaluate(tokens, angle);
}

type KeyDef = { label: string; action: string; className?: string; span?: number };

const BASIC: KeyDef[][] = [
  [
    { label: "AC", action: "clear", className: "bg-amber-500 text-white font-bold" },
    { label: "⌫", action: "back", className: "bg-amber-500 text-white font-bold" },
    { label: "%", action: "%" },
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
      { label: shift ? "sin⁻¹" : "sin", action: shift ? "asin(" : "sin(" },
      { label: shift ? "cos⁻¹" : "cos", action: shift ? "acos(" : "cos(" },
      { label: shift ? "tan⁻¹" : "tan", action: shift ? "atan(" : "tan(" },
      { label: "log", action: "log10(" },
      { label: "ln", action: "ln(" },
      { label: "√", action: "sqrt(" },
    ],
    [
      { label: "π", action: "π" },
      { label: "e", action: "e" },
      { label: "x²", action: "^2" },
      { label: "x³", action: "^3" },
      { label: "xʸ", action: "^" },
      { label: "x⁻¹", action: "^-1" },
    ],
    [
      { label: "(", action: "(" },
      { label: ")", action: ")" },
      { label: "%", action: "%" },
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

export function ExamCalculator({ open, mode, onClose }: Props) {
  const [expr, setExpr] = useState("");
  const [display, setDisplay] = useState("0");
  const [shift, setShift] = useState(false);
  const [angle, setAngle] = useState<AngleMode>("DEG");
  const [justEvaluated, setJustEvaluated] = useState(false);

  useEffect(() => {
    if (!open) {
      setExpr("");
      setDisplay("0");
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

  const applyAction = useCallback(
    (action: string) => {
      if (action === "clear") {
        setExpr("");
        setDisplay("0");
        setJustEvaluated(false);
        setShift(false);
        return;
      }
      if (action === "back") {
        setExpr((e) => e.slice(0, -1));
        setDisplay((d) => (d.length > 1 ? d.slice(0, -1) : "0"));
        setJustEvaluated(false);
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
      if (action === "=") {
        try {
          const v = safeEval(expr || display, angle);
          const s = Number.isInteger(v) ? String(v) : String(Number(v.toPrecision(12)));
          setDisplay(s);
          setExpr(s);
          setJustEvaluated(true);
        } catch {
          setDisplay("Error");
          setJustEvaluated(true);
        }
        setShift(false);
        return;
      }
      if (justEvaluated && /^[0-9.πe]/.test(action)) {
        setExpr(action);
        setDisplay(action === "." ? "0." : action);
        setJustEvaluated(false);
        return;
      }
      if (justEvaluated && (action === "+" || action === "−" || action === "×" || action === "÷" || action === "^")) {
        setExpr(display + action);
        setJustEvaluated(false);
        return;
      }
      setExpr((e) => e + action);
      if (/^[0-9.]$/.test(action) || action === "π" || action === "e") {
        setDisplay((d) => (d === "0" && action !== "." ? action : d === "Error" ? action : d + action));
      }
      setJustEvaluated(false);
      if (action.endsWith("(")) setShift(false);
    },
    [angle, justEvaluated, expr, display],
  );

  const rows = useMemo(() => (mode === "scientific" ? sci(shift) : BASIC), [mode, shift]);
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[220] flex items-end justify-center bg-[#020617]/75 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Calculator"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={cn(
          "flex w-full max-h-[min(92dvh,720px)] flex-col overflow-hidden rounded-t-2xl border border-[#1e3a5f] bg-[#0b1b3a] shadow-2xl sm:rounded-2xl",
          mode === "scientific" ? "sm:max-w-lg" : "sm:max-w-sm",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#1e3a5f] px-4 py-3">
          <div className="flex items-center gap-2 text-white">
            <CalcIcon className="h-5 w-5 text-blue-400" />
            <div>
              <p className="text-sm font-bold tracking-tight">Calculator</p>
              {mode === "scientific" && (
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{angle}</p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-full text-slate-300 hover:bg-white/10"
            aria-label="Close calculator"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mx-3 mt-3 rounded-xl border border-[#1e3a5f] bg-[#06101f] px-3 py-3 text-right">
          <p className="min-h-[1.25rem] truncate text-xs text-slate-400">{expr || " "}</p>
          <p className="mt-1 break-all font-mono text-2xl font-bold tabular-nums text-white sm:text-3xl">{display}</p>
        </div>
        <div className="mt-3 flex-1 overflow-y-auto px-3 pb-3">
          <div className="flex flex-col gap-1.5">
            {rows.map((row, ri) => (
              <div
                key={ri}
                className="grid gap-1.5"
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
                      "min-h-[2.75rem] rounded-xl bg-[#12263f] text-sm font-semibold text-slate-100 transition hover:bg-[#1a3354] active:scale-[0.97]",
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
