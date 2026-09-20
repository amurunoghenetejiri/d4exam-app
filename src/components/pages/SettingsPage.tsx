import { Link } from "@tanstack/react-router";
import { PageHeader, SectionCard, InfoRow } from "@/components/dashboard/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useSessionUser } from "@/lib/session";
import {
  DEFAULT_NOTIFICATION_PREFS,
  DEFAULT_DISPLAY_PREFS,
  loadNotificationPrefs,
  loadDisplayPrefs,
  hydratePrefsFromDb,
  persistPrefsToDb,
  applyDisplayPrefsToDom,
  saveDisplayPrefs,
  type NotificationPrefs,
  type DisplayPrefs,
} from "@/lib/notification-prefs";
import { supabase } from "@/integrations/supabase/client";
import {
  updateSchoolLogoUrl,
  updateSchoolName,
  uploadSchoolLogo,
  useSchoolIdentity,
  validateLogoFile,
} from "@/lib/school-identity";
import { SchoolLogo } from "@/components/brand/SchoolLogo";
import { Loader2, Upload, Building2, Info, LifeBuoy, Shield, ChevronRight, CreditCard, ArrowLeft, HardDrive, Languages, Clock, Palette, Trash2 } from "lucide-react";
import { InAppHelpLegal, helpLegalTitle, type HelpLegalDoc } from "@/components/pages/InAppHelpLegal";
import { RoleManual, resolveManualRole } from "@/components/pages/RoleManual";
import { BookOpen } from "lucide-react";

import { PushSettingsCard } from "@/components/settings/PushSettingsCard";
import { FingerprintLockCard } from "@/components/settings/FingerprintLockCard";
import { ChangeAppPasswordCard } from "@/components/settings/ChangeAppPasswordCard";
import { SwitchAccountCard } from "@/components/settings/SwitchAccountCard";
import { RoleSwitchCard } from "@/components/settings/RoleSwitchCard";
import { signOutThisAccount, signOutAllAccounts, listSavedAccounts } from "@/lib/account-switcher";
import { LOCALES, setLocale, useT } from "@/lib/i18n";
import { TIMEZONE_OPTIONS } from "@/lib/user-timezone";
import { isOnlineNow } from "@/lib/offline-sync";


export function SettingsPage({ scope }: { scope: string }) {
  const { data: session } = useSessionUser();
  const [saving, setSaving] = useState(false);
  const [helpDoc, setHelpDoc] = useState<HelpLegalDoc | null>(null);
  const [showManual, setShowManual] = useState(false);

  const [notifPrefs, setNotifPrefs] = useState<NotificationPrefs>({ ...DEFAULT_NOTIFICATION_PREFS });
  const [displayPrefs, setDisplayPrefs] = useState<DisplayPrefs>({ ...DEFAULT_DISPLAY_PREFS });
  const [offlineInfo, setOfflineInfo] = useState({ count: 0, bytes: 0, lastSync: null as string | null });
  const t = useT();
  const scopeLower = (scope || "").toLowerCase();
  const isSuperAdmin = scopeLower.includes("super") || session?.role === "super_admin" || (session?.roles ?? []).includes("super_admin");
  const isSchoolAdmin = !isSuperAdmin && (scopeLower.includes("school admin") || (scopeLower.includes("admin") && !scopeLower.includes("super")) || scopeLower === "school" || session?.role === "school_admin");

  useEffect(() => {
    if (!session?.userId) return;
    setNotifPrefs(loadNotificationPrefs(session.userId));
    setDisplayPrefs(loadDisplayPrefs(session.userId));
    void hydratePrefsFromDb(session.userId, session.profileId).then(({ notif, display }) => {
      setNotifPrefs(notif);
      setDisplayPrefs(display);
      applyDisplayPrefsToDom(display);
      setLocale(display.language || "en");
    });
  }, [session?.userId, session?.profileId]);

  useEffect(() => {
    try {
      let count = 0;
      let bytes = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i) || "";
        if (k.includes("material") || k.includes("d4_study_help") || k.includes("offline")) {
          count += 1;
          bytes += ((localStorage.getItem(k) || "").length) * 2;
        }
      }
      setOfflineInfo({ count, bytes, lastSync: localStorage.getItem("d4exam_last_sync") });
    } catch { /* */ }
  }, [session?.userId]);

  function patchDisplay(patch: Partial<DisplayPrefs>) {
    setDisplayPrefs((prev) => {
      const next = { ...prev, ...patch };
      if (session?.userId) saveDisplayPrefs(session.userId, next);
      else applyDisplayPrefsToDom(next);
      if (patch.language) setLocale(patch.language);
      return next;
    });
  }

  async function savePrefs() {
    if (!session?.userId) {
      toast.error("Sign in required.");
      return;
    }
    setSaving(true);
    try {
      await persistPrefsToDb(session.userId, session.profileId, notifPrefs, displayPrefs);
      toast.success("Settings saved.");
    } catch (e) {
      toast.error((e as Error).message || "Could not save settings.");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    const open = Boolean(helpDoc || showManual);
    try {
      (window as unknown as { __d4SettingsOverlayOpen?: boolean }).__d4SettingsOverlayOpen = open;
    } catch { /* */ }
    if (open) {
      try {
        window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
        const main = document.querySelector("main");
        if (main) main.scrollTop = 0;
      } catch { /* */ }
    }
    const onClose = () => {
      setHelpDoc(null);
      setShowManual(false);
    };
    window.addEventListener("d4-settings-overlay-close", onClose);
    return () => {
      window.removeEventListener("d4-settings-overlay-close", onClose);
      try {
        (window as unknown as { __d4SettingsOverlayOpen?: boolean }).__d4SettingsOverlayOpen = false;
      } catch { /* */ }
    };
  }, [helpDoc, showManual]);

  if (showManual && !isSuperAdmin) {
    const manualRole = resolveManualRole(scope, session?.role);
    if (manualRole === "super_admin") {
      return (
        <>
          <div className="mb-4">
            <button type="button" onClick={() => setShowManual(false)} className="inline-flex items-center gap-2 rounded-lg px-1 py-2 text-sm font-semibold text-primary hover:bg-slate-50">
              <ArrowLeft className="h-4 w-4" /> Back to settings
            </button>
          </div>
          <p className="text-sm text-slate-600">Manual Guide is not available for Super Admin.</p>
        </>
      );
    }
    return (
      <>
        <div className="mb-4">
          <button
            type="button"
            onClick={() => setShowManual(false)}
            className="inline-flex items-center gap-2 rounded-lg px-1 py-2 text-sm font-semibold text-primary hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" /> Back to settings
          </button>
        </div>
        <RoleManual role={manualRole} fullName={session?.fullName} />
      </>
    );
  }

  if (helpDoc) {
    return (
      <>
        <div className="mb-4">
          <button
            type="button"
            onClick={() => setHelpDoc(null)}
            className="inline-flex items-center gap-2 rounded-lg px-1 py-2 text-sm font-semibold text-primary hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" /> Back to settings
          </button>
        </div>
        <SectionCard title={helpLegalTitle(helpDoc)} description="Help & legal">
          <div className="px-0.5 pb-2">
            <InAppHelpLegal doc={helpDoc} />
          </div>
        </SectionCard>
      </>
    );
  }

  return (
    <>
      <PageHeader title={t("settings.title")} description={t("settings.subtitle", { scope })} />
      <div className="grid gap-6 lg:grid-cols-2">
        {isSchoolAdmin && <SchoolIdentityCard />}
        <SectionCard title={t("settings.preferences")} description={t("settings.preferencesDesc")}>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="lang" className="inline-flex items-center gap-1.5">
                <Languages className="h-3.5 w-3.5 text-slate-400" />
                {t("settings.language")}
              </Label>
              <Select value={displayPrefs.language} onValueChange={(v) => patchDisplay({ language: v })}>
                <SelectTrigger id="lang"><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {LOCALES.map((l) => (
                    <SelectItem key={l.code} value={l.code}>{l.native} ({l.label})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tz" className="inline-flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-slate-400" />
                {t("settings.timezone")}
              </Label>
              <Select value={displayPrefs.timezone} onValueChange={(v) => patchDisplay({ timezone: v })}>
                <SelectTrigger id="tz"><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {TIMEZONE_OPTIONS.map((z) => (
                    <SelectItem key={z.value} value={z.value}>{z.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="appearance" className="inline-flex items-center gap-1.5">
                <Palette className="h-3.5 w-3.5 text-slate-400" />
                {t("settings.appearance")}
              </Label>
              <Select
                value={displayPrefs.appearance || "system"}
                onValueChange={(v) => patchDisplay({ appearance: v as "system" | "light" | "dark" })}
              >
                <SelectTrigger id="appearance"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="system">{t("settings.appearanceSystem")}</SelectItem>
                  <SelectItem value="light">{t("settings.appearanceLight")}</SelectItem>
                  <SelectItem value="dark">{t("settings.appearanceDark")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Separator />
            <ToggleRow id="compact" label={t("settings.compactTables")} hint={t("settings.compactTablesHint")} checked={displayPrefs.compactTables} onCheckedChange={(v) => patchDisplay({ compactTables: v })} />
            <ToggleRow id="reduced" label={t("settings.reducedMotion")} hint={t("settings.reducedMotionHint")} checked={displayPrefs.reducedMotion} onCheckedChange={(v) => patchDisplay({ reducedMotion: v })} />
            <Button disabled={saving} onClick={() => void savePrefs()}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{t("settings.savePreferences")}</Button>
          </div>
        </SectionCard>
        <SectionCard title={t("settings.notifications")} description={t("settings.notificationsDesc")}>
          <div className="space-y-4">
            <ToggleRow id="n1" label={t("settings.examReminders")} hint={t("settings.examRemindersHint")} checked={notifPrefs.examReminders} onCheckedChange={(v) => setNotifPrefs((p) => ({ ...p, examReminders: v }))} />
            <ToggleRow id="n2" label={t("settings.resultPublications")} checked={notifPrefs.resultPublications} onCheckedChange={(v) => setNotifPrefs((p) => ({ ...p, resultPublications: v }))} />
            <ToggleRow id="n3" label={t("settings.integrityAlerts")} checked={notifPrefs.integrityAlerts} onCheckedChange={(v) => setNotifPrefs((p) => ({ ...p, integrityAlerts: v }))} />
            <ToggleRow id="n4" label={t("settings.productAnnouncements")} checked={notifPrefs.productAnnouncements} onCheckedChange={(v) => setNotifPrefs((p) => ({ ...p, productAnnouncements: v }))} />
            <Button disabled={saving} onClick={() => void savePrefs()}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{t("settings.saveNotifications")}</Button>
          </div>
        </SectionCard>
        
        <SectionCard title={t("settings.offline")} description={t("settings.offlineDesc")}>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5">
              <span className="inline-flex items-center gap-2 font-medium text-slate-800">
                <HardDrive className="h-4 w-4 text-slate-400" />
                {t("settings.offlineAvailable")}
              </span>
              <span className="text-xs font-semibold text-emerald-700">{isOnlineNow() ? "Online" : "Offline"}</span>
            </div>
            <div className="flex items-center justify-between gap-3 px-1">
              <span className="text-slate-600">{t("settings.downloadedMaterials")}</span>
              <span className="font-semibold tabular-nums">{offlineInfo.count}</span>
            </div>
            <div className="flex items-center justify-between gap-3 px-1">
              <span className="text-slate-600">{t("settings.storageUsed")}</span>
              <span className="font-semibold tabular-nums">
                {offlineInfo.bytes < 1024 * 1024 ? `${Math.round(offlineInfo.bytes / 1024)} KB` : `${(offlineInfo.bytes / (1024 * 1024)).toFixed(1)} MB`}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 px-1">
              <span className="text-slate-600">{t("settings.lastSync")}</span>
              <span className="text-xs text-slate-500">{offlineInfo.lastSync ? new Date(offlineInfo.lastSync).toLocaleString() : "—"}</span>
            </div>
            <Button type="button" variant="outline" className="w-full gap-2" onClick={() => {
              try {
                const keys: string[] = [];
                for (let i = 0; i < localStorage.length; i++) {
                  const k = localStorage.key(i) || "";
                  if (k.includes("d4_study_help") || k.startsWith("d4exam_tmp")) keys.push(k);
                }
                keys.forEach((k) => localStorage.removeItem(k));
                toast.success("Temporary cache cleared");
                setOfflineInfo((s) => ({ ...s, count: Math.max(0, s.count - keys.length) }));
              } catch { toast.error("Could not clear cache"); }
            }}>
              <Trash2 className="h-4 w-4" />
              {t("settings.clearCache")}
            </Button>
          </div>
        </SectionCard>

        <PushSettingsCard scope={scope} />
        <ChangeAppPasswordCard />
        <FingerprintLockCard />
        <RoleSwitchCard />
        <SwitchAccountCard />
        <SectionCard title="Session" description="Device and access information">
          <InfoRow label="Account scope" value={scope} />
          <InfoRow label="Signed-in email" value={session?.email || "—"} />
          <InfoRow label="Name" value={session?.fullName || "—"} />
          <div className="flex flex-wrap gap-2 pt-4">
            <Button variant="outline" onClick={() => { if (window.confirm("Sign out of this account?")) void signOutThisAccount(); }}>Sign out</Button>
            {listSavedAccounts().length > 1 ? (
              <Button variant="ghost" className="text-red-600" onClick={() => { if (window.confirm("Sign out of all accounts on this device?")) void signOutAllAccounts(); }}>Sign out all</Button>
            ) : null}
          </div>
        </SectionCard>
        <SectionCard title="Help & legal" description="About, contact & support, privacy and pricing">
          <div className="flex flex-col gap-1">
            {!isSuperAdmin ? (
            <button type="button" onClick={() => { setShowManual(true); setHelpDoc(null); }} className="flex items-center gap-3 rounded-lg px-2 py-3 text-left text-sm font-semibold text-slate-800 hover:bg-slate-50"><BookOpen className="h-4 w-4 shrink-0 text-primary" /><span className="flex-1">App manual — how to use D4EXAM</span><ChevronRight className="h-4 w-4 text-slate-300" /></button>
            ) : null}
            <button type="button" onClick={() => setHelpDoc("about")} className="flex items-center gap-3 rounded-lg px-2 py-3 text-left text-sm font-semibold text-slate-800 hover:bg-slate-50"><Info className="h-4 w-4 shrink-0 text-primary" /><span className="flex-1">About Us</span><ChevronRight className="h-4 w-4 text-slate-300" /></button>
            <button type="button" onClick={() => setHelpDoc("support")} className="flex items-center gap-3 rounded-lg px-2 py-3 text-left text-sm font-semibold text-slate-800 hover:bg-slate-50"><LifeBuoy className="h-4 w-4 shrink-0 text-primary" /><span className="flex-1">Contact & Support</span><ChevronRight className="h-4 w-4 text-slate-300" /></button>
            <button type="button" onClick={() => setHelpDoc("privacy")} className="flex items-center gap-3 rounded-lg px-2 py-3 text-left text-sm font-semibold text-slate-800 hover:bg-slate-50"><Shield className="h-4 w-4 shrink-0 text-primary" /><span className="flex-1">Privacy Policy</span><ChevronRight className="h-4 w-4 text-slate-300" /></button>
            <button type="button" onClick={() => setHelpDoc("pricing")} className="flex items-center gap-3 rounded-lg px-2 py-3 text-left text-sm font-semibold text-slate-800 hover:bg-slate-50"><CreditCard className="h-4 w-4 shrink-0 text-primary" /><span className="flex-1">Pricing</span><ChevronRight className="h-4 w-4 text-slate-300" /></button>
            <p className="mt-3 px-2 text-center text-[11px] text-slate-400">D4EXAM. Smart. Secure. Seamless.</p>
          </div>
        </SectionCard>
      </div>
    </>
  );
}

function SchoolIdentityCard() {
  const { data: session, isLoading: sessionLoading } = useSessionUser();
  const schoolId = session?.schoolId ?? null;
  const { data: school, isLoading: schoolLoading, refetch, error: schoolError } = useSchoolIdentity(schoolId);
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [nameBusy, setNameBusy] = useState(false);
  useEffect(() => {
    if (school?.name) setName(school.name);
    else if (session?.schoolName) setName(session.schoolName);
  }, [school?.name, session?.schoolName]);
  function onPick(f: File | null) {
    if (!f) return;
    const err = validateLogoFile(f);
    if (err) { toast.error(err); return; }
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }
  async function saveName() {
    if (!schoolId) { toast.error("No school linked to this account."); return; }
    setNameBusy(true);
    try {
      await updateSchoolName(schoolId, name);
      await refetch();
      await qc.invalidateQueries({ queryKey: ["school-identity"] });
      await qc.invalidateQueries({ queryKey: ["session-user"] });
      toast.success("School name updated.");
    } catch (e) {
      toast.error((e as Error).message || "Could not update school name");
    } finally { setNameBusy(false); }
  }
  async function saveLogo() {
    if (!schoolId) { toast.error("No school linked to this account."); return; }
    if (!file) { toast.error("Choose a logo file first."); return; }
    setBusy(true);
    try {
      const { url } = await uploadSchoolLogo({ file, folder: schoolId });
      await updateSchoolLogoUrl(schoolId, url);
      await refetch();
      await qc.invalidateQueries({ queryKey: ["school-identity"] });
      await qc.invalidateQueries({ queryKey: ["session-user"] });
      toast.success("School logo saved. It will show across your portal.");
      setFile(null);
      if (preview) URL.revokeObjectURL(preview);
      setPreview(null);
      if (inputRef.current) inputRef.current.value = "";
    } catch (e) {
      toast.error((e as Error).message || "Could not update logo");
    } finally { setBusy(false); }
  }
  function cancelLogo() {
    setFile(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    if (inputRef.current) inputRef.current.value = "";
  }
  if (sessionLoading || schoolLoading) {
    return (<SectionCard title="School Identity / Branding" className="lg:col-span-2"><p className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading school…</p></SectionCard>);
  }
  if (!schoolId) {
    return (<SectionCard title="School Identity / Branding" className="lg:col-span-2"><p className="text-sm text-slate-500">No school is linked to this account. Sign in as a school administrator to manage branding.</p></SectionCard>);
  }
  if (schoolError) {
    return (<SectionCard title="School Identity / Branding" className="lg:col-span-2"><p className="text-sm text-red-600">Could not load school: {(schoolError as Error).message}</p></SectionCard>);
  }
  return (
    <SectionCard title="School Identity / Branding" description="Official name and logo for your institution on D4EXAM" className="lg:col-span-2">
      <div className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="school-name" className="flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" /> School name</Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input id="school-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Institution name" className="flex-1" />
            <Button type="button" className="font-semibold sm:w-auto" disabled={nameBusy || !name.trim() || name.trim() === school?.name} onClick={() => void saveName()}>{nameBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save name</Button>
          </div>
          {school?.schoolCode && (<p className="text-xs text-slate-500">School code: <span className="font-mono font-semibold">{school.schoolCode}</span> (cannot be changed here)</p>)}
        </div>
        <Separator />
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
          <div className="flex flex-col items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Current logo</p>
            <div className="grid h-24 w-24 place-items-center rounded-2xl border border-slate-200 bg-slate-50 p-2">
              <SchoolLogo logoUrl={school?.logoUrl} schoolName={school?.name} size="xl" className="h-20 w-20" />
            </div>
          </div>
          <div className="min-w-0 flex-1 space-y-3">
            <p className="text-sm text-slate-600">Upload a square PNG or JPG (max 2MB). This logo appears in the portal header and examination materials.</p>
            <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => onPick(e.target.files?.[0] ?? null)} />
            {preview && (<div className="flex items-center gap-3"><img src={preview} alt="" className="h-16 w-16 rounded-xl object-contain border" /><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-slate-900">New logo preview</p><p className="truncate text-xs text-slate-500">{file?.name}</p></div></div>)}
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" className="gap-2 font-semibold" onClick={() => inputRef.current?.click()} disabled={busy}><Upload className="h-4 w-4" />{school?.logoUrl ? "Change logo" : "Upload logo"}</Button>
              {file && (<><Button type="button" className="font-semibold" disabled={busy} onClick={() => void saveLogo()}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save logo</Button><Button type="button" variant="ghost" disabled={busy} onClick={cancelLogo}>Cancel</Button></>)}
            </div>
            {!school?.logoUrl && !preview && <p className="text-xs text-amber-700">No logo yet — D4EXAM mark is shown until you upload one.</p>}
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

function ToggleRow({ id, label, hint, defaultChecked, checked, onCheckedChange }: { id: string; label: string; hint?: string; defaultChecked?: boolean; checked?: boolean; onCheckedChange?: (value: boolean) => void }) {
  const controlled = typeof checked === "boolean";
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <Label htmlFor={id} className="text-sm font-medium">{label}</Label>
        {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </div>
      {controlled ? <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} /> : <Switch id={id} defaultChecked={defaultChecked} />}
    </div>
  );
}
