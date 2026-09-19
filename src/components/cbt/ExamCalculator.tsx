/**
 * D4EXAM full-viewport scientific calculator.
 * Natural-entry math structures + UI matching D4EXAM design reference.
 * Preserves: CalculatorMode, ExamCalculatorFab, exam allow_calculator integration.
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Calculator as CalcIcon, X, Delete } from "lucide-react";
import { cn } from "@/lib/utils";
import { App as CapApp } from "@capacitor/app";
import { isNativeShell } from "@/native/platform";

export type CalculatorMode = "basic" | "scientific";
type AngleMode = "DEG" | "RAD" | "GRAD";
type Props = { open: boolean; mode: CalculatorMode; onClose: () => void };

/* ═══════════════ AST ═══════════════ */

type Atom =
  | { t: "num"; v: string }
  | { t: "op"; v: string }
  | { t: "lparen" }
  | { t: "rparen" }
  | { t: "pi" }
  | { t: "e" }
  | { t: "ans" }
  | { t: "x" }
  | { t: "i" }
  | { t: "pct" }
  | { t: "fact" }
  | { t: "fn"; name: string; arg: Atom[] }
  | { t: "frac"; num: Atom[]; den: Atom[] }
  | { t: "mixed"; whole: Atom[]; num: Atom[]; den: Atom[] }
  | { t: "sqrt"; arg: Atom[] }
  | { t: "cbrt"; arg: Atom[] }
  | { t: "nroot"; n: Atom[]; arg: Atom[] }
  | { t: "pow"; base: Atom[]; exp: Atom[] }
  | { t: "inv"; base: Atom[] }
  | { t: "sq"; base: Atom[] }
  | { t: "cube"; base: Atom[] }
  | { t: "logb"; base: Atom[]; arg: Atom[] }
  | { t: "nCr"; n: Atom[]; r: Atom[] }
  | { t: "nPr"; n: Atom[]; r: Atom[] }
  | { t: "mod"; a: Atom[]; b: Atom[] };

type Slot = "main" | "num" | "den" | "whole" | "arg" | "exp" | "n" | "base" | "r" | "a" | "b";
type Cursor = { path: number[]; slot: Slot };

function emptyCursor(): Cursor {
  return { path: [], slot: "main" };
}

/* ═══════════════ Math helpers ═══════════════ */

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
  if (abs !== 0 && (abs >= 1e12 || abs < 1e-9))
    return v.toExponential(6).replace(/\.?0+e/, "e");
  return Number(v.toPrecision(12)).toString();
}
function factorial(n: number): number {
  if (n < 0 || !Number.isInteger(n) || n > 170) return NaN;
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}
function nCr(n: number, r: number): number {
  if (r < 0 || n < 0 || !Number.isInteger(n) || !Number.isInteger(r) || r > n) return NaN;
  return factorial(n) / (factorial(r) * factorial(n - r));
}
function nPr(n: number, r: number): number {
  if (r < 0 || n < 0 || !Number.isInteger(n) || !Number.isInteger(r) || r > n) return NaN;
  return factorial(n) / factorial(n - r);
}

function evalAtoms(atoms: Atom[], angle: AngleMode, ans: number): number {
  const tokens: string[] = [];
  const emit = (a: Atom[]) => {
    for (const node of a) {
      switch (node.t) {
        case "num":
          tokens.push(node.v || "0");
          break;
        case "op":
          tokens.push(node.v);
          break;
        case "lparen":
          tokens.push("(");
          break;
        case "rparen":
          tokens.push(")");
          break;
        case "pi":
          tokens.push(String(Math.PI));
          break;
        case "e":
          tokens.push(String(Math.E));
          break;
        case "ans":
          tokens.push(String(ans));
          break;
        case "x":
        case "i":
          tokens.push("0");
          break;
        case "pct":
          tokens.push("%");
          break;
        case "fact":
          tokens.push("!");
          break;
        case "fn": {
          const arg = evalAtoms(node.arg.length ? node.arg : [{ t: "num", v: "0" }], angle, ans);
          let v = NaN;
          const name = node.name;
          if (name === "sin") v = Math.sin(toRad(arg, angle));
          else if (name === "cos") v = Math.cos(toRad(arg, angle));
          else if (name === "tan") v = Math.tan(toRad(arg, angle));
          else if (name === "asin") v = fromRad(Math.asin(arg), angle);
          else if (name === "acos") v = fromRad(Math.acos(arg), angle);
          else if (name === "atan") v = fromRad(Math.atan(arg), angle);
          else if (name === "sinh") v = Math.sinh(arg);
          else if (name === "cosh") v = Math.cosh(arg);
          else if (name === "tanh") v = Math.tanh(arg);
          else if (name === "ln") v = Math.log(arg);
          else if (name === "log" || name === "log10") v = Math.log10(arg);
          else if (name === "exp") v = Math.exp(arg);
          else if (name === "abs") v = Math.abs(arg);
          else if (name === "10^") v = Math.pow(10, arg);
          tokens.push(String(v));
          break;
        }
        case "frac": {
          const n = evalAtoms(node.num.length ? node.num : [{ t: "num", v: "0" }], angle, ans);
          const d = evalAtoms(node.den.length ? node.den : [{ t: "num", v: "1" }], angle, ans);
          tokens.push(String(n / d));
          break;
        }
        case "mixed": {
          const w = evalAtoms(node.whole.length ? node.whole : [{ t: "num", v: "0" }], angle, ans);
          const n = evalAtoms(node.num.length ? node.num : [{ t: "num", v: "0" }], angle, ans);
          const d = evalAtoms(node.den.length ? node.den : [{ t: "num", v: "1" }], angle, ans);
          tokens.push(String(w + n / d));
          break;
        }
        case "sqrt":
          tokens.push(
            String(Math.sqrt(evalAtoms(node.arg.length ? node.arg : [{ t: "num", v: "0" }], angle, ans))),
          );
          break;
        case "cbrt":
          tokens.push(
            String(Math.cbrt(evalAtoms(node.arg.length ? node.arg : [{ t: "num", v: "0" }], angle, ans))),
          );
          break;
        case "nroot": {
          const n = evalAtoms(node.n.length ? node.n : [{ t: "num", v: "2" }], angle, ans);
          const a = evalAtoms(node.arg.length ? node.arg : [{ t: "num", v: "0" }], angle, ans);
          tokens.push(String(Math.pow(a, 1 / n)));
          break;
        }
        case "pow": {
          const b = evalAtoms(node.base.length ? node.base : [{ t: "num", v: "0" }], angle, ans);
          const e = evalAtoms(node.exp.length ? node.exp : [{ t: "num", v: "1" }], angle, ans);
          tokens.push(String(Math.pow(b, e)));
          break;
        }
        case "inv": {
          const b = evalAtoms(node.base.length ? node.base : [{ t: "num", v: "1" }], angle, ans);
          tokens.push(String(1 / b));
          break;
        }
        case "sq": {
          const b = evalAtoms(node.base.length ? node.base : [{ t: "num", v: "0" }], angle, ans);
          tokens.push(String(b * b));
          break;
        }
        case "cube": {
          const b = evalAtoms(node.base.length ? node.base : [{ t: "num", v: "0" }], angle, ans);
          tokens.push(String(b * b * b));
          break;
        }
        case "logb": {
          const b = evalAtoms(node.base.length ? node.base : [{ t: "num", v: "10" }], angle, ans);
          const a = evalAtoms(node.arg.length ? node.arg : [{ t: "num", v: "1" }], angle, ans);
          tokens.push(String(Math.log(a) / Math.log(b)));
          break;
        }
        case "nCr": {
          const n = evalAtoms(node.n.length ? node.n : [{ t: "num", v: "0" }], angle, ans);
          const r = evalAtoms(node.r.length ? node.r : [{ t: "num", v: "0" }], angle, ans);
          tokens.push(String(nCr(n, r)));
          break;
        }
        case "nPr": {
          const n = evalAtoms(node.n.length ? node.n : [{ t: "num", v: "0" }], angle, ans);
          const r = evalAtoms(node.r.length ? node.r : [{ t: "num", v: "0" }], angle, ans);
          tokens.push(String(nPr(n, r)));
          break;
        }
        case "mod": {
          const a = evalAtoms(node.a.length ? node.a : [{ t: "num", v: "0" }], angle, ans);
          const b = evalAtoms(node.b.length ? node.b : [{ t: "num", v: "1" }], angle, ans);
          tokens.push(String(a % b));
          break;
        }
      }
    }
  };
  emit(atoms);
  return evalTokenList(tokens);
}

function evalTokenList(tokens: string[]): number {
  const expanded: string[] = [];
  for (const t of tokens) {
    if (t === "%") {
      expanded.push("/", "100");
      continue;
    }
    if (t === "!") {
      const prev = expanded.pop();
      expanded.push(String(factorial(Number(prev))));
      continue;
    }
    expanded.push(t);
  }
  const prec: Record<string, number> = { "+": 1, "−": 1, "-": 1, "×": 2, "÷": 2, "^": 3 };
  const right: Record<string, boolean> = { "^": true };
  const out: string[] = [];
  const ops: string[] = [];
  for (const t of expanded) {
    if (t === "(") ops.push(t);
    else if (t === ")") {
      while (ops.length && ops[ops.length - 1] !== "(") out.push(ops.pop()!);
      ops.pop();
    } else if (prec[t] != null) {
      while (
        ops.length &&
        ops[ops.length - 1] !== "(" &&
        prec[ops[ops.length - 1]!] != null &&
        (right[t]
          ? prec[ops[ops.length - 1]!]! > prec[t]!
          : prec[ops[ops.length - 1]!]! >= prec[t]!)
      )
        out.push(ops.pop()!);
      ops.push(t);
    } else out.push(t);
  }
  while (ops.length) out.push(ops.pop()!);
  const st: number[] = [];
  for (const t of out) {
    if (prec[t] != null) {
      const b = st.pop() ?? 0;
      const a = st.pop() ?? 0;
      if (t === "+") st.push(a + b);
      else if (t === "−" || t === "-") st.push(a - b);
      else if (t === "×") st.push(a * b);
      else if (t === "÷") st.push(a / b);
      else if (t === "^") st.push(Math.pow(a, b));
    } else st.push(Number(t));
  }
  return st.length ? st[st.length - 1]! : NaN;
}

/* ═══════════════ Cursor / list helpers ═══════════════ */

function getListAt(atoms: Atom[], cur: Cursor): Atom[] {
  if (cur.path.length === 0) return atoms;
  const node = atoms[cur.path[0]!];
  if (!node) return atoms;
  if (node.t === "frac") return cur.slot === "den" ? node.den : node.num;
  if (node.t === "mixed") {
    if (cur.slot === "whole") return node.whole;
    if (cur.slot === "den") return node.den;
    return node.num;
  }
  if (node.t === "sqrt" || node.t === "cbrt" || node.t === "fn") return node.arg;
  if (node.t === "nroot") return cur.slot === "n" ? node.n : node.arg;
  if (node.t === "pow") return cur.slot === "exp" ? node.exp : node.base;
  if (node.t === "inv" || node.t === "sq" || node.t === "cube") return node.base;
  if (node.t === "logb") return cur.slot === "base" ? node.base : node.arg;
  if (node.t === "nCr" || node.t === "nPr") return cur.slot === "r" ? node.r : node.n;
  if (node.t === "mod") return cur.slot === "b" ? node.b : node.a;
  return atoms;
}

function setListAt(atoms: Atom[], cur: Cursor, nextList: Atom[]): Atom[] {
  if (cur.path.length === 0) return nextList;
  const clone = structuredClone(atoms) as Atom[];
  const node = clone[cur.path[0]!];
  if (!node) return atoms;
  if (node.t === "frac") {
    if (cur.slot === "den") node.den = nextList;
    else node.num = nextList;
  } else if (node.t === "mixed") {
    if (cur.slot === "whole") node.whole = nextList;
    else if (cur.slot === "den") node.den = nextList;
    else node.num = nextList;
  } else if (node.t === "sqrt" || node.t === "cbrt" || node.t === "fn") node.arg = nextList;
  else if (node.t === "nroot") {
    if (cur.slot === "n") node.n = nextList;
    else node.arg = nextList;
  } else if (node.t === "pow") {
    if (cur.slot === "exp") node.exp = nextList;
    else node.base = nextList;
  } else if (node.t === "inv" || node.t === "sq" || node.t === "cube") node.base = nextList;
  else if (node.t === "logb") {
    if (cur.slot === "base") node.base = nextList;
    else node.arg = nextList;
  } else if (node.t === "nCr" || node.t === "nPr") {
    if (cur.slot === "r") node.r = nextList;
    else node.n = nextList;
  } else if (node.t === "mod") {
    if (cur.slot === "b") node.b = nextList;
    else node.a = nextList;
  }
  return clone;
}

function popTrailingNum(list: Atom[]): Atom[] {
  if (list.length && list[list.length - 1]!.t === "num") return [list.pop()!];
  if (list.length && list[list.length - 1]!.t === "rparen") {
    // take last paren group roughly as single atom
    return [list.pop()!];
  }
  return [];
}

function insertAt(atoms: Atom[], cur: Cursor, item: Atom): { atoms: Atom[]; cur: Cursor } {
  const list = [...getListAt(atoms, cur)];

  // Fraction: if trailing number exists at main level, use as numerator
  if (item.t === "frac" && cur.path.length === 0) {
    const num = popTrailingNum(list);
    list.push({ t: "frac", num: num.length ? num : [], den: [] });
    return {
      atoms: setListAt(atoms, cur, list),
      cur: { path: [list.length - 1], slot: num.length ? "den" : "num" },
    };
  }
  if (item.t === "frac") {
    list.push(item);
    return {
      atoms: setListAt(atoms, cur, list),
      cur: { path: cur.path.length ? cur.path : [list.length - 1], slot: "num" },
    };
  }
  if (item.t === "mixed") {
    const whole = popTrailingNum(list);
    list.push({ t: "mixed", whole, num: [], den: [] });
    return {
      atoms: setListAt(atoms, cur, list),
      cur: { path: [list.length - 1], slot: "num" },
    };
  }
  if (item.t === "sqrt" || item.t === "cbrt") {
    list.push(item);
    return { atoms: setListAt(atoms, cur, list), cur: { path: [list.length - 1], slot: "arg" } };
  }
  if (item.t === "nroot") {
    list.push(item);
    return { atoms: setListAt(atoms, cur, list), cur: { path: [list.length - 1], slot: "n" } };
  }
  if (item.t === "pow" || item.t === "sq" || item.t === "cube" || item.t === "inv") {
    const base = popTrailingNum(list);
    if (item.t === "pow") {
      list.push({ t: "pow", base: base.length ? base : [], exp: [] });
      return { atoms: setListAt(atoms, cur, list), cur: { path: [list.length - 1], slot: "exp" } };
    }
    if (item.t === "sq") {
      list.push({ t: "sq", base: base.length ? base : [] });
      return { atoms: setListAt(atoms, cur, list), cur };
    }
    if (item.t === "cube") {
      list.push({ t: "cube", base: base.length ? base : [] });
      return { atoms: setListAt(atoms, cur, list), cur };
    }
    list.push({ t: "inv", base: base.length ? base : [] });
    return { atoms: setListAt(atoms, cur, list), cur };
  }
  if (item.t === "fn" || item.t === "logb") {
    list.push(item);
    return { atoms: setListAt(atoms, cur, list), cur: { path: [list.length - 1], slot: "arg" } };
  }
  if (item.t === "nCr" || item.t === "nPr") {
    const n = popTrailingNum(list);
    if (item.t === "nCr") list.push({ t: "nCr", n: n.length ? n : [], r: [] });
    else list.push({ t: "nPr", n: n.length ? n : [], r: [] });
    return { atoms: setListAt(atoms, cur, list), cur: { path: [list.length - 1], slot: "r" } };
  }
  if (item.t === "mod") {
    const a = popTrailingNum(list);
    list.push({ t: "mod", a: a.length ? a : [], b: [] });
    return { atoms: setListAt(atoms, cur, list), cur: { path: [list.length - 1], slot: "b" } };
  }
  if (item.t === "num" && list.length && list[list.length - 1]!.t === "num") {
    const last = list[list.length - 1] as { t: "num"; v: string };
    if (item.v === "." && last.v.includes(".")) return { atoms, cur };
    last.v = last.v + item.v;
    return { atoms: setListAt(atoms, cur, list), cur };
  }
  list.push(item);
  return { atoms: setListAt(atoms, cur, list), cur };
}

function backspace(atoms: Atom[], cur: Cursor): { atoms: Atom[]; cur: Cursor } {
  const list = [...getListAt(atoms, cur)];
  if (!list.length) {
    if (cur.path.length) return { atoms, cur: emptyCursor() };
    return { atoms, cur };
  }
  const last = list[list.length - 1]!;
  if (last.t === "num" && last.v.length > 1) {
    last.v = last.v.slice(0, -1);
    return { atoms: setListAt(atoms, cur, list), cur };
  }
  list.pop();
  return { atoms: setListAt(atoms, cur, list), cur };
}

/* ═══════════════ Visual ═══════════════ */

function Caret({ on }: { on: boolean }) {
  if (!on) return null;
  return (
    <span
      className="mx-px inline-block h-[1.15em] w-[2.5px] animate-pulse rounded-sm bg-[#38bdf8] align-middle"
      aria-hidden
    />
  );
}

function SlotBox({
  atoms,
  active,
  onFocus,
  minW = "0.85em",
}: {
  atoms: Atom[];
  active: boolean;
  onFocus: () => void;
  minW?: string;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onFocus();
      }}
      className={cn(
        "inline-flex min-h-[1.1em] items-center justify-center rounded-[3px] border border-dashed px-0.5 align-middle leading-none",
        active ? "border-sky-400 bg-sky-500/20" : "border-white/30 bg-transparent",
      )}
      style={{ minWidth: minW }}
    >
      {atoms.length === 0 ? (
        <>
          <Caret on={active} />
          <span className="text-white/25">□</span>
        </>
      ) : (
        <>
          <AtomRow atoms={atoms} cursor={null} onCursor={() => onFocus()} />
          <Caret on={active} />
        </>
      )}
    </button>
  );
}

function AtomRow({
  atoms,
  cursor,
  onCursor,
  pathPrefix = [],
}: {
  atoms: Atom[];
  cursor: Cursor | null;
  onCursor: (c: Cursor) => void;
  pathPrefix?: number[];
}) {
  return (
    <span className="inline-flex flex-wrap items-center gap-px font-serif text-[1.08em] leading-tight text-white">
      {atoms.map((node, i) => (
        <AtomView
          key={i}
          node={node}
          index={i}
          cursor={cursor}
          pathPrefix={pathPrefix}
          onCursor={onCursor}
        />
      ))}
      {cursor && cursor.path.length === pathPrefix.length && cursor.slot === "main" ? (
        <Caret on />
      ) : null}
    </span>
  );
}

function AtomView({
  node,
  index,
  cursor,
  pathPrefix,
  onCursor,
}: {
  node: Atom;
  index: number;
  cursor: Cursor | null;
  pathPrefix: number[];
  onCursor: (c: Cursor) => void;
}) {
  const path = [...pathPrefix, index];
  const active = (slot: Slot) =>
    Boolean(
      cursor &&
        cursor.path.length === path.length &&
        path.every((p, j) => cursor!.path[j] === p) &&
        cursor.slot === slot,
    );

  switch (node.t) {
    case "num":
      return <span className="tabular-nums tracking-tight">{node.v}</span>;
    case "op":
      return <span className="mx-0.5 opacity-95">{node.v}</span>;
    case "lparen":
      return <span>(</span>;
    case "rparen":
      return <span>)</span>;
    case "pi":
      return <span className="italic">π</span>;
    case "e":
      return <span className="italic">e</span>;
    case "ans":
      return <span className="font-sans text-[0.82em] font-bold text-sky-300">Ans</span>;
    case "x":
      return <span className="italic">x</span>;
    case "i":
      return <span className="italic">i</span>;
    case "pct":
      return <span>%</span>;
    case "fact":
      return <span>!</span>;
    case "frac":
      return (
        <span className="mx-0.5 inline-flex flex-col items-center align-middle text-[0.9em] leading-none">
          <SlotBox atoms={node.num} active={active("num")} onFocus={() => onCursor({ path, slot: "num" })} />
          <span className="my-px h-[1.5px] w-full min-w-[1.35em] bg-white" />
          <SlotBox atoms={node.den} active={active("den")} onFocus={() => onCursor({ path, slot: "den" })} />
        </span>
      );
    case "mixed":
      return (
        <span className="mx-0.5 inline-flex items-center gap-0.5 align-middle">
          <SlotBox
            atoms={node.whole}
            active={active("whole")}
            onFocus={() => onCursor({ path, slot: "whole" })}
            minW="0.65em"
          />
          <span className="inline-flex flex-col items-center text-[0.86em] leading-none">
            <SlotBox atoms={node.num} active={active("num")} onFocus={() => onCursor({ path, slot: "num" })} />
            <span className="my-px h-[1.5px] w-full min-w-[1.15em] bg-white" />
            <SlotBox atoms={node.den} active={active("den")} onFocus={() => onCursor({ path, slot: "den" })} />
          </span>
        </span>
      );
    case "sqrt":
      return (
        <span className="mx-0.5 inline-flex items-stretch align-middle">
          <span className="self-end pb-0.5 pr-px text-[1.2em] leading-none">√</span>
          <span className="inline-flex border-t-2 border-white pt-0.5">
            <SlotBox
              atoms={node.arg}
              active={active("arg")}
              onFocus={() => onCursor({ path, slot: "arg" })}
              minW="1.15em"
            />
          </span>
        </span>
      );
    case "cbrt":
      return (
        <span className="mx-0.5 inline-flex items-stretch align-middle">
          <span className="relative self-end pb-0.5 pr-px text-[1.2em] leading-none">
            <sup className="absolute -left-1.5 top-0 text-[0.52em] font-sans">3</sup>√
          </span>
          <span className="inline-flex border-t-2 border-white pt-0.5">
            <SlotBox
              atoms={node.arg}
              active={active("arg")}
              onFocus={() => onCursor({ path, slot: "arg" })}
              minW="1.15em"
            />
          </span>
        </span>
      );
    case "nroot":
      return (
        <span className="mx-0.5 inline-flex items-stretch align-middle">
          <span className="relative self-end pb-0.5 pr-px text-[1.2em] leading-none">
            <span className="absolute -left-2.5 top-0 scale-90">
              <SlotBox
                atoms={node.n}
                active={active("n")}
                onFocus={() => onCursor({ path, slot: "n" })}
                minW="0.55em"
              />
            </span>
            √
          </span>
          <span className="inline-flex border-t-2 border-white pt-0.5">
            <SlotBox
              atoms={node.arg}
              active={active("arg")}
              onFocus={() => onCursor({ path, slot: "arg" })}
              minW="1.15em"
            />
          </span>
        </span>
      );
    case "pow":
      return (
        <span className="mx-0.5 inline-flex items-start align-middle">
          <SlotBox
            atoms={node.base}
            active={active("base")}
            onFocus={() => onCursor({ path, slot: "base" })}
            minW="0.65em"
          />
          <sup className="ml-px text-[0.7em]">
            <SlotBox
              atoms={node.exp}
              active={active("exp")}
              onFocus={() => onCursor({ path, slot: "exp" })}
              minW="0.55em"
            />
          </sup>
        </span>
      );
    case "sq":
      return (
        <span className="mx-0.5 inline-flex items-start">
          <SlotBox
            atoms={node.base}
            active={active("base")}
            onFocus={() => onCursor({ path, slot: "base" })}
            minW="0.65em"
          />
          <sup className="text-[0.7em]">2</sup>
        </span>
      );
    case "cube":
      return (
        <span className="mx-0.5 inline-flex items-start">
          <SlotBox
            atoms={node.base}
            active={active("base")}
            onFocus={() => onCursor({ path, slot: "base" })}
            minW="0.65em"
          />
          <sup className="text-[0.7em]">3</sup>
        </span>
      );
    case "inv":
      return (
        <span className="mx-0.5 inline-flex items-start">
          <SlotBox
            atoms={node.base}
            active={active("base")}
            onFocus={() => onCursor({ path, slot: "base" })}
            minW="0.65em"
          />
          <sup className="text-[0.7em]">−1</sup>
        </span>
      );
    case "fn": {
      const label =
        node.name === "asin"
          ? "sin⁻¹"
          : node.name === "acos"
            ? "cos⁻¹"
            : node.name === "atan"
              ? "tan⁻¹"
              : node.name === "10^"
                ? "10"
                : node.name;
      return (
        <span className="mx-0.5 inline-flex items-center font-sans text-[0.88em]">
          <span className="mr-0.5">{label}</span>
          {node.name === "10^" ? <sup className="mr-0.5">□</sup> : null}(
          <SlotBox atoms={node.arg} active={active("arg")} onFocus={() => onCursor({ path, slot: "arg" })} />)
        </span>
      );
    }
    case "logb":
      return (
        <span className="mx-0.5 inline-flex items-end font-sans text-[0.88em]">
          <span>
            log
            <sub className="ml-px">
              <SlotBox
                atoms={node.base}
                active={active("base")}
                onFocus={() => onCursor({ path, slot: "base" })}
                minW="0.5em"
              />
            </sub>
          </span>
          (
          <SlotBox atoms={node.arg} active={active("arg")} onFocus={() => onCursor({ path, slot: "arg" })} />)
        </span>
      );
    case "nCr":
      return (
        <span className="mx-0.5 inline-flex items-center font-sans text-[0.88em]">
          <SlotBox atoms={node.n} active={active("n")} onFocus={() => onCursor({ path, slot: "n" })} minW="0.55em" />
          <span className="mx-0.5">C</span>
          <SlotBox atoms={node.r} active={active("r")} onFocus={() => onCursor({ path, slot: "r" })} minW="0.55em" />
        </span>
      );
    case "nPr":
      return (
        <span className="mx-0.5 inline-flex items-center font-sans text-[0.88em]">
          <SlotBox atoms={node.n} active={active("n")} onFocus={() => onCursor({ path, slot: "n" })} minW="0.55em" />
          <span className="mx-0.5">P</span>
          <SlotBox atoms={node.r} active={active("r")} onFocus={() => onCursor({ path, slot: "r" })} minW="0.55em" />
        </span>
      );
    case "mod":
      return (
        <span className="mx-0.5 inline-flex items-center font-sans text-[0.88em]">
          <SlotBox atoms={node.a} active={active("a")} onFocus={() => onCursor({ path, slot: "a" })} />
          <span className="mx-1 text-[0.8em] opacity-80">mod</span>
          <SlotBox atoms={node.b} active={active("b")} onFocus={() => onCursor({ path, slot: "b" })} />
        </span>
      );
    default:
      return null;
  }
}

/* ═══════════════ Keypad layout (matches reference) ═══════════════ */

type Tone = "shift" | "ac" | "fn" | "num" | "op" | "eq" | "nav" | "bk";
type KeyDef = {
  label: ReactNode;
  sub?: ReactNode;
  action: string;
  shiftAction?: string;
  tone: Tone;
  span?: number;
};

function scientificRows(): KeyDef[][] {
  return [
    [
      { label: "SHIFT", action: "SHIFT", tone: "shift" },
      { label: "MENU", action: "MENU", tone: "fn" },
      { label: "◀", action: "LEFT", tone: "nav" },
      { label: "▶", action: "RIGHT", tone: "nav" },
      { label: "⌫", action: "BKSP", tone: "bk" },
      { label: "AC", action: "AC", tone: "ac" },
    ],
    [
      { label: "DRG", action: "DRG", tone: "fn" },
      { label: <span className="text-[11px]"><span className="align-top text-[9px]">a</span>/<span className="align-bottom text-[9px]">b</span></span>, action: "frac", tone: "fn" },
      { label: <span className="text-[11px]">a<sup className="text-[8px]">b</sup>/<sub className="text-[8px]">c</sub></span>, action: "mixed", tone: "fn" },
      { label: "Σ", action: "NOP", tone: "fn" },
      { label: "∫", action: "NOP", tone: "fn" },
      { label: <span className="text-[10px]">d/dx</span>, action: "NOP", tone: "fn" },
    ],
    [
      { label: "CONV", action: "NOP", tone: "fn" },
      { label: "π", action: "pi", tone: "fn" },
      { label: "e", action: "e", tone: "fn" },
      { label: "Ans", action: "ans", tone: "fn" },
      { label: "MR", action: "MR", tone: "fn" },
      { label: "M+", action: "M+", tone: "fn" },
      { label: "M−", action: "M-", tone: "fn" },
    ],
    [
      { label: "sin", sub: "sin⁻¹", action: "sin", shiftAction: "asin", tone: "fn" },
      { label: "cos", sub: "cos⁻¹", action: "cos", shiftAction: "acos", tone: "fn" },
      { label: "tan", sub: "tan⁻¹", action: "tan", shiftAction: "atan", tone: "fn" },
      { label: "ln", sub: "logₑ", action: "ln", shiftAction: "exp", tone: "fn" },
      { label: "log", sub: "log₁₀", action: "log", tone: "fn" },
      { label: "Abs", sub: "|x|", action: "abs", tone: "fn" },
      { label: "i", action: "i", tone: "fn" },
    ],
    [
      { label: "x⁻¹", action: "inv", tone: "fn" },
      { label: "x²", action: "sq", tone: "fn" },
      { label: "x³", action: "cube", tone: "fn" },
      { label: "√", action: "sqrt", tone: "fn" },
      { label: "∛", action: "cbrt", tone: "fn" },
      { label: "ⁿ√", action: "nroot", tone: "fn" },
      { label: "10ˣ", action: "tenx", tone: "fn" },
    ],
    [
      { label: "eˣ", action: "exp", tone: "fn" },
      { label: "n!", action: "fact", tone: "fn" },
      { label: "nCr", action: "nCr", tone: "fn" },
      { label: "nPr", action: "nPr", tone: "fn" },
      { label: "%", action: "%", tone: "fn" },
      { label: "mod", action: "mod", tone: "fn" },
      { label: "X", action: "x", tone: "fn" },
    ],
    [
      { label: "7", action: "7", tone: "num" },
      { label: "8", action: "8", tone: "num" },
      { label: "9", action: "9", tone: "num" },
      { label: "(", action: "(", tone: "op" },
      { label: ")", action: ")", tone: "op" },
      { label: "÷", action: "÷", tone: "op" },
    ],
    [
      { label: "4", action: "4", tone: "num" },
      { label: "5", action: "5", tone: "num" },
      { label: "6", action: "6", tone: "num" },
      { label: "×", action: "×", tone: "op" },
      { label: "−", action: "−", tone: "op" },
      { label: "+", action: "+", tone: "op" },
    ],
    [
      { label: "1", action: "1", tone: "num" },
      { label: "2", action: "2", tone: "num" },
      { label: "3", action: "3", tone: "num" },
      { label: "0", action: "0", tone: "op" },
      { label: ".", action: ".", tone: "op" },
      { label: "±", action: "neg", tone: "op" },
    ],
    [
      { label: "EXP", action: "EXP", tone: "fn" },
      { label: "%", action: "%", tone: "fn" },
      { label: "RND", action: "rand", tone: "fn" },
      { label: "=", action: "=", tone: "eq", span: 3 },
    ],
  ];
}

function basicRows(): KeyDef[][] {
  return [
    [
      { label: "AC", action: "AC", tone: "ac" },
      { label: "⌫", action: "BKSP", tone: "bk" },
      { label: "ᵃ/ᵇ", action: "frac", tone: "fn" },
      { label: "÷", action: "÷", tone: "op" },
    ],
    [
      { label: "7", action: "7", tone: "num" },
      { label: "8", action: "8", tone: "num" },
      { label: "9", action: "9", tone: "num" },
      { label: "×", action: "×", tone: "op" },
    ],
    [
      { label: "4", action: "4", tone: "num" },
      { label: "5", action: "5", tone: "num" },
      { label: "6", action: "6", tone: "num" },
      { label: "−", action: "−", tone: "op" },
    ],
    [
      { label: "1", action: "1", tone: "num" },
      { label: "2", action: "2", tone: "num" },
      { label: "3", action: "3", tone: "num" },
      { label: "+", action: "+", tone: "op" },
    ],
    [
      { label: "0", action: "0", tone: "num" },
      { label: ".", action: ".", tone: "num" },
      { label: "√", action: "sqrt", tone: "fn" },
      { label: "=", action: "=", tone: "eq" },
    ],
  ];
}

const TONE: Record<Tone, string> = {
  shift:
    "bg-gradient-to-b from-emerald-400 to-emerald-600 text-white shadow-[0_3px_0_0_#065f46] active:shadow-none active:translate-y-[2px]",
  ac: "bg-gradient-to-b from-orange-400 to-orange-600 text-white shadow-[0_3px_0_0_#9a3412] active:shadow-none active:translate-y-[2px]",
  bk: "bg-gradient-to-b from-[#3b5b8a] to-[#1e3a5f] text-white shadow-[0_3px_0_0_#0f172a] active:shadow-none active:translate-y-[2px]",
  fn: "bg-gradient-to-b from-[#2a4a7a] to-[#16325a] text-sky-50 shadow-[0_3px_0_0_#0b1b3a] active:shadow-none active:translate-y-[2px]",
  nav: "bg-gradient-to-b from-[#2a4a7a] to-[#16325a] text-white shadow-[0_3px_0_0_#0b1b3a] active:shadow-none active:translate-y-[2px]",
  num: "bg-gradient-to-b from-[#1a2438] to-[#0c1220] text-white shadow-[0_3px_0_0_#020617] active:shadow-none active:translate-y-[2px]",
  op: "bg-gradient-to-b from-[#2563a8] to-[#1e4a80] text-white shadow-[0_3px_0_0_#0c2a4a] active:shadow-none active:translate-y-[2px]",
  eq: "bg-gradient-to-b from-[#3b82f6] to-[#1d4ed8] text-white font-extrabold shadow-[0_3px_0_0_#1e3a8a] active:shadow-none active:translate-y-[2px]",
};

/* ═══════════════ Component ═══════════════ */

export function ExamCalculator({ open, mode, onClose }: Props) {
  const [atoms, setAtoms] = useState<Atom[]>([]);
  const [cursor, setCursor] = useState<Cursor>(emptyCursor());
  const [result, setResult] = useState("0");
  const [finalized, setFinalized] = useState(false);
  const [error, setError] = useState(false);
  const [angle, setAngle] = useState<AngleMode>("DEG");
  const [shift, setShift] = useState(false);
  const [memory, setMemory] = useState(0);
  const [ans, setAns] = useState(0);
  const [pressed, setPressed] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      setAtoms([]);
      setCursor(emptyCursor());
      setResult("0");
      setFinalized(false);
      setError(false);
      setShift(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onCustom = () => onClose();
    window.addEventListener("d4-close-calculator", onCustom);
    try {
      (window as unknown as { __d4CloseCalc?: () => void }).__d4CloseCalc = onClose;
    } catch {
      /* */
    }
    let handle: { remove: () => Promise<void> } | null = null;
    let cancelled = false;
    if (isNativeShell()) {
      void (async () => {
        try {
          handle = await CapApp.addListener("backButton", () => onClose());
          if (cancelled) await handle?.remove();
        } catch {
          /* */
        }
      })();
    }
    return () => {
      cancelled = true;
      window.removeEventListener("d4-close-calculator", onCustom);
      try {
        delete (window as unknown as { __d4CloseCalc?: () => void }).__d4CloseCalc;
      } catch {
        /* */
      }
      void handle?.remove();
    };
  }, [open, onClose]);

  useEffect(() => {
    if (finalized) return;
    if (!atoms.length) {
      setResult("0");
      setError(false);
      return;
    }
    try {
      const v = evalAtoms(atoms, angle, ans);
      if (Number.isFinite(v)) {
        setResult(formatResult(v));
        setError(false);
      }
    } catch {
      /* */
    }
  }, [atoms, angle, finalized, ans]);

  const apply = useCallback(
    (action: string) => {
      // click feedback
      setPressed(action);
      window.setTimeout(() => setPressed(null), 120);
      try {
        if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(12);
      } catch {
        /* */
      }

      setError(false);
      if (
        finalized &&
        !["=", "AC", "BKSP", "LEFT", "RIGHT", "SHIFT", "DRG", "MR", "M+", "M-", "MENU"].includes(action)
      ) {
        setFinalized(false);
        if (/^[0-9.]$/.test(action)) {
          setAtoms([{ t: "num", v: action }]);
          setCursor(emptyCursor());
          return;
        }
        setAtoms([]);
        setCursor(emptyCursor());
      }

      if (action === "SHIFT") {
        setShift((s) => !s);
        return;
      }
      if (action === "AC") {
        setAtoms([]);
        setCursor(emptyCursor());
        setResult("0");
        setFinalized(false);
        setShift(false);
        return;
      }
      if (action === "BKSP") {
        const r = backspace(atoms, cursor);
        setAtoms(r.atoms);
        setCursor(r.cur);
        setFinalized(false);
        return;
      }
      if (action === "LEFT" || action === "RIGHT") {
        if (atoms.length) {
          const lastIdx = atoms.length - 1;
          const last = atoms[lastIdx]!;
          if (last.t === "frac") {
            setCursor({
              path: [lastIdx],
              slot: action === "RIGHT" ? (cursor.slot === "num" ? "den" : "num") : cursor.slot === "den" ? "num" : "den",
            });
            return;
          }
          if (last.t === "mixed") {
            const order: Slot[] = ["whole", "num", "den"];
            const i = Math.max(0, order.indexOf(cursor.slot));
            const next = order[(i + (action === "RIGHT" ? 1 : 2)) % 3]!;
            setCursor({ path: [lastIdx], slot: next });
            return;
          }
          if (last.t === "sqrt" || last.t === "cbrt" || last.t === "fn") {
            setCursor({ path: [lastIdx], slot: "arg" });
            return;
          }
          if (last.t === "pow") {
            setCursor({ path: [lastIdx], slot: cursor.slot === "exp" ? "base" : "exp" });
            return;
          }
          if (last.t === "nroot") {
            setCursor({ path: [lastIdx], slot: cursor.slot === "n" ? "arg" : "n" });
            return;
          }
        }
        setCursor(emptyCursor());
        return;
      }
      if (action === "DRG") {
        setAngle((a) => (a === "DEG" ? "RAD" : a === "RAD" ? "GRAD" : "DEG"));
        return;
      }
      if (action === "MENU" || action === "NOP") return;
      if (action === "MR") {
        const r = insertAt(atoms, cursor, { t: "num", v: formatResult(memory) });
        setAtoms(r.atoms);
        setCursor(r.cur);
        return;
      }
      if (action === "M+") {
        try {
          const v = evalAtoms(atoms, angle, ans);
          if (Number.isFinite(v)) setMemory((m) => m + v);
        } catch {
          /* */
        }
        return;
      }
      if (action === "M-") {
        try {
          const v = evalAtoms(atoms, angle, ans);
          if (Number.isFinite(v)) setMemory((m) => m - v);
        } catch {
          /* */
        }
        return;
      }
      if (action === "=") {
        try {
          const v = evalAtoms(atoms, angle, ans);
          if (!Number.isFinite(v)) {
            setError(true);
            setResult("Error");
            return;
          }
          setAns(v);
          setResult(formatResult(v));
          setFinalized(true);
          setAtoms([{ t: "num", v: formatResult(v) }]);
          setCursor(emptyCursor());
        } catch {
          setError(true);
          setResult("Error");
        }
        return;
      }
      if (action === "rand") {
        const r = insertAt(atoms, cursor, { t: "num", v: Math.random().toFixed(6) });
        setAtoms(r.atoms);
        setCursor(r.cur);
        return;
      }
      if (action === "neg") {
        const list = [...getListAt(atoms, cursor)];
        if (list.length && list[list.length - 1]!.t === "num") {
          const n = list[list.length - 1] as { t: "num"; v: string };
          n.v = n.v.startsWith("-") ? n.v.slice(1) : `-${n.v}`;
          setAtoms(setListAt(atoms, cursor, list));
        } else {
          const r = insertAt(atoms, cursor, { t: "op", v: "−" });
          setAtoms(r.atoms);
          setCursor(r.cur);
        }
        return;
      }
      if (action === "EXP") {
        // ×10^
        let r = insertAt(atoms, cursor, { t: "op", v: "×" });
        r = insertAt(r.atoms, r.cur, { t: "fn", name: "10^", arg: [] });
        setAtoms(r.atoms);
        setCursor(r.cur);
        setShift(false);
        return;
      }

      let item: Atom | null = null;
      if (/^[0-9]$/.test(action)) item = { t: "num", v: action };
      else if (action === ".") item = { t: "num", v: "." };
      else if (["+", "−", "×", "÷"].includes(action)) item = { t: "op", v: action };
      else if (action === "(") item = { t: "lparen" };
      else if (action === ")") item = { t: "rparen" };
      else if (action === "%") item = { t: "pct" };
      else if (action === "fact") item = { t: "fact" };
      else if (action === "pi") item = { t: "pi" };
      else if (action === "e") item = { t: "e" };
      else if (action === "ans") item = { t: "ans" };
      else if (action === "x") item = { t: "x" };
      else if (action === "i") item = { t: "i" };
      else if (action === "frac") item = { t: "frac", num: [], den: [] };
      else if (action === "mixed") item = { t: "mixed", whole: [], num: [], den: [] };
      else if (action === "sqrt") item = { t: "sqrt", arg: [] };
      else if (action === "cbrt") item = { t: "cbrt", arg: [] };
      else if (action === "nroot") item = { t: "nroot", n: [], arg: [] };
      else if (action === "pow") item = { t: "pow", base: [], exp: [] };
      else if (action === "sq") item = { t: "sq", base: [] };
      else if (action === "cube") item = { t: "cube", base: [] };
      else if (action === "inv") item = { t: "inv", base: [] };
      else if (
        ["sin", "cos", "tan", "asin", "acos", "atan", "ln", "log", "abs", "exp"].includes(action)
      )
        item = { t: "fn", name: action === "log" ? "log" : action, arg: [] };
      else if (action === "tenx") item = { t: "fn", name: "10^", arg: [] };
      else if (action === "nCr") item = { t: "nCr", n: [], r: [] };
      else if (action === "nPr") item = { t: "nPr", n: [], r: [] };
      else if (action === "mod") item = { t: "mod", a: [], b: [] };
      else return;

      const r = insertAt(atoms, cursor, item);
      setAtoms(r.atoms);
      setCursor(r.cur);
      setShift(false);
      requestAnimationFrame(() => {
        const el = scrollRef.current;
        if (el) el.scrollLeft = el.scrollWidth;
      });
    },
    [atoms, cursor, finalized, angle, ans, memory],
  );

  const rows = useMemo(() => (mode === "basic" ? basicRows() : scientificRows()), [mode]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[2147483000] flex flex-col overflow-hidden"
      style={{
        background: "linear-gradient(180deg, #0a1628 0%, #0b1b3a 40%, #07101f 100%)",
        paddingTop: "env(safe-area-inset-top, 0px)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        paddingLeft: "env(safe-area-inset-left, 0px)",
        paddingRight: "env(safe-area-inset-right, 0px)",
      }}
      role="dialog"
      aria-modal
      aria-label="Scientific Calculator"
    >
      {/* Header */}
      <header className="flex shrink-0 items-center justify-between gap-2 px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-sky-500/15 ring-1 ring-sky-400/40">
            <CalcIcon className="h-5 w-5 text-sky-400" />
          </div>
          <div className="min-w-0">
            <p className="text-[15px] font-extrabold leading-tight tracking-wide text-white">
              D<span className="text-sky-400">4</span>EXAM
            </p>
            <p className="text-[10px] font-semibold tracking-wide text-slate-400">
              {mode === "scientific" ? "Scientific Calculator" : "Calculator"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => apply("DRG")}
            className="rounded-full bg-sky-500 px-2.5 py-1 text-[10px] font-bold text-white shadow-md shadow-sky-900/40"
          >
            {angle}
          </button>
          {memory !== 0 ? (
            <span className="rounded-full bg-sky-600/80 px-2 py-1 text-[10px] font-bold text-white">M</span>
          ) : (
            <span className="rounded-full bg-white/10 px-2 py-1 text-[10px] font-bold text-slate-400">M</span>
          )}
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20 active:scale-95"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Display */}
      <div
        ref={scrollRef}
        className="mx-3 shrink-0 overflow-x-auto rounded-2xl border border-sky-500/20 bg-[#050d1a] px-3.5 py-3 shadow-[inset_0_2px_12px_rgba(0,0,0,0.55)]"
        style={{ minHeight: "6.75rem" }}
        onClick={() => setCursor(emptyCursor())}
      >
        <div className="min-h-[2.4rem] whitespace-nowrap text-left">
          {atoms.length === 0 ? (
            <span className="inline-flex items-center">
              <Caret on />
            </span>
          ) : (
            <AtomRow atoms={atoms} cursor={cursor} onCursor={setCursor} />
          )}
        </div>
        <div
          className={cn(
            "mt-2 text-right font-mono text-[2rem] font-extrabold tabular-nums leading-none sm:text-[2.35rem]",
            error ? "text-red-400" : "text-white",
          )}
        >
          {result}
        </div>
      </div>

      {shift ? (
        <div className="px-3 pt-1 text-center text-[10px] font-bold tracking-widest text-emerald-400">
          SHIFT
        </div>
      ) : (
        <div className="h-3" />
      )}

      {/* Keypad */}
      <div className="flex min-h-0 flex-1 flex-col gap-[5px] overflow-y-auto px-2.5 pb-2.5 pt-0.5">
        {rows.map((row, ri) => {
          const cols = row.reduce((a, k) => a + (k.span || 1), 0);
          return (
            <div
              key={ri}
              className="grid flex-1 gap-[5px]"
              style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
            >
              {row.map((k, ki) => {
                const useShift = Boolean(shift && k.shiftAction);
                const act = useShift && k.shiftAction ? k.shiftAction : k.action;
                const isPressed = pressed === act || pressed === k.action;
                return (
                  <button
                    key={`${ri}-${ki}`}
                    type="button"
                    onClick={() => apply(act)}
                    className={cn(
                      "relative flex min-h-[2.4rem] flex-col items-center justify-center rounded-[12px] text-[13px] font-semibold transition-transform duration-75 sm:text-[14px]",
                      TONE[k.tone],
                      k.tone === "shift" && shift && "from-emerald-300 to-emerald-500 ring-2 ring-emerald-200/50",
                      isPressed && "scale-[0.96] brightness-110",
                    )}
                    style={k.span ? { gridColumn: `span ${k.span}` } : undefined}
                  >
                    <span className="leading-none">{useShift && k.sub ? k.sub : k.label}</span>
                    {!useShift && k.sub ? (
                      <span className="mt-0.5 text-[8px] font-medium leading-none text-sky-200/70">{k.sub}</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>,
    document.body,
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
        "fixed z-[2147482500] grid h-12 w-12 place-items-center rounded-full bg-[#2563eb] text-white shadow-lg shadow-blue-900/40 transition hover:bg-[#1d4ed8] active:scale-95",
        "left-[max(0.75rem,env(safe-area-inset-left))]",
        "bottom-[max(0.75rem,env(safe-area-inset-bottom))]",
      )}
    >
      <CalcIcon className="h-5 w-5" />
    </button>
  );
}
