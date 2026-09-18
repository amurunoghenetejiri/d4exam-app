/**
 * D4EXAM natural-entry scientific calculator.
 * Visual math structures (stacked fractions, radicals, superscripts) — not plain text.
 * Navy D4EXAM branding; layout inspired by advanced scientific calculators.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Calculator as CalcIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { App as CapApp } from "@capacitor/app";
import { isNativeShell } from "@/native/platform";

export type CalculatorMode = "basic" | "scientific";
type AngleMode = "DEG" | "RAD" | "GRAD";
type Props = { open: boolean; mode: CalculatorMode; onClose: () => void };

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
  | { t: "logb"; base: Atom[]; arg: Atom[] };

type Cursor = { path: number[]; slot: "main" | "num" | "den" | "whole" | "arg" | "exp" | "n" | "base" };

function emptyCursor(): Cursor {
  return { path: [], slot: "main" };
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
function formatResult(v: number): string {
  if (!Number.isFinite(v)) return "Error";
  if (Object.is(v, -0)) return "0";
  if (Number.isInteger(v) && Math.abs(v) < 1e15) return String(v);
  const abs = Math.abs(v);
  if (abs !== 0 && (abs >= 1e12 || abs < 1e-9)) return v.toExponential(6).replace(/\.?0+e/, "e");
  return Number(v.toPrecision(12)).toString();
}
function factorial(n: number): number {
  if (n < 0 || !Number.isInteger(n) || n > 170) return NaN;
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

function evalAtoms(atoms: Atom[], angle: AngleMode, ans: number): number {
  const tokens: string[] = [];
  const emit = (a: Atom[]) => {
    for (const node of a) {
      switch (node.t) {
        case "num": tokens.push(node.v || "0"); break;
        case "op": tokens.push(node.v); break;
        case "lparen": tokens.push("("); break;
        case "rparen": tokens.push(")"); break;
        case "pi": tokens.push(String(Math.PI)); break;
        case "e": tokens.push(String(Math.E)); break;
        case "ans": tokens.push(String(ans)); break;
        case "x": case "i": tokens.push("0"); break;
        case "pct": tokens.push("%"); break;
        case "fact": tokens.push("!"); break;
        case "fn": {
          const arg = evalAtoms(node.arg, angle, ans);
          let v = NaN;
          const name = node.name;
          if (name === "sin") v = Math.sin(toRad(arg, angle));
          else if (name === "cos") v = Math.cos(toRad(arg, angle));
          else if (name === "tan") v = Math.tan(toRad(arg, angle));
          else if (name === "asin") v = fromRad(Math.asin(arg), angle);
          else if (name === "acos") v = fromRad(Math.acos(arg), angle);
          else if (name === "atan") v = fromRad(Math.atan(arg), angle);
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
          tokens.push(String(Math.sqrt(evalAtoms(node.arg.length ? node.arg : [{ t: "num", v: "0" }], angle, ans))));
          break;
        case "cbrt":
          tokens.push(String(Math.cbrt(evalAtoms(node.arg.length ? node.arg : [{ t: "num", v: "0" }], angle, ans))));
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
        case "logb": {
          const b = evalAtoms(node.base.length ? node.base : [{ t: "num", v: "10" }], angle, ans);
          const a = evalAtoms(node.arg.length ? node.arg : [{ t: "num", v: "1" }], angle, ans);
          tokens.push(String(Math.log(a) / Math.log(b)));
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
    if (t === "%") { expanded.push("/", "100"); continue; }
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
        ops.length && ops[ops.length - 1] !== "(" && prec[ops[ops.length - 1]!] != null &&
        (right[t] ? prec[ops[ops.length - 1]!]! > prec[t]! : prec[ops[ops.length - 1]!]! >= prec[t]!)
      ) out.push(ops.pop()!);
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

function getListAt(atoms: Atom[], cur: Cursor): Atom[] {
  if (cur.path.length === 0) return atoms;
  const idx = cur.path[0]!;
  const node = atoms[idx];
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
  if (node.t === "inv" || node.t === "sq") return node.base;
  if (node.t === "logb") return cur.slot === "base" ? node.base : node.arg;
  return atoms;
}

function setListAt(atoms: Atom[], cur: Cursor, nextList: Atom[]): Atom[] {
  if (cur.path.length === 0) return nextList;
  const clone = structuredClone(atoms) as Atom[];
  const idx = cur.path[0]!;
  const node = clone[idx];
  if (!node) return atoms;
  if (node.t === "frac") {
    if (cur.slot === "den") node.den = nextList; else node.num = nextList;
  } else if (node.t === "mixed") {
    if (cur.slot === "whole") node.whole = nextList;
    else if (cur.slot === "den") node.den = nextList;
    else node.num = nextList;
  } else if (node.t === "sqrt" || node.t === "cbrt" || node.t === "fn") node.arg = nextList;
  else if (node.t === "nroot") {
    if (cur.slot === "n") node.n = nextList; else node.arg = nextList;
  } else if (node.t === "pow") {
    if (cur.slot === "exp") node.exp = nextList; else node.base = nextList;
  } else if (node.t === "inv" || node.t === "sq") node.base = nextList;
  else if (node.t === "logb") {
    if (cur.slot === "base") node.base = nextList; else node.arg = nextList;
  }
  return clone;
}

function insertAt(atoms: Atom[], cur: Cursor, item: Atom): { atoms: Atom[]; cur: Cursor } {
  const list = [...getListAt(atoms, cur)];
  if (item.t === "frac") {
    list.push(item);
    return { atoms: setListAt(atoms, cur, list), cur: { path: cur.path.length ? cur.path : [list.length - 1], slot: "num" } };
  }
  if (item.t === "mixed") {
    list.push(item);
    return { atoms: setListAt(atoms, cur, list), cur: { path: [list.length - 1], slot: "num" } };
  }
  if (item.t === "sqrt" || item.t === "cbrt") {
    list.push(item);
    return { atoms: setListAt(atoms, cur, list), cur: { path: [list.length - 1], slot: "arg" } };
  }
  if (item.t === "nroot") {
    list.push(item);
    return { atoms: setListAt(atoms, cur, list), cur: { path: [list.length - 1], slot: "n" } };
  }
  if (item.t === "pow" || item.t === "sq" || item.t === "inv") {
    if (list.length && (list[list.length - 1]!.t === "num" || list[list.length - 1]!.t === "rparen")) {
      const base = [list.pop()!];
      if (item.t === "pow") {
        list.push({ t: "pow", base, exp: [] });
        return { atoms: setListAt(atoms, cur, list), cur: { path: [list.length - 1], slot: "exp" } };
      }
      if (item.t === "sq") { list.push({ t: "sq", base }); return { atoms: setListAt(atoms, cur, list), cur }; }
      if (item.t === "inv") { list.push({ t: "inv", base }); return { atoms: setListAt(atoms, cur, list), cur }; }
    }
    list.push(item);
    const next = setListAt(atoms, cur, list);
    if (item.t === "pow") return { atoms: next, cur: { path: [list.length - 1], slot: "exp" } };
    return { atoms: next, cur };
  }
  if (item.t === "fn" || item.t === "logb") {
    list.push(item);
    return { atoms: setListAt(atoms, cur, list), cur: { path: [list.length - 1], slot: "arg" } };
  }
  if (item.t === "num" && list.length && list[list.length - 1]!.t === "num") {
    const last = list[list.length - 1] as { t: "num"; v: string };
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

function Caret({ on }: { on: boolean }) {
  if (!on) return null;
  return <span className="mx-[1px] inline-block h-[1.1em] w-[2px] animate-pulse bg-[#60a5fa] align-middle" aria-hidden />;
}

function SlotBox({ atoms, active, onFocus, minW = "0.9em" }: { atoms: Atom[]; active: boolean; onFocus: () => void; minW?: string }) {
  return (
    <button type="button" onClick={(e) => { e.stopPropagation(); onFocus(); }}
      className={cn("inline-flex min-h-[1.15em] items-center justify-center rounded-sm border border-dashed px-0.5 align-middle text-[inherit] leading-none",
        active ? "border-[#60a5fa] bg-[#1e3a5f]/80" : "border-white/25 bg-transparent")}
      style={{ minWidth: minW }}>
      {atoms.length === 0 ? (<><Caret on={active} /><span className="opacity-30">□</span></>) : (
        <><AtomRow atoms={atoms} cursor={active ? emptyCursor() : null} onCursor={() => onFocus()} /><Caret on={active} /></>
      )}
    </button>
  );
}

function AtomRow({ atoms, cursor, onCursor, pathPrefix = [] }: { atoms: Atom[]; cursor: Cursor | null; onCursor: (c: Cursor) => void; pathPrefix?: number[] }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-[1px] font-serif text-[1.05em] leading-tight text-white">
      {atoms.map((node, i) => (
        <AtomView key={i} node={node} index={i} cursor={cursor} pathPrefix={pathPrefix} onCursor={onCursor} />
      ))}
      {cursor && cursor.path.length === pathPrefix.length && cursor.slot === "main" ? <Caret on /> : null}
    </span>
  );
}

function AtomView({ node, index, cursor, pathPrefix, onCursor }: { node: Atom; index: number; cursor: Cursor | null; pathPrefix: number[]; onCursor: (c: Cursor) => void }) {
  const path = [...pathPrefix, index];
  const active = (slot: Cursor["slot"]) =>
    Boolean(cursor && cursor.path.length === path.length && path.every((p, j) => cursor!.path[j] === p) && cursor.slot === slot);

  switch (node.t) {
    case "num": return <span className="tabular-nums">{node.v}</span>;
    case "op": return <span className="mx-0.5 opacity-90">{node.v}</span>;
    case "lparen": return <span>(</span>;
    case "rparen": return <span>)</span>;
    case "pi": return <span className="italic">π</span>;
    case "e": return <span className="italic">e</span>;
    case "ans": return <span className="text-[0.85em] font-sans font-semibold text-sky-300">Ans</span>;
    case "x": return <span className="italic">x</span>;
    case "i": return <span className="italic">i</span>;
    case "pct": return <span>%</span>;
    case "fact": return <span>!</span>;
    case "frac":
      return (
        <span className="mx-0.5 inline-flex flex-col items-center align-middle text-[0.92em] leading-none">
          <SlotBox atoms={node.num} active={active("num")} onFocus={() => onCursor({ path, slot: "num" })} />
          <span className="my-[1px] h-[1.5px] w-full min-w-[1.4em] bg-white/90" />
          <SlotBox atoms={node.den} active={active("den")} onFocus={() => onCursor({ path, slot: "den" })} />
        </span>
      );
    case "mixed":
      return (
        <span className="mx-0.5 inline-flex items-center gap-0.5 align-middle">
          <SlotBox atoms={node.whole} active={active("whole")} onFocus={() => onCursor({ path, slot: "whole" })} minW="0.7em" />
          <span className="inline-flex flex-col items-center text-[0.88em] leading-none">
            <SlotBox atoms={node.num} active={active("num")} onFocus={() => onCursor({ path, slot: "num" })} />
            <span className="my-[1px] h-[1.5px] w-full min-w-[1.2em] bg-white/90" />
            <SlotBox atoms={node.den} active={active("den")} onFocus={() => onCursor({ path, slot: "den" })} />
          </span>
        </span>
      );
    case "sqrt":
      return (
        <span className="mx-0.5 inline-flex items-stretch align-middle">
          <span className="self-end pb-0.5 pr-0.5 text-[1.15em] leading-none">√</span>
          <span className="inline-flex flex-col border-t-2 border-white/90 pt-0.5">
            <SlotBox atoms={node.arg} active={active("arg")} onFocus={() => onCursor({ path, slot: "arg" })} minW="1.2em" />
          </span>
        </span>
      );
    case "cbrt":
      return (
        <span className="mx-0.5 inline-flex items-stretch align-middle">
          <span className="relative self-end pb-0.5 pr-0.5 text-[1.15em] leading-none">
            <sup className="absolute -left-1.5 top-0 text-[0.55em]">3</sup>√
          </span>
          <span className="inline-flex flex-col border-t-2 border-white/90 pt-0.5">
            <SlotBox atoms={node.arg} active={active("arg")} onFocus={() => onCursor({ path, slot: "arg" })} minW="1.2em" />
          </span>
        </span>
      );
    case "nroot":
      return (
        <span className="mx-0.5 inline-flex items-stretch align-middle">
          <span className="relative self-end pb-0.5 pr-0.5 text-[1.15em] leading-none">
            <span className="absolute -left-2 top-0 scale-90">
              <SlotBox atoms={node.n} active={active("n")} onFocus={() => onCursor({ path, slot: "n" })} minW="0.6em" />
            </span>√
          </span>
          <span className="inline-flex flex-col border-t-2 border-white/90 pt-0.5">
            <SlotBox atoms={node.arg} active={active("arg")} onFocus={() => onCursor({ path, slot: "arg" })} minW="1.2em" />
          </span>
        </span>
      );
    case "pow":
      return (
        <span className="mx-0.5 inline-flex items-start align-middle">
          <SlotBox atoms={node.base} active={active("base")} onFocus={() => onCursor({ path, slot: "base" })} minW="0.7em" />
          <sup className="ml-0.5 text-[0.72em]">
            <SlotBox atoms={node.exp} active={active("exp")} onFocus={() => onCursor({ path, slot: "exp" })} minW="0.6em" />
          </sup>
        </span>
      );
    case "sq":
      return (
        <span className="mx-0.5 inline-flex items-start">
          <SlotBox atoms={node.base} active={active("base")} onFocus={() => onCursor({ path, slot: "base" })} minW="0.7em" />
          <sup className="text-[0.72em]">2</sup>
        </span>
      );
    case "inv":
      return (
        <span className="mx-0.5 inline-flex items-start">
          <SlotBox atoms={node.base} active={active("base")} onFocus={() => onCursor({ path, slot: "base" })} minW="0.7em" />
          <sup className="text-[0.72em]">−1</sup>
        </span>
      );
    case "fn":
      return (
        <span className="mx-0.5 inline-flex items-center font-sans text-[0.9em]">
          <span className="mr-0.5">{node.name}</span>(
          <SlotBox atoms={node.arg} active={active("arg")} onFocus={() => onCursor({ path, slot: "arg" })} />)
        </span>
      );
    case "logb":
      return (
        <span className="mx-0.5 inline-flex items-end font-sans text-[0.9em]">
          <span>log<sub className="ml-0.5">
            <SlotBox atoms={node.base} active={active("base")} onFocus={() => onCursor({ path, slot: "base" })} minW="0.55em" />
          </sub></span>(
          <SlotBox atoms={node.arg} active={active("arg")} onFocus={() => onCursor({ path, slot: "arg" })} />)
        </span>
      );
    default: return null;
  }
}

type KeyDef = { label: ReactNode; shiftLabel?: ReactNode; action: string; shiftAction?: string; tone?: "shift" | "ac" | "fn" | "num" | "op" | "eq" | "nav" };

function sciKeys(): KeyDef[][] {
  return [
    [
      { label: "SHIFT", action: "SHIFT", tone: "shift" },
      { label: "MENU", action: "MENU", tone: "fn" },
      { label: "◀", action: "LEFT", tone: "nav" },
      { label: "▶", action: "RIGHT", tone: "nav" },
      { label: "⌫", action: "BKSP", tone: "ac" },
      { label: "AC", action: "AC", tone: "ac" },
    ],
    [
      { label: "DRG", action: "DRG", tone: "fn" },
      { label: "π", action: "pi", tone: "fn" },
      { label: "e", action: "e", tone: "fn" },
      { label: "Ans", action: "ans", tone: "fn" },
      { label: "MR", action: "MR", tone: "fn" },
      { label: "M+", action: "M+", tone: "fn" },
    ],
    [
      { label: "sin", shiftLabel: "sin⁻¹", action: "sin", shiftAction: "asin", tone: "fn" },
      { label: "cos", shiftLabel: "cos⁻¹", action: "cos", shiftAction: "acos", tone: "fn" },
      { label: "tan", shiftLabel: "tan⁻¹", action: "tan", shiftAction: "atan", tone: "fn" },
      { label: "ln", shiftLabel: "eˣ", action: "ln", shiftAction: "exp", tone: "fn" },
      { label: "log", shiftLabel: "logₓ", action: "log", shiftAction: "logb", tone: "fn" },
      { label: "Abs", action: "abs", tone: "fn" },
    ],
    [
      { label: "x⁻¹", action: "inv", tone: "fn" },
      { label: "x²", action: "sq", tone: "fn" },
      { label: "√", action: "sqrt", tone: "fn" },
      { label: "xʸ", action: "pow", tone: "fn" },
      { label: "∛", action: "cbrt", tone: "fn" },
      { label: "ⁿ√", action: "nroot", tone: "fn" },
    ],
    [
      { label: "x³", action: "cube", tone: "fn" },
      { label: "10ˣ", action: "tenx", tone: "fn" },
      { label: "aᵇ/ᶜ", action: "mixed", tone: "fn" },
      { label: "ᵃ/ᵇ", action: "frac", tone: "fn" },
      { label: "n!", action: "fact", tone: "fn" },
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
      { label: "0", action: "0", tone: "num" },
      { label: ".", action: ".", tone: "num" },
      { label: "±", action: "neg", tone: "num" },
    ],
    [
      { label: "EXP", action: "EXP", tone: "fn" },
      { label: "%", action: "%", tone: "fn" },
      { label: "ran#", action: "rand", tone: "fn" },
      { label: "M−", action: "M-", tone: "fn" },
      { label: "=", action: "=", tone: "eq" },
    ],
  ];
}

function basicKeys(): KeyDef[][] {
  return [
    [
      { label: "AC", action: "AC", tone: "ac" },
      { label: "⌫", action: "BKSP", tone: "ac" },
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
    try { (window as unknown as { __d4CloseCalc?: () => void }).__d4CloseCalc = onClose; } catch { /* */ }
    let handle: { remove: () => Promise<void> } | null = null;
    let cancelled = false;
    if (isNativeShell()) {
      void (async () => {
        try {
          handle = await CapApp.addListener("backButton", () => onClose());
          if (cancelled) await handle?.remove();
        } catch { /* */ }
      })();
    }
    return () => {
      cancelled = true;
      window.removeEventListener("d4-close-calculator", onCustom);
      try { delete (window as unknown as { __d4CloseCalc?: () => void }).__d4CloseCalc; } catch { /* */ }
      void handle?.remove();
    };
  }, [open, onClose]);

  useEffect(() => {
    if (finalized) return;
    if (!atoms.length) { setResult("0"); setError(false); return; }
    try {
      const v = evalAtoms(atoms, angle, ans);
      if (Number.isFinite(v)) { setResult(formatResult(v)); setError(false); }
    } catch { /* */ }
  }, [atoms, angle, finalized, ans]);

  const apply = useCallback((action: string) => {
    setError(false);
    if (finalized && !["=", "AC", "BKSP", "LEFT", "RIGHT", "SHIFT", "DRG", "MR", "M+", "M-", "MENU"].includes(action)) {
      setFinalized(false);
      if (/^[0-9.]$/.test(action)) {
        setAtoms([{ t: "num", v: action }]);
        setCursor(emptyCursor());
        return;
      }
      setAtoms([]);
      setCursor(emptyCursor());
    }
    if (action === "SHIFT") { setShift((s) => !s); return; }
    if (action === "AC") {
      setAtoms([]); setCursor(emptyCursor()); setResult("0"); setFinalized(false); setShift(false); return;
    }
    if (action === "BKSP") {
      const r = backspace(atoms, cursor); setAtoms(r.atoms); setCursor(r.cur); setFinalized(false); return;
    }
    if (action === "LEFT" || action === "RIGHT") {
      if (atoms.length) {
        const last = atoms[atoms.length - 1]!;
        if (last.t === "frac") {
          setCursor({ path: [atoms.length - 1], slot: action === "RIGHT" ? (cursor.slot === "num" ? "den" : "num") : (cursor.slot === "den" ? "num" : "den") });
          return;
        }
        if (last.t === "mixed") {
          const order: Cursor["slot"][] = ["whole", "num", "den"];
          const i = Math.max(0, order.indexOf(cursor.slot));
          const next = order[(i + (action === "RIGHT" ? 1 : order.length - 1)) % order.length]!;
          setCursor({ path: [atoms.length - 1], slot: next });
          return;
        }
        if (last.t === "sqrt" || last.t === "cbrt" || last.t === "fn") {
          setCursor({ path: [atoms.length - 1], slot: "arg" }); return;
        }
        if (last.t === "pow") {
          setCursor({ path: [atoms.length - 1], slot: cursor.slot === "exp" ? "base" : "exp" }); return;
        }
      }
      setCursor(emptyCursor());
      return;
    }
    if (action === "DRG") { setAngle((a) => (a === "DEG" ? "RAD" : a === "RAD" ? "GRAD" : "DEG")); return; }
    if (action === "MENU" || action === "NOP") return;
    if (action === "MR") {
      const r = insertAt(atoms, cursor, { t: "num", v: formatResult(memory) }); setAtoms(r.atoms); setCursor(r.cur); return;
    }
    if (action === "M+") {
      try { const v = evalAtoms(atoms, angle, ans); if (Number.isFinite(v)) setMemory((m) => m + v); } catch { /* */ } return;
    }
    if (action === "M-") {
      try { const v = evalAtoms(atoms, angle, ans); if (Number.isFinite(v)) setMemory((m) => m - v); } catch { /* */ } return;
    }
    if (action === "=") {
      try {
        const v = evalAtoms(atoms, angle, ans);
        if (!Number.isFinite(v)) { setError(true); setResult("Error"); return; }
        setAns(v); setResult(formatResult(v)); setFinalized(true);
        setAtoms([{ t: "num", v: formatResult(v) }]); setCursor(emptyCursor());
      } catch { setError(true); setResult("Error"); }
      return;
    }
    if (action === "rand") {
      const r = insertAt(atoms, cursor, { t: "num", v: Math.random().toFixed(6) }); setAtoms(r.atoms); setCursor(r.cur); return;
    }
    if (action === "neg") {
      const list = [...getListAt(atoms, cursor)];
      if (list.length && list[list.length - 1]!.t === "num") {
        const n = list[list.length - 1] as { t: "num"; v: string };
        n.v = n.v.startsWith("-") ? n.v.slice(1) : "-" + n.v;
        setAtoms(setListAt(atoms, cursor, list));
      } else {
        const r = insertAt(atoms, cursor, { t: "op", v: "−" }); setAtoms(r.atoms); setCursor(r.cur);
      }
      return;
    }
    if (action === "cube") {
      const list = [...getListAt(atoms, cursor)];
      let base: Atom[] = [];
      if (list.length) base = [list.pop()!];
      list.push({ t: "pow", base: base.length ? base : [{ t: "num", v: "" }], exp: [{ t: "num", v: "3" }] });
      setAtoms(setListAt(atoms, cursor, list)); setCursor(emptyCursor()); return;
    }
    if (action === "mixed") {
      const list = [...getListAt(atoms, cursor)];
      let whole: Atom[] = [];
      if (list.length && list[list.length - 1]!.t === "num") whole = [list.pop()!];
      list.push({ t: "mixed", whole, num: [], den: [] });
      setAtoms(setListAt(atoms, cursor, list));
      setCursor({ path: [list.length - 1], slot: "num" });
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
    else if (action === "sqrt") item = { t: "sqrt", arg: [] };
    else if (action === "cbrt") item = { t: "cbrt", arg: [] };
    else if (action === "nroot") item = { t: "nroot", n: [], arg: [] };
    else if (action === "pow") item = { t: "pow", base: [], exp: [] };
    else if (action === "sq") item = { t: "sq", base: [] };
    else if (action === "inv") item = { t: "inv", base: [] };
    else if (["sin","cos","tan","asin","acos","atan","ln","log","abs","exp"].includes(action))
      item = { t: "fn", name: action === "log" ? "log" : action, arg: [] };
    else if (action === "tenx") item = { t: "fn", name: "10^", arg: [] };
    else if (action === "logb") item = { t: "logb", base: [], arg: [] };
    else if (action === "EXP") item = { t: "op", v: "×" };
    else return;

    const r = insertAt(atoms, cursor, item);
    setAtoms(r.atoms); setCursor(r.cur); setShift(false);
    requestAnimationFrame(() => { const el = scrollRef.current; if (el) el.scrollLeft = el.scrollWidth; });
  }, [atoms, cursor, finalized, angle, ans, memory]);

  const rows = useMemo(() => (mode === "basic" ? basicKeys() : sciKeys()), [mode]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[2147483000] flex flex-col bg-[#0b1b3a] text-white"
      style={{ paddingTop: "env(safe-area-inset-top, 0px)", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      role="dialog" aria-modal aria-label="Calculator">
      <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-3 py-2">
        <div className="flex items-center gap-2">
          <CalcIcon className="h-5 w-5 text-sky-400" />
          <span className="text-sm font-extrabold tracking-wide">Calculator</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded bg-white/10 px-2 py-0.5 text-[10px] font-bold tracking-wider text-sky-200">{angle}</span>
          {memory !== 0 ? <span className="rounded bg-white/10 px-2 py-0.5 text-[10px] font-bold text-amber-200">M</span> : null}
          {shift ? <span className="rounded bg-emerald-600/90 px-2 py-0.5 text-[10px] font-bold">SHIFT</span> : null}
          <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-white/10 hover:bg-white/20" aria-label="Close calculator">
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="shrink-0 overflow-x-auto border-b border-white/10 bg-[#071428] px-3 py-4"
        style={{ minHeight: "7.5rem" }} onClick={() => setCursor(emptyCursor())}>
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Expression</div>
        <div className="min-h-[2.5rem] whitespace-nowrap">
          {atoms.length === 0 ? (
            <span className="inline-flex items-center text-white/40"><Caret on /><span className="ml-1 text-sm">Enter expression</span></span>
          ) : (
            <AtomRow atoms={atoms} cursor={cursor} onCursor={setCursor} />
          )}
        </div>
        <div className={cn("mt-3 text-right font-mono text-3xl font-extrabold tabular-nums sm:text-4xl", error ? "text-red-400" : "text-white")}>{result}</div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-2">
        {rows.map((row, ri) => (
          <div key={ri} className="grid flex-1 gap-1" style={{ gridTemplateColumns: `repeat(${row.length}, minmax(0, 1fr))` }}>
            {row.map((k, ki) => {
              const useShift = shift && k.shiftAction;
              const label = useShift && k.shiftLabel ? k.shiftLabel : k.label;
              const act = useShift && k.shiftAction ? k.shiftAction : k.action;
              return (
                <button key={`${ri}-${ki}`} type="button" onClick={() => apply(act)}
                  className={cn(
                    "min-h-[2.35rem] rounded-lg text-[12px] font-semibold shadow-md transition active:translate-y-px sm:text-[13px]",
                    k.tone === "shift" && (shift ? "bg-emerald-500 text-white" : "bg-emerald-700/80 text-white"),
                    k.tone === "ac" && "bg-amber-600 text-white",
                    k.tone === "fn" && "border border-white/10 bg-[#1a3358] text-slate-100",
                    k.tone === "nav" && "bg-[#243b5c] text-white",
                    k.tone === "num" && "border border-white/10 bg-[#0a0f18] text-white",
                    k.tone === "op" && "bg-[#2a4060] text-white",
                    k.tone === "eq" && "bg-[#2563eb] font-extrabold text-white",
                    !k.tone && "bg-[#1a3358] text-white",
                  )}>
                  {label}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>,
    document.body,
  );
}

export function ExamCalculatorFab({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label="Calculator" title="Calculator"
      className={cn(
        "fixed z-[2147482500] grid h-12 w-12 place-items-center rounded-full bg-[#2563eb] text-white shadow-lg shadow-blue-900/40 hover:bg-[#1d4ed8] active:scale-95",
        "left-[max(0.75rem,env(safe-area-inset-left))]",
        "bottom-[max(0.75rem,env(safe-area-inset-bottom))]",
      )}>
      <CalcIcon className="h-5 w-5" />
    </button>
  );
}
