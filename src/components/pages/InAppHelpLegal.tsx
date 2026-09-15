/**
 * Full Help & Legal content for in-app Settings (role shell).
 * Same substance as public /about /support /privacy /pricing,
 * but without PublicLayout header/footer.
 */
import { Check, Mail, Phone, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { toast } from "sonner";

export type HelpLegalDoc = "about" | "support" | "privacy" | "pricing";

const values = [
  {
    title: "Academic first",
    body: "Workflows modelled on real faculty, department and examination officer structures so institutions do not reinvent their process.",
  },
  {
    title: "Integrity always",
    body: "Every attempt is monitored and auditable — fullscreen, tab, camera and officer actions — so results can be defended.",
  },
  {
    title: "Access everywhere",
    body: "Built for varied bandwidth, shared laboratories and personal devices. The same secure experience on web and the D4EXAM app.",
  },
];

const pillars = [
  {
    title: "What we build",
    body: "D4EXAM is a full examination management platform: school onboarding, academic structure, question banks, CBT delivery, live monitoring, automated and manual marking, and result publication.",
  },
  {
    title: "Who we serve",
    body: "Technical schools, colleges, polytechnics and universities that need institution-grade CBT without sacrificing academic control or auditability.",
  },
  {
    title: "How we work",
    body: "Role-based portals for students, teachers, school admins and departmental officers. Security settings are per examination. Officers can pause, warn or terminate live attempts.",
  },
  {
    title: "Trust & data",
    body: "Candidate and institutional data is used only to run examinations and produce academic records. We do not sell personal data. See our Privacy Policy for retention and rights.",
  },
];

const privacySections = [
  {
    title: "1. Information we collect",
    body: "We collect institutional records supplied by your school (names, matriculation or staff identifiers, departments and levels), examination activity, and technical session data such as device type, browser and connection events required to protect examination integrity.",
  },
  {
    title: "2. How information is used",
    body: "Data is used solely to deliver examinations, authenticate candidates, monitor integrity, mark and publish results, and produce institutional reports. D4EXAM does not sell personal data or use candidate records for advertising.",
  },
  {
    title: "3. Examination monitoring",
    body: "During an examination, D4EXAM may record fullscreen exits, tab switches, blocked copy attempts and connection interruptions. Where enabled by your institution, camera and microphone checks are performed. Monitoring is limited to the duration of the examination session.",
  },
  {
    title: "4. Data retention",
    body: "Examination records and result data are retained for the period defined by your institution's academic policy. Integrity event logs are retained for the current and preceding academic session unless a longer statutory period applies.",
  },
  {
    title: "5. Data sharing",
    body: "Records are visible only to authorised staff of your institution and to D4EXAM personnel performing technical support under contract. We do not disclose data to third parties except where required by law.",
  },
  {
    title: "6. Security",
    body: "Data is encrypted in transit and at rest. Access is role-based, and all administrative actions are recorded in an audit log available to your institution.",
  },
  {
    title: "7. Your rights",
    body: "Candidates may request access to, or correction of, their personal records through their institution's administrator. Requests relating to platform-level data can be sent to privacy@d4exam.com.",
  },
  {
    title: "8. Contact",
    body: "For any privacy question, contact the D4EXAM data protection team at privacy@d4exam.com or through the Support page.",
  },
];

const faqs = [
  {
    q: "A candidate lost connection mid-examination. What happens?",
    a: "Answers are saved continuously. When the connection returns, the candidate resumes at the same question with the remaining time intact.",
  },
  {
    q: "How do we reset a candidate's password?",
    a: "School administrators can reset any candidate password from Admin → Students → Edit Student. Candidates can also use the Forgot Password page.",
  },
  {
    q: "Can results be released automatically?",
    a: "Yes. Each examination has result settings that control instant release, or release only after examination officer approval.",
  },
  {
    q: "Which file formats are supported for student import?",
    a: "CSV and Excel (.xlsx). Download the official template from Admin → Student Import to avoid validation errors.",
  },
];

const plans = [
  {
    name: "Starter",
    audience: "Technical schools & training centres",
    price: "₦45,000",
    period: "per term",
    features: [
      "Up to 500 active students",
      "Unlimited objective examinations",
      "Basic integrity monitoring",
      "Result export (CSV/PDF)",
      "Email support (48h)",
    ],
    highlight: false,
  },
  {
    name: "Professional",
    audience: "Colleges & polytechnics",
    price: "₦120,000",
    period: "per term",
    features: [
      "Up to 5,000 active students",
      "Live monitoring & officer controls",
      "Camera / tab integrity suite",
      "Advanced analytics & reports",
      "Priority support (24h)",
    ],
    highlight: true,
  },
  {
    name: "Enterprise",
    audience: "Universities & multi-campus",
    price: "Custom",
    period: "per year",
    features: [
      "Unlimited students & concurrent exams",
      "Dedicated success manager",
      "Custom integrations & SSO",
      "On-premise options available",
      "SLA with uptime guarantee",
    ],
    highlight: false,
  },
];

function AboutBody() {
  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">About D4EXAM</p>
        <h2 className="mt-1 text-xl font-extrabold text-slate-900 sm:text-2xl">Smart. Secure. Seamless.</h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          D4EXAM is a professional examination management platform built for schools, colleges,
          polytechnics and universities. We help institutions move paper-based assessment online
          without losing the rigour, structure and accountability that academic examinations demand.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {values.map((v) => (
          <div key={v.title} className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
            <h3 className="text-sm font-semibold text-slate-900">{v.title}</h3>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-600">{v.body}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {pillars.map((p) => (
          <div key={p.title} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900">{p.title}</h3>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-600">{p.body}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4 rounded-xl border border-slate-200 bg-slate-50 p-5 sm:grid-cols-4">
        {[
          ["182+", "Institutions"],
          ["84K+", "Students"],
          ["12K+", "Examinations"],
          ["98.5%", "Success rate"],
        ].map(([v, l]) => (
          <div key={l} className="text-center">
            <p className="text-xl font-extrabold text-primary">{v}</p>
            <p className="mt-0.5 text-[11px] text-slate-500">{l}</p>
          </div>
        ))}
      </div>

      <p className="text-center text-[11px] text-slate-400">
        © 2026 D4EXAM · Smart. Secure. Seamless.
      </p>
    </div>
  );
}

function SupportBody() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-extrabold text-slate-900">Support</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Candidates should contact their school administrator first. Institutional staff can reach
          the D4EXAM team using the form below.
        </p>
      </div>

      <form
        className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
        onSubmit={(e) => {
          e.preventDefault();
          toast.success("Support request submitted. Reference #SR-40912");
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="inapp-support-name">Full name</Label>
          <Input id="inapp-support-name" required placeholder="Your name" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="inapp-support-email">Email</Label>
          <Input id="inapp-support-email" type="email" required placeholder="you@school.edu" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="inapp-support-msg">How can we help?</Label>
          <Textarea id="inapp-support-msg" required rows={4} placeholder="Describe the issue…" />
        </div>
        <Button type="submit" className="w-full rounded-full font-semibold">
          Submit request
        </Button>
      </form>

      <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
        <div className="flex items-center gap-2 text-slate-700">
          <Mail className="h-4 w-4 text-primary" /> support@d4exam.com
        </div>
        <div className="flex items-center gap-2 text-slate-700">
          <Phone className="h-4 w-4 text-primary" /> +234 (0) 800 D4EXAM
        </div>
        <div className="flex items-center gap-2 text-slate-700">
          <Clock className="h-4 w-4 text-primary" /> Mon–Fri, 8:00–18:00 WAT
        </div>
      </div>

      <div>
        <h3 className="text-sm font-bold text-slate-900">Frequently asked questions</h3>
        <Accordion type="single" collapsible className="mt-2">
          {faqs.map((f, i) => (
            <AccordionItem key={f.q} value={`faq-${i}`}>
              <AccordionTrigger className="text-left text-sm">{f.q}</AccordionTrigger>
              <AccordionContent className="text-sm text-slate-600">{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </div>
  );
}

function PrivacyBody() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-extrabold text-slate-900">Privacy Policy</h2>
        <p className="mt-1 text-xs text-slate-500">Last updated: 11 August 2026</p>
      </div>
      {privacySections.map((s) => (
        <section key={s.title}>
          <h3 className="text-sm font-semibold text-slate-900">{s.title}</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{s.body}</p>
        </section>
      ))}
    </div>
  );
}

function PricingBody() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-extrabold text-slate-900">Pricing</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Plans sized for technical schools, colleges, polytechnics and universities. All plans
          include secure CBT delivery and role-based portals. Your school administrator manages the
          active plan.
        </p>
      </div>

      <div className="grid gap-4">
        {plans.map((p) => (
          <div
            key={p.name}
            className={`rounded-xl border p-4 shadow-sm ${
              p.highlight
                ? "border-primary bg-blue-50/40 ring-1 ring-primary/20"
                : "border-slate-200 bg-white"
            }`}
          >
            <p className="text-xs font-semibold text-primary">{p.audience}</p>
            <h3 className="mt-0.5 text-lg font-extrabold text-slate-900">{p.name}</h3>
            <p className="mt-2">
              <span className="text-2xl font-extrabold text-slate-900">{p.price}</span>
              <span className="ml-1 text-xs text-slate-500">{p.period}</span>
            </p>
            <ul className="mt-3 space-y-1.5">
              {p.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-xs text-slate-700">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <p className="text-center text-xs text-slate-500">
        Need Enterprise or multi-campus? Contact support or your Super Admin.
      </p>
    </div>
  );
}

export function InAppHelpLegal({ doc }: { doc: HelpLegalDoc }) {
  if (doc === "about") return <AboutBody />;
  if (doc === "support") return <SupportBody />;
  if (doc === "privacy") return <PrivacyBody />;
  return <PricingBody />;
}

export function helpLegalTitle(doc: HelpLegalDoc): string {
  if (doc === "about") return "About Us";
  if (doc === "support") return "Support";
  if (doc === "privacy") return "Privacy Policy";
  return "Pricing";
}
