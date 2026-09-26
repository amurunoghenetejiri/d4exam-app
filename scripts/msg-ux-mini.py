from pathlib import Path

def main():
    p = Path("src/components/OfflineStatusPill.tsx")
    if p.exists():
        p.write_text('export function OfflineStatusPill() { return null; }\n')
        print("pill hidden")

    mm = Path("src/components/messaging/MessageMedia.tsx")
    if mm.exists():
        t = mm.read_text()
        t = t.replace(
            "            <span>{fmtDur(playing ? cur : 0)}</span>\n            <span className=\"opacity-50\">/</span>\n            <span className=\"opacity-80\">{fmtDur(dur)}</span>",
            "            <span>{fmtDur(playing ? cur : (dur > 0 ? dur : 0))}</span>",
        )
        t = t.replace("border-red-100 bg-gradient-to-b from-red-50", "border-blue-100 bg-gradient-to-b from-blue-50")
        t = t.replace("bg-red-500 text-white shadow-md", "bg-[#2563eb] text-white shadow-md")
        mm.write_text(t)
        print("media ok")

    for path in ["src/routes/student.contact-officer.tsx", "src/routes/officer.reports.tsx"]:
        p = Path(path)
        if not p.exists() or p.stat().st_size < 500:
            print("skip", path); continue
        t = p.read_text()
        t = t.replace(
            "      if (!isOnlineNow()) {\n        toast.error(\"Internet connection is required to send messages.\");\n        return;\n      }\n",
            "",
        )
        t = t.replace(
            "    if (!isOnlineNow()) {\n      toast.error(\"Internet connection is required to send messages.\");\n      return;\n    }\n",
            "",
        )
        t = t.replace('<ArrowLeft className="h-5 w-5" />', '<ArrowLeft className="h-5 w-5 text-white stroke-[2.5]" />')
        t = t.replace('<Mic className="h-4 w-4" />', '<Mic className="h-6 w-6" />')
        t = t.replace('<Paperclip className="h-5 w-5" />', '<Paperclip className="h-6 w-6" />')
        t = t.replace(
            'className={cn("mb-0.5 grid h-10 w-10 place-items-center rounded-full text-white", recording ? "bg-red-500" : "bg-[#0b1b3a]")}',
            'className={cn("mb-0.5 grid h-12 w-12 place-items-center rounded-full text-white shadow-md", recording ? "bg-[#2563eb]" : "bg-white/20 ring-2 ring-white/40")}',
        )
        t = t.replace(
            'className="mb-1 grid h-9 w-9 place-items-center rounded-full text-white/90 hover:bg-white/10" onClick={() => fileRef.current?.click()}',
            'className="mb-0.5 grid h-11 w-11 place-items-center rounded-full bg-white/15 text-white hover:bg-white/25" onClick={() => fileRef.current?.click()}',
        )
        t = t.replace(
            'className="mb-0.5 grid h-10 w-10 place-items-center rounded-full bg-[#2563eb] text-white"',
            'className="mb-0.5 grid h-12 w-12 place-items-center rounded-full bg-[#2563eb] text-white shadow-md"',
        )
        t = t.replace(
            'text-left text-sm hover:bg-slate-50" onClick={() => { setRenameVal',
            'text-left text-sm font-semibold text-slate-900 hover:bg-slate-50" onClick={() => { setRenameVal',
        )
        t = t.replace(
            'text-left text-sm font-medium text-slate-800 hover:bg-slate-50"',
            'text-left text-sm font-semibold text-slate-900 hover:bg-slate-50"',
        )
        p.write_text(t)
        print("route", path)

main()
print("DONE")
