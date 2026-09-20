import { useEffect, useState } from "react";
import { messagesEn } from "./messages-en";
import { messagesFr } from "./messages-fr";
import { LOCALES, isLocale, type LocaleCode } from "./locales";

const catalogs: Record<string, Record<string, string>> = {
  en: messagesEn,
  fr: messagesFr,
  es: messagesEn,
  ar: messagesEn,
  pt: messagesEn,
  de: messagesEn,
  zh: messagesEn,
  ja: messagesEn,
  ko: messagesEn,
  hi: messagesEn,
  sw: messagesEn,
  yo: messagesEn,
};

let currentLocale: LocaleCode = "en";
const listeners = new Set<() => void>();

export function getLocale(): LocaleCode {
  return currentLocale;
}

export function applyDocumentLocale(code: LocaleCode = currentLocale) {
  if (typeof document === "undefined") return;
  const meta = LOCALES.find((l) => l.code === code);
  document.documentElement.lang = code;
  document.documentElement.dir = meta?.dir === "rtl" ? "rtl" : "ltr";
}

export function setLocale(code: string) {
  const next: LocaleCode = isLocale(code) ? code : "en";
  currentLocale = next;
  applyDocumentLocale(next);
  listeners.forEach((l) => l());
}

export function subscribeLocale(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function t(key: string, vars?: Record<string, string | number>): string {
  const table = catalogs[currentLocale] || messagesEn;
  let s = table[key] ?? messagesEn[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      s = s.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
    }
  }
  return s;
}

export function useT() {
  const [, bump] = useState(0);
  useEffect(() => subscribeLocale(() => bump((n) => n + 1)), []);
  return t;
}

export function useLocale(): LocaleCode {
  const [loc, setLoc] = useState(currentLocale);
  useEffect(() => subscribeLocale(() => setLoc(getLocale())), []);
  return loc;
}

export { LOCALES, isLocale };
export type { LocaleCode };
