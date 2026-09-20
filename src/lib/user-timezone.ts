import type { DisplayPrefs } from "@/lib/notification-prefs";

/** Map preference values to IANA time zones. */
export function resolveIanaTimeZone(pref: string | undefined | null): string {
  const p = (pref || "auto").toLowerCase();
  if (p === "auto" || p === "wat" || p === "africa/lagos") return "Africa/Lagos";
  if (p === "gmt" || p === "utc") return "UTC";
  if (p === "eat" || p === "africa/nairobi") return "Africa/Nairobi";
  if (p === "cat" || p === "africa/johannesburg") return "Africa/Johannesburg";
  if (p === "europe/london") return "Europe/London";
  if (p === "america/new_york") return "America/New_York";
  if (p === "asia/dubai") return "Asia/Dubai";
  // If already IANA-like
  if (p.includes("/")) {
    const parts = pref!.split("/");
    return `${parts[0]}/${parts.slice(1).join("/")}`;
  }
  return "Africa/Lagos";
}

export function formatInUserTz(
  input: string | number | Date | null | undefined,
  prefs: Pick<DisplayPrefs, "timezone"> | string | null | undefined,
  options?: Intl.DateTimeFormatOptions,
): string {
  if (input == null || input === "") return "—";
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return "—";
  const tz =
    typeof prefs === "string"
      ? resolveIanaTimeZone(prefs)
      : resolveIanaTimeZone(prefs?.timezone);
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: tz,
      ...options,
    }).format(d);
  } catch {
    return d.toLocaleString();
  }
}

export const TIMEZONE_OPTIONS: { value: string; label: string }[] = [
  { value: "auto", label: "Automatic — Africa/Lagos" },
  { value: "Africa/Lagos", label: "Africa/Lagos (WAT, UTC+1)" },
  { value: "UTC", label: "UTC" },
  { value: "Africa/Nairobi", label: "Africa/Nairobi (EAT)" },
  { value: "Africa/Johannesburg", label: "Africa/Johannesburg (SAST)" },
  { value: "Europe/London", label: "Europe/London" },
  { value: "America/New_York", label: "America/New_York" },
  { value: "Asia/Dubai", label: "Asia/Dubai" },
];
