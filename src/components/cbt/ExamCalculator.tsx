/**
 * Full-screen in-exam calculator (basic + scientific).
 * Student title is always "Calculator" (never Basic/Scientific).
 * Expression at top, live auto-result below. Safe parser (no eval).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Calculator as CalcIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { App as CapApp } from "@capacitor/app";
import { isNativeShell } from "@/native/platform";

export type CalculatorMode = "basic" | "scientific";
type AngleMode = "DEG" | "RAD" | "GRAD";
type Props = { open: boolean; mode: CalculatorMode; onClose: () => void };

type KeyDef = { label: string; action: string; className?: string; span?: number };

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
  const abs = Math.abs(v);
  if (abs !== 0 && (abs >= 1e12 || abs < 1e-9)) return v.toExponential(6).replace(/\.?0+e/, "e");
  const s = Number(v.toPrecision(12)).toString();
  return s;
}

/** Tokenize expression for safe evaluation. */
function tokenize(expr: string): string[] {
  const s = expr.replace(/\s+/g, "");
  const out: string[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i]!;
    if ("+-×÷*/^()%,".includes(c) || c === "−") {
      out.push(c === "*" ? "×" : c === "/" ? "÷" : c === "-" ? "−" : c);
      i++;
      continue;
    }
    if (/[0-9.]/.test(c)) {
      let j = i + 1;
      while (j < s.length && /[0-9.]/.test(s[j]!)) j++;
      out.push(s.slice(i, j));
      i = j;
      continue;
    }
    // multi-char functions / constants
    const rest = s.slice(i).toLowerCase();
    const fns = [
      "asin", "acos", "atan", "sin", "cos", "tan", "log10", "log", "ln",
      "sqrt", "cbrt", "exp", "abs", "pi", "e",
    ];
    let matched = false;
    for (const fn of fns) {
      if (rest.startsWith(fn)) {
        out.push(fn);
        i += fn.length;
        matched = true;
        break;
      }
    }
    if (!matched) {
      // unknown char — skip
      i++;
    }
  }
  return out;
}

type AngleCtx = { angle: AngleMode };

function evalTokens(tokens: string[], ctx: AngleCtx): number {
  // Recursive descent: expr = term ((+|−) term)*
  // term = power ((×|÷|%) power)*
  // power = unary (^ unary)*
  // unary = (+|−) unary | primary
  // primary = number | const | fn ( expr ) | ( expr )
  let pos = 0;
  const peek = () => tokens[pos];
  const take = () => tokens[pos++];

  function parseExpr(): number {
    let v = parseTerm();
    while (peek() === "+" || peek() === "−") {
      const op = take()!;
      const r = parseTerm();
      v = op === "+" ? v + r : v - r;
    }
    return v;
  }
  function parseTerm(): number {
    let v = parsePower();
    while (peek() === "×" || peek() === "÷" || peek() === "%") {
      const op = take()!;
      const r = parsePower();
      if (op === "×") v = v * r;
      else if (op === "÷") v = r === 0 ? NaN : v / r;
      else v = v % r;
    }
    return v;
  }
  function parsePower(): number {
    let v = parseUnary();
    if (peek() === "^") {
      take();
      const r = parsePower(); // right-assoc
      v = Math.pow(v, r);
    }
    return v;
  }
  function parseUnary(): number {
    if (peek() === "+") {
      take();
      return parseUnary();
    }
    if (peek() === "−") {
      take();
      return -parseUnary();
    }
    return parsePrimary();
  }
  function parsePrimary(): number {
    const t = peek();
    if (t == null) return NaN;
    if (/^[0-9]*\.?[0-9]+$/.test(t)) {
      take();
      return Number(t);
    }
    if (t === "pi") {
      take();
      return Math.PI;
    }
    if (t === "e") {
      take();
      return Math.E;
    }
    const fns: Record<string, (x: number) => number> = {
      sin: (x) => Math.sin(toRad(x, ctx.angle)),
      cos: (x) => Math.cos(toRad(x, ctx.angle)),
      tan: (x) => Math.tan(toRad(x, ctx.angle)),
      asin: (x) => fromRad(Math.asin(x), ctx.angle),
      acos: (x) => fromRad(Math.acos(x), ctx.angle),
      atan: (x) => fromRad(Math.atan(x), ctx.angle),
      log: (x) => Math.log10(x),
      log10: (x) => Math.log10(x),
      ln: (x) => Math.log(x),
      sqrt: (x) => Math.sqrt(x),
      cbrt: (x) => Math.cbrt(x),
      exp: (x) => Math.exp(x),
      abs: (x) => Math.abs(x),
    };
    if (t in fns) {
      take();
      if (peek() === "(") {
        take();
        const arg = parseExpr();
        if (peek() === ")") take();
        return fns[t]!(arg);
      }
      // function without paren yet — incomplete
      return NaN;
    }
    if (t === "(") {
      take();
      const v = parseExpr();
      if (peek() === ")") take();
      return v;
    }
    take();
    return NaN;
  }

  try {
    const v = parseExpr();
    if (pos < tokens.length) return NaN; // trailing junk
    return v;
  } catch {
    return NaN;
  }
}

/** Live-evaluate if expression is complete enough; else null. */
function tryLiveEval(expr: string, angle: AngleMode): string | null {
  let trimmed = expr.trim();
  if (!trimmed) return null;
  // incomplete trailing operator or bare function name
  if (/[+\-−×÷*/^]$/.test(trimmed)) return null;
  if (/(sin|cos|tan|asin|acos|atan|log|ln|sqrt|cbrt|exp)\s*$/i.test(trimmed)) return null;
  // Auto-close open parentheses for live preview (e.g. cos(60 → cos(60))
  const open = (trimmed.match(/\(/g) || []).length;
  const close = (trimmed.match(/\)/g) || []).length;
  if (open > close) trimmed = trimmed + ")".repeat(open - close);
  if (/\($/.test(trimmed.replace(/\)$/, ""))) return null;
  try {
    const tokens = tokenize(trimmed);
    if (!tokens.length) return null;
    const v = evalTokens(tokens, { angle });
    if (!Number.isFinite(v)) return null;
    return formatResult(v);
  } catch {
    return null;
  }
}


const BASIC_ROWS: KeyDef[][] = [
  [
    { label: "AC", action: "ac", className: "bg-amber-500 text-white font-bold" },
    { label: "⌫", action: "del", className: "bg-amber-500 text-white font-bold" },
    { label: "%", action: "%" },
    { label: "÷", action: "÷" },
  ],
  [
    { label: "7", action: "7" },
    { label: "8", action: "8" },
    { label: "9", action: "9" },
    { label: "×", action: "×" },
  ],
  [
    { label: "4", action: "4" },
    { label: "5", action: "5" },
    { label: "6", action: "6" },
    { label: "−", action: "−" },
  ],
  [
    { label: "1", action: "1" },
    { label: "2", action: "2" },
    { label: "3", action: "3" },
    { label: "+", action: "+" },
  ],
  [
    { label: "0", action: "0", span: 2 },
    { label: ".", action: "." },
    { label: "=", action: "=", className: "bg-[#2563eb] text-white font-bold" },
  ],
];

function scientificRows(angle: AngleMode): KeyDef[][] {
  return [
    [
      { label: angle, action: "angle" },
      { label: "◀", action: "left" },
      { label: "▶", action: "right" },
      { label: "⌫", action: "del", className: "bg-amber-500 text-white font-bold shadow-amber" },
      { label: "AC", action: "ac", className: "bg-amber-500 text-white font-bold shadow-amber" },
    ],
    [
      { label: "sin", action: "sin(" },
      { label: "cos", action: "cos(" },
      { label: "tan", action: "tan(" },
      { label: "log₁₀", action: "log(" },
      { label: "ln", action: "ln(" },
      { label: "π", action: "pi" },
    ],
    [
      { label: "hyp", action: "noop" },
      { label: "sin⁻¹", action: "asin(" },
      { label: "cos⁻¹", action: "acos(" },
      { label: "tan⁻¹", action: "atan(" },
      { label: "xʸ", action: "^" },
      { label: "10ˣ", action: "10^" },
    ],
    [
      { label: "x²", action: "sq" },
      { label: "³√x", action: "cbrt(" },
      { label: "√x", action: "sqrt(" },
      { label: "eˣ", action: "exp(" },
      { label: "x⁻¹", action: "inv" },
      { label: "e", action: "e" },
    ],
    [
      { label: "7", action: "7" },
      { label: "8", action: "8" },
      { label: "9", action: "9" },
      { label: "(", action: "(" },
      { label: ")", action: ")" },
      { label: "%", action: "%" },
    ],
    [
      { label: "4", action: "4" },
      { label: "5", action: "5" },
      { label: "6", action: "6" },
      { label: "×", action: "×" },
      { label: "÷", action: "÷" },
    ],
    [
      { label: "1", action: "1" },
      { label: "2", action: "2" },
      { label: "3", action: "3" },
      { label: "−", action: "−" },
      { label: "+", action: "+" },
    ],
    [
      { label: "0", action: "0", span: 2 },
      { label: ".", action: "." },
      { label: "=", action: "=", className: "bg-[#2563eb] text-white font-bold", span: 2 },
    ],
  ];
}

export function ExamCalculator({ open, mode, onClose }: Props) {
  const [expr, setExpr] = useState("");
  const [cursor, setCursor] = useState(0);
  const [result, setResult] = useState("0");
  const [finalized, setFinalized] = useState(false);
  const [error, setError] = useState(false);
  const [angle, setAngle] = useState<AngleMode>("DEG");

  useEffect(() => {
    if (!open) {
      setExpr("");
      setCursor(0);
      setResult("0");
      setFinalized(false);
      setError(false);
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
      try {
        delete (window as unknown as { __d4CloseCalc?: () => void }).__d4CloseCalc;
      } catch {
        /* ignore */
      }
      void handle?.remove();
    };
  }, [open, onClose]);

  // Live auto-calculate whenever expression changes
  useEffect(() => {
    if (finalized) return;
    if (!expr) {
      setResult("0");
      setError(false);
      return;
    }
    const live = tryLiveEval(expr, angle);
    if (live != null) {
      setResult(live);
      setError(false);
    }
  }, [expr, angle, finalized]);

  const append = useCallback((chunk: string) => {
    setError(false);
    if (finalized) {
      setFinalized(false);
      if (/^[+\-−×÷*/^%]/.test(chunk) || chunk === "^") {
        const next = result + chunk;
        setExpr(next);
        setCursor(next.length);
      } else {
        setExpr(chunk);
        setCursor(chunk.length);
      }
      return;
    }
    setExpr((prev) => {
      const i = Math.max(0, Math.min(cursor, prev.length));
      const next = prev.slice(0, i) + chunk + prev.slice(i);
      setCursor(i + chunk.length);
      return next;
    });
  }, [finalized, result, cursor]);

  const applyAction = useCallback(
    (action: string) => {
      if (action === "noop") return;
      if (action === "ac") {
        setExpr("");
        setCursor(0);
        setResult("0");
        setFinalized(false);
        setError(false);
        return;
      }
      if (action === "left") {
        setCursor((c) => Math.max(0, c - 1));
        return;
      }
      if (action === "right") {
        setCursor((c) => Math.min(expr.length, c + 1));
        return;
      }
      if (action === "del") {
        setFinalized(false);
        setError(false);
        setExpr((e) => {
          if (!e) return "";
          const i = Math.max(0, Math.min(cursor, e.length));
          if (i <= 0) return e;
          const before = e.slice(0, i);
          const after = e.slice(i);
          const fns = ["asin(", "acos(", "atan(", "sin(", "cos(", "tan(", "log(", "ln(", "sqrt(", "cbrt(", "exp(", "10^"];
          for (const f of fns) {
            if (before.endsWith(f)) {
              setCursor(i - f.length);
              return before.slice(0, -f.length) + after;
            }
          }
          if (before.endsWith("pi")) {
            setCursor(i - 2);
            return before.slice(0, -2) + after;
          }
          setCursor(i - 1);
          return before.slice(0, -1) + after;
        });
        return;
      }
      if (action === "angle") {
        setAngle((a) => (a === "DEG" ? "RAD" : a === "RAD" ? "GRAD" : "DEG"));
        return;
      }
      if (action === "=") {
        const toEval = expr || result;
        const live = tryLiveEval(toEval, angle);
        if (live == null || live === "Error") {
          setResult("Error");
          setError(true);
          setFinalized(true);
          return;
        }
        setResult(live);
        setExpr(toEval);
        setCursor(toEval.length);
        setFinalized(true);
        setError(false);
        return;
      }
      if (action === "sq") {
        // square current value or wrap expression
        setFinalized(false);
        setExpr((e) => {
          if (finalized) return `(${result})^2`;
          if (!e) return "";
          return `(${e})^2`;
        });
        return;
      }
      if (action === "inv") {
        setFinalized(false);
        setExpr((e) => {
          if (finalized) return `1/(${result})`;
          if (!e) return "1/(";
          return `1/(${e})`;
        });
        return;
      }
      if (action === "pi") {
        append("pi");
        return;
      }
      if (action === "e") {
        append("e");
        return;
      }
      if (action === "10^") {
        append("10^");
        return;
      }
      if (
        action.endsWith("(") ||
        action === "(" ||
        action === ")" ||
        /^[0-9.]$/.test(action) ||
        ["+", "−", "×", "÷", "^", "%"].includes(action)
      ) {
        if (action === ")" && !expr && !finalized) return;
        append(action);
        return;
      }
      append(action);
    },
    [append, angle, expr, cursor, finalized, result],
  );

  const rows = useMemo(
    () => (mode === "scientific" ? scientificRows(angle) : BASIC_ROWS),
    [mode, angle],
  );

  if (!open) return null;

  const resultShown = error ? "Error" : result;

  return (
    <div
      className="fixed z-[200] flex flex-col"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: "100vw",
        height: "100dvh",
        maxWidth: "100vw",
        maxHeight: "100dvh",
        margin: 0,
        backgroundColor: "#0b1b3a",
        paddingTop: "env(safe-area-inset-top, 0px)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        paddingLeft: "env(safe-area-inset-left, 0px)",
        paddingRight: "env(safe-area-inset-right, 0px)",
        boxSizing: "border-box",
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Calculator"
    >
      {/* Header — title is always "Calculator" for students */}
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#1e3a5f] px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#2563eb] text-white">
            <CalcIcon className="h-5 w-5" />
          </div>
          <h2 className="truncate text-lg font-bold text-white">Calculator</h2>
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

      {/* Display: expression top, live result bottom */}
      <div className="mx-3 mt-3 shrink-0 rounded-2xl border border-[#1e3a5f] bg-[#06101f] px-4 py-4 text-right shadow-inner shadow-black/40">
        <p className="min-h-[1.25rem] break-all font-mono text-sm text-slate-400 sm:text-base">
          {finalized ? (
            expr || " "
          ) : expr ? (
            <>
              <span>{expr.slice(0, cursor)}</span>
              <span className="mx-px inline-block h-[1.05em] w-[2px] animate-pulse bg-sky-400 align-middle" />
              <span>{expr.slice(cursor)}</span>
            </>
          ) : (
            <span className="inline-block h-[1.05em] w-[2px] animate-pulse bg-sky-400 align-middle" />
          )}
        </p>
        <p
          className={cn(
            "mt-2 break-all font-mono tabular-nums text-white",
            finalized ? "text-4xl font-extrabold sm:text-5xl" : "text-3xl font-bold sm:text-4xl",
            error && "text-red-400",
          )}
        >
          {resultShown}
        </p>
      </div>

      {/* Keys */}
      <div className="mt-2 flex min-h-0 flex-1 flex-col px-2.5 pb-2.5">
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
                    "min-h-[2.5rem] rounded-xl border border-white/10 bg-gradient-to-b from-[#1a3a66] to-[#0f2340] text-[13px] font-semibold text-slate-100 shadow-[0_3px_0_0_#06101f,0_4px_10px_rgba(0,0,0,0.4)] transition-all duration-75 hover:from-[#1e4475] hover:to-[#132a4d] active:translate-y-[2px] active:shadow-[0_1px_0_0_#06101f,0_2px_4px_rgba(0,0,0,0.35)] sm:text-base",
                    k.className,
                  )}
                  style={k.span ? { gridColumn: `span ${k.span}` } : undefined}
                >
                  {k.label}
                </button>
              ))}
            </div>
          ))}
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
