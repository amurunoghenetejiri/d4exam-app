import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ShieldCheck, Save } from "lucide-react";
import { PageHeader, SectionCard, EmptyState } from "@/components/dashboard/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTeacherContext } from "@/lib/teacher";
import {
  DEFAULT_EXAM_SECURITY,
  loadTeacherSecurityDefaults,
  saveTeacherSecurityDefaults,
} from "@/lib/exam-security";
import { toast } from "sonner";
import type { ExamSecuritySettings } from "@/types";

export const Route = createFileRoute("/teacher/exam-security")({
  head: () => ({
    meta: [
      { title: "Exam Security — D4EXAM" },
      {
        name: "description",
        content: "Default CBT security settings for examinations you create.",
      },
    ],
  }),
  component: Page,
});

function Page() {
  const { data: teacher, isLoading } = useTeacherContext();
  const [settings, setSettings] = useState<ExamSecuritySettings>({ ...DEFAULT_EXAM_SECURITY });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!teacher?.teacherId) return;
    setSettings(loadTeacherSecurityDefaults(teacher.teacherId));
    setLoaded(true);
  }, [teacher?.teacherId]);

  function save() {
    if (!teacher?.teacherId) {
      toast.error("Teacher profile not found");
      return;
    }
    if (settings.tabMonitoring && (settings.maxTabSwitches < 1 || settings.maxTabSwitches > 20)) {
      toast.error("Max tab switches must be between 1 and 20");
      return;
    }
    const toSave = {
      ...settings,
      // Face monitoring: detect only — no count-based pause/terminate
      faceViolationAction: "warn" as const,
      maxFaceWarnings: 9999,
    };
    saveTeacherSecurityDefaults(teacher.teacherId, toSave);
    setSettings(toSave);
    toast.success("Security defaults saved. They will apply when you create or submit examinations.");
  }

  function toggle<K extends keyof ExamSecuritySettings>(key: K, value: ExamSecuritySettings[K]) {
    setSettings((s) => ({ ...s, [key]: value }));
  }

  if (isLoading || !loaded) return <p className="text-sm text-slate-500">Loading…</p>;
  if (!teacher) {
    return <EmptyState title="Teacher profile not found" description="Contact School Admin." />;
  }

  return (
    <>
      <PageHeader
        title="Exam Security"
        description={`Defaults for ${teacher.fullName}. Saved settings are attached to every examination you create or submit.`}
        actions={
          <Button className="font-semibold" onClick={save}>
            <Save className="mr-1.5 h-4 w-4" />
            Save defaults
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Lockdown">
          <div className="space-y-3">
            <Toggle
              label="Fullscreen lockdown"
              hint="Candidate must stay in fullscreen"
              checked={settings.fullscreen}
              onChange={(v) => toggle("fullscreen", v)}
            />
            <Toggle
              label="Tab & focus monitoring"
              hint="Detect leaving the exam window"
              checked={settings.tabMonitoring}
              onChange={(v) => toggle("tabMonitoring", v)}
            />
            <div className="space-y-2 rounded-xl border border-slate-200 px-4 py-3">
              <Label className="font-semibold">TAB VIOLATION limit</Label>
              <Input
                type="number"
                min={1}
                max={20}
                value={settings.maxTabSwitches}
                onChange={(e) => toggle("maxTabSwitches", Number(e.target.value) || 5)}
                disabled={!settings.tabMonitoring}
              />
            </div>
            <div className="space-y-2 rounded-xl border border-slate-200 px-4 py-3">
              <Label className="font-semibold">TAB VIOLATION consequence</Label>
              <Select
                value={settings.thresholdAction}
                onValueChange={(v) =>
                  toggle("thresholdAction", v as ExamSecuritySettings["thresholdAction"])
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="warn">Warning Only</SelectItem>
                  <SelectItem value="flag">Flag for Review</SelectItem>
                  <SelectItem value="pause">Pause Exam</SelectItem>
                  <SelectItem value="auto_submit">Auto-Submit Exam</SelectItem>
                  <SelectItem value="terminate">Terminate Exam</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {settings.thresholdAction === "pause" && (
              <div className="space-y-2 rounded-xl border border-slate-200 px-4 py-3">
                <Label className="font-semibold">Pause duration</Label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-slate-500">Minutes</p>
                    <Input
                      type="number"
                      min={0}
                      max={60}
                      value={Math.floor((settings.pauseDurationSeconds ?? 300) / 60)}
                      onChange={(e) => {
                        const mins = Math.max(0, Math.min(60, Number(e.target.value) || 0));
                        const secs = (settings.pauseDurationSeconds ?? 300) % 60;
                        toggle("pauseDurationSeconds", Math.max(30, mins * 60 + secs));
                      }}
                    />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-slate-500">Seconds</p>
                    <Input
                      type="number"
                      min={0}
                      max={59}
                      step={5}
                      value={(settings.pauseDurationSeconds ?? 300) % 60}
                      onChange={(e) => {
                        const secs = Math.max(0, Math.min(59, Number(e.target.value) || 0));
                        const mins = Math.floor((settings.pauseDurationSeconds ?? 300) / 60);
                        toggle("pauseDurationSeconds", Math.max(30, mins * 60 + secs));
                      }}
                    />
                  </div>
                </div>
                <p className="text-xs text-slate-500">
                  Student must wait{" "}
                  <strong>
                    {Math.floor((settings.pauseDurationSeconds ?? 300) / 60)} min{" "}
                    {(settings.pauseDurationSeconds ?? 300) % 60} sec
                  </strong>{" "}
                  before continuing (minimum 30 seconds). Set any time, e.g. 2 min 30 sec.
                </p>
              </div>
            )}
            <Toggle
              label="Block copy / paste"
              hint="Disable clipboard during the attempt"
              checked={settings.blockCopyPaste}
              onChange={(v) => toggle("blockCopyPaste", v)}
            />
          </div>
        </SectionCard>

        <SectionCard title="Proctoring & tools">
          <div className="space-y-3">
            <Toggle
              label="Randomise question order"
              hint="Each candidate gets a shuffled sequence"
              checked={settings.randomizeQuestions}
              onChange={(v) => toggle("randomizeQuestions", v)}
            />
            <Toggle
              label="Randomise option order"
              hint="MCQ choices shuffled per candidate"
              checked={settings.randomizeOptions}
              onChange={(v) => toggle("randomizeOptions", v)}
            />
            <Toggle
              label="Require camera"
              hint="Student must enable camera for the exam"
              checked={settings.requireCamera}
              onChange={(v) => toggle("requireCamera", v)}
            />
            <Toggle
              label="Face monitoring"
              hint="Detect one face / no face / multiple faces live. Does not pause or terminate the exam — only tab violations use limits and consequences."
              checked={settings.faceDetection}
              onChange={(v) => {
                toggle("faceDetection", v);
                if (v) toggle("requireCamera", true);
              }}
            />
            <Toggle
              label="Require microphone"
              hint="Optional audio monitoring"
              checked={settings.requireMicrophone}
              onChange={(v) => toggle("requireMicrophone", v)}
            />
            <div className="space-y-2 rounded-xl border border-slate-200 px-4 py-3">
              <Label className="font-semibold">Screen share</Label>
              <Select
                value={settings.screenShareMode || "disabled"}
                onValueChange={(v) =>
                  toggle("screenShareMode", v as ExamSecuritySettings["screenShareMode"])
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="disabled">Disabled</SelectItem>
                  <SelectItem value="optional">Optional</SelectItem>
                  <SelectItem value="required">Required</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500">Share the student screen with officers during the exam.</p>
            </div>
            <Toggle
              label="Allow calculator"
              hint="In-exam calculator for this paper"
              checked={settings.allowCalculator}
              onChange={(v) => toggle("allowCalculator", v)}
            />
            {settings.allowCalculator ? (
              <div className="space-y-2 rounded-xl border border-slate-200 px-4 py-3">
                <Label className="font-semibold">Calculator type</Label>
                <Select
                  value={settings.calculatorType || "basic"}
                  onValueChange={(v) =>
                    toggle("calculatorType", v as ExamSecuritySettings["calculatorType"])
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="basic">Basic</SelectItem>
                    <SelectItem value="scientific">Scientific</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : null}
          </div>

          <div className="mt-6 flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <p className="text-sm text-slate-700">
              Click <strong>Save defaults</strong> to store these settings. When you create or submit
              an examination, the same security rules are applied so the Examination Officer can
              review them. <strong>Face monitoring</strong> logs and shows status only — only{" "}
              <strong>tab violations</strong> use limits and consequences (pause / terminate / etc.).
            </p>
          </div>
        </SectionCard>
      </div>
    </>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3">
      <span>
        <span className="block text-sm font-semibold text-slate-800">{label}</span>
        <span className="mt-0.5 block text-xs text-slate-500">{hint}</span>
      </span>
      <Checkbox checked={checked} onCheckedChange={(v) => onChange(v === true)} className="mt-0.5" />
    </label>
  );
}
