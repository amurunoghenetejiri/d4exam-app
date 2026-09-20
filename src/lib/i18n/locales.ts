export type LocaleCode =
  | "en"
  | "fr"
  | "es"
  | "ar"
  | "pt"
  | "de"
  | "zh"
  | "ja"
  | "ko"
  | "hi"
  | "sw"
  | "yo";

export const LOCALES: { code: LocaleCode; label: string; native: string; dir?: "ltr" | "rtl" }[] = [
  { code: "en", label: "English", native: "English" },
  { code: "fr", label: "French", native: "Français" },
  { code: "es", label: "Spanish", native: "Español" },
  { code: "ar", label: "Arabic", native: "العربية", dir: "rtl" },
  { code: "pt", label: "Portuguese", native: "Português" },
  { code: "de", label: "German", native: "Deutsch" },
  { code: "zh", label: "Chinese", native: "中文" },
  { code: "ja", label: "Japanese", native: "日本語" },
  { code: "ko", label: "Korean", native: "한국어" },
  { code: "hi", label: "Hindi", native: "हिन्दी" },
  { code: "sw", label: "Swahili", native: "Kiswahili" },
  { code: "yo", label: "Yoruba", native: "Yorùbá" },
];

export function isLocale(code: string): code is LocaleCode {
  return LOCALES.some((l) => l.code === code);
}
