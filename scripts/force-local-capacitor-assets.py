#!/usr/bin/env python3
import json, pathlib
cfg = pathlib.Path("android/app/src/main/assets/capacitor.config.json")
if cfg.exists():
    d = json.loads(cfg.read_text())
    server = d.get("server") or {}
    server["url"] = "https://d4exam.name.ng"
    server["androidScheme"] = "https"
    server["errorPath"] = "offline.html"
    server["allowNavigation"] = [
        "d4exam.name.ng", "*.d4exam.name.ng", "d4exam-platform.vercel.app",
        "*.vercel.app", "*.supabase.co", "*.googleapis.com", "*.gstatic.com",
        "*.firebaseio.com", "*.firebasestorage.app", "*.firebaseapp.com", "localhost",
    ]
    d["server"] = server
    cfg.write_text(json.dumps(d, indent=2) + "\n")
    print("assets server.url =", server["url"])
else:
    print("WARN: no assets config yet")
