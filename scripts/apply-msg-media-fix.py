#!/usr/bin/env python3
"""Apply MessageMedia from base64 env + patch student/officer routes."""
import base64
import os
import pathlib
import re

ROOT = pathlib.Path(".")

def write_mm():
    parts = os.environ.get("MM_B64", "").split("|")
    data = base64.b64decode("".join(parts))
    path = ROOT / "src/components/messaging/MessageMedia.tsx"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    print("wrote MessageMedia", len(data))

def patch_student(p: pathlib.Path):
    if not p.exists():
        print("skip student", p)
        return
    t = p.read_text()
    if "VideoBubble" not in t:
        t = t.replace(
            "VoiceBubble, ImageBubble, ImageLightbox, LongPressMenu, VoiceRecorderBar, lastSeenLabel, parseMediaUrls, attachmentLabel, parseOfficerReply",
            "VoiceBubble, ImageBubble, ImageLightbox, VideoBubble, FileBubble, VideoLightbox, LongPressMenu, VoiceRecorderBar, lastSeenLabel, parseMediaUrls, attachmentLabel, parseOfficerReply",
        )
        t = t.replace(
            "VoiceBubble, ImageBubble, ImageLightbox, VoiceRecorderBar, lastSeenLabel, parseMediaUrls, attachmentLabel, parseOfficerReply",
            "VoiceBubble, ImageBubble, ImageLightbox, VideoBubble, FileBubble, VideoLightbox, VoiceRecorderBar, lastSeenLabel, parseMediaUrls, attachmentLabel, parseOfficerReply",
        )
    t = t.replace('<Mic className="h-7 w-7 stroke-[2.5]" />', '<Mic className="h-5 w-5 stroke-[2.5]" />')
    t = t.replace('<Mic className="h-7 w-7" />', '<Mic className="h-5 w-5" />')
    t = t.replace(
        "const [replyTo, setReplyTo] = useState<{ id: string; text: string } | null>(null);",
        "const [replyTo, setReplyTo] = useState<{ id: string; text: string; fromSelf?: boolean } | null>(null);",
    )
    if "videoLightboxSrc" not in t and "lightboxSrc" in t:
        t = t.replace(
            "const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);",
            "const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);\n  const [videoLightboxSrc, setVideoLightboxSrc] = useState<string | null>(null);",
        )
    img_end = ")()\n              ) : (\n                <div\n                  id={`msg-${m.key}`}"
    video_file = ")()\n              ) : (m.attachment_type === \"video\" || m.attachment_type === \"videos\") && m.attachment_url ? (\n                <VideoBubble id={`msg-${m.key}`} src={parseMediaUrls(m.attachment_url)[0]} mine={m.side === \"out\"} timeLabel={formatTime(m.at)} tick={m.side === \"out\" ? outTick : \"none\"} onOpen={() => setVideoLightboxSrc(parseMediaUrls(m.attachment_url)[0])} />\n              ) : m.attachment_type === \"file\" && m.attachment_url ? (\n                <FileBubble id={`msg-${m.key}`} src={m.attachment_url} mine={m.side === \"out\"} timeLabel={formatTime(m.at)} tick={m.side === \"out\" ? outTick : \"none\"} />\n              ) : (\n                <div\n                  id={`msg-${m.key}`}"
    if img_end in t and "VideoBubble id" not in t:
        t = t.replace(img_end, video_file, 1)
    t = re.sub(
        r'\s*\{m\.attachment_type === "file" && m\.attachment_url \? \(\s*<button[^>]*>[\s\S]*?Open attachment[\s\S]*?</button>\s*\) : null\}\s*',
        "\n",
        t,
        count=1,
    )
    if "fromSelf: m.side === \"out\"" not in t:
        t = t.replace(
            'text: (m.text && m.text !== "(attachment)" ? m.text : m.attachment_type || "Attachment").slice(0, 120),',
            'text: (m.text && m.text !== "(attachment)" ? m.text : attachmentLabel(m.attachment_type, m.attachment_url)).slice(0, 120),\n                      fromSelf: m.side === "out",',
        )
    if 'replyTo.fromSelf ? "You"' not in t:
        t = t.replace(
            '<p className="text-[11px] font-bold text-blue-800">{officerNickname}</p>',
            '<p className="text-[11px] font-bold text-blue-800">{replyTo.fromSelf ? "You" : officerNickname}</p>',
        )
    if "videoLightboxSrc ?" not in t:
        t = t.replace(
            "{lightboxSrc ? (",
            "{videoLightboxSrc ? (\n        <VideoLightbox src={videoLightboxSrc} onClose={() => setVideoLightboxSrc(null)} />\n      ) : null}\n      {lightboxSrc ? (",
        )
    p.write_text(t)
    print("patched student", p)

def patch_officer(p: pathlib.Path):
    if not p.exists():
        print("skip officer", p)
        return
    t = p.read_text()
    if "VideoBubble" not in t:
        t = t.replace(
            "VoiceBubble, ImageBubble, ImageLightbox, VoiceRecorderBar, lastSeenLabel, parseMediaUrls, attachmentLabel, encodeOfficerMedia, parseOfficerReply",
            "VoiceBubble, ImageBubble, ImageLightbox, VideoBubble, FileBubble, VideoLightbox, VoiceRecorderBar, lastSeenLabel, parseMediaUrls, attachmentLabel, encodeOfficerMedia, parseOfficerReply",
        )
    t = t.replace('<Mic className="h-7 w-7 stroke-[2.5]" />', '<Mic className="h-5 w-5 stroke-[2.5]" />')
    t = t.replace(
        "const [replyTo, setReplyTo] = useState<{ id: string; text: string } | null>(null);",
        "const [replyTo, setReplyTo] = useState<{ id: string; text: string; fromSelf?: boolean } | null>(null);",
    )
    if "videoLightboxSrc" not in t and "lightboxSrc" in t:
        t = t.replace(
            "const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);",
            "const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);\n  const [videoLightboxSrc, setVideoLightboxSrc] = useState<string | null>(null);",
        )
    p.write_text(t)
    print("patched officer", p)

if __name__ == "__main__":
    write_mm()
    patch_student(ROOT / "src/routes/student.contact-officer.tsx")
    patch_officer(ROOT / "src/routes/officer.reports.tsx")
    print("done")
