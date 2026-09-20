# D4EXAM — Student User Manual (App & Website)

This guide explains **how students use D4EXAM** page by page. User-generated content (your answers, material titles from teachers) stays as written; the app interface language follows **Settings → Language**.

---

## 1. Getting in (Login, App Lock, Fingerprint)

1. Open the **D4EXAM app** or website.
2. You see the **splash**, then either:
   - **App lock**: fingerprint (if your device supports it and you enabled it), or **Use password** (app unlock password — not the same as school login if your school set both).
   - **Login**: school code / credentials as provided by your school admin.
3. **Forgot app password**: use the link on the lock screen → follow email/reset flow → after unlock, set a new app password in **Settings → Security**.
4. Devices **without** fingerprint only show password unlock.
5. After unlock you land on the **Student Dashboard**.

**Security notes**
- App unlock protects the device session; exam security (camera, fullscreen) is separate and controlled by the exam settings your teacher/officer configured.
- Fingerprint is **not** required mid-exam start in the way the lock screen works when entering the app — exam start uses the exam flow’s own rules.

---

## 2. Dashboard (`/student`)

What you typically see:
- Welcome / school branding  
- Shortcuts to **Examinations**, **Results**, **Materials**, **Courses**  
- Live or upcoming exam cards when something is active  
- Notifications badge in the top bar  

**How to use**
- Tap a card or bottom/side nav item to open that area.
- Use **Search** (top) for global search within what your role is allowed to see (exams, materials, courses — not other students’ private data).

---

## 3. Examinations (`/student/examinations`)

1. Open **Examinations**.
2. Find the exam (title, course, schedule).
3. Check window: start time / end time (shown in your **Settings → Time zone** preference when formatting is enabled).
4. Tap **Start** / **Continue** when eligible.

**During CBT (Computer-Based Test)**
- Environment goes secure: fullscreen / focus as configured.
- **Timer** runs live; do not rely on pausing by leaving the app — leaving may log integrity events.
- **Calculator** appears only if the teacher enabled basic/scientific calculator for that paper.
- **Camera PIP** (picture-in-picture) may monitor face presence when enabled:  
  - One face monitoring  
  - No face detected  
  - Multiple faces detected (stronger haptic if enabled)
- Answer questions; navigate with next/previous; review before submit.
- **Submit**: confirm card shows unanswered count; confirm only when ready.
- Time-up may auto-submit depending on exam rules.

**If you leave and return**
- Prefer **Continue exam** from dashboard/examinations so the **same attempt** resumes (timer continues from remaining time).

---

## 4. Single exam session (`/student/exam/$id`)

- Full exam UI: question, options, flag/review if provided, timer, submit.
- Do not rotate away or open other apps if integrity rules forbid it — violations may be logged for officers/teachers.

---

## 5. Results (`/student/results`, `/student/results/$id`)

1. Open **Results**.
2. See published results only (unpublished stay hidden).
3. Open a result for breakdown if your school releases scores/details.

---

## 6. Materials (`/student/materials`)

1. Open **Materials** / Learning Materials.
2. Browse by category (Notes, Assignments, Past Questions, Others).
3. Badges show **Teacher** or **Student** uploader **role only** (not personal names on cards).
4. **Tap a card** to open the viewer (no need for separate Open buttons).

**Viewer**
- **PDF**: full-width pages; scroll; More menu can switch vertical/horizontal page mode; zoom where available.
- **Images**: pinch zoom, pan, double-tap zoom.
- **Text (.txt, etc.)**: readable in-app.
- **Download**: saves the file to your device when the browser/app allows.
- **Share**: opens the **native share sheet** (WhatsApp, Files, etc.) when supported; otherwise copies a link.
- **Study Help** (students only): red control → related educational YouTube videos from course/title/topic/content signals.  
  - Search icon: search any educational topic.  
  - Play video in D4EXAM-branded player; fullscreen for landscape/portrait.  
  - Offline: Study Help shows unavailable message; downloaded materials still open.

---

## 7. Courses (`/student/courses`)

- List of enrolled courses.
- Use as reference for codes/names linked to exams and materials.

---

## 8. Notifications (`/student/notifications`)

- In-app list of reminders, results, announcements.
- Controlled partly by **Settings → Notifications** toggles and push permission.

---

## 9. Profile (`/student/profile`)

- View your name, matric, programme details as set by the school.
- Update only fields your school allows.

---

## 10. Settings (`/student/settings`)

### Preferences
- **Language** — UI language (English, French, …). Interface only; not PDF contents.
- **Time zone** — how times are shown to you.
- **Appearance** — System / Light / Dark (when enabled).
- **Compact tables** — denser lists.
- **Reduced motion** — fewer animations.

### Notifications
- Examination reminders, results, integrity alerts, product announcements, native push.

### Security
- **Change app unlock password**
- **Fingerprint unlock**
- Sign out / switch account if offered

### Offline & storage (when enabled)
- See downloads, clear cache, last sync.

### Help / About
- Terms, privacy, help documents, app version.

**Save**: use Save where shown; language/theme should apply immediately when fully wired.

---

## 11. Offline behaviour

- Opening the app offline should still show splash → lock → dashboard for cached areas.
- **You cannot write a live exam offline** (requires connectivity and integrity services).
- Downloaded materials can open offline; Study Help cannot fetch new YouTube results offline.

---

## 12. Troubleshooting (student)

| Issue | What to try |
|--------|-------------|
| Download does nothing | Check network; allow storage/downloads; try again from viewer More menu |
| PDF looks tiny | Update app; PDF should fit width — zoom if needed |
| Camera stuck “detecting” | Return to exam tab; grant camera permission; stable lighting |
| App lock loops | Use password once; re-enrol fingerprint in Settings |
| Study Help empty | Need internet + school server YouTube key configured |

---

*End of Student Manual*
