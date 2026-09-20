# D4EXAM — Teacher User Manual (App & Website)

Teachers create papers, set security, upload materials, mark, and **monitor only exams for courses they are assigned to**.

---

## 1. Access

1. Login / app lock (fingerprint or app password).
2. Land on **Teacher Dashboard** (`/teacher`).

---

## 2. Dashboard

- Overview of your courses, upcoming exams, submissions to mark.
- Nav: Examinations, Question bank, Materials, Results, Live exams / monitoring (where enabled), Integrity, Notifications, Settings, Profile.

---

## 3. Courses (`/teacher/courses`)

- Courses assigned to you by School Admin.
- You only manage exams/materials for these courses.

---

## 4. Question bank (`/teacher/question-bank`)

1. Create/edit objective (and other supported) questions.
2. Tag by course/topic where available.
3. Reuse questions when building exam papers.

---

## 5. Examinations (`/teacher/examinations`)

1. Create exam: title, course, schedule, duration, instructions.
2. Attach paper / select questions; set **questions to answer** if applicable.
3. Configure **Exam security** (or use `/teacher/exam-security` defaults):
   - Calculator off / basic / scientific  
   - Camera / face rules  
   - Tab switch / fullscreen rules  
   - Screen share mode if used  
   - Threshold actions (warn / pause / terminate) — **students cannot turn these off in Settings**
4. Submit for approval if your school requires **Departmental Officer** approval.
5. After approval and schedule, students can start in window.

**Exam paper editor** (`/teacher/exam-paper/$id`)  
- Build structure, order questions, preview.

---

## 6. Live exams / monitoring (`/teacher/live-exams` and monitoring UI)

- You see students **writing exams you (or co-teachers on the same course) are responsible for** — not unrelated department levels.
- Similar tools to officer monitor where enabled: camera/screen tiles, pause/resume, warn, integrity signals.
- Focus mode: equal attention to camera and screen share when both exist.
- Desktop-view toggle applies on **app** monitoring where implemented (not a substitute for real laptop layout on pure mobile CSS).

---

## 7. Integrity (`/teacher/integrity`)

- Review integrity logs for your exams (tab switches, face events, etc.).
- Coordinate with Departmental Officer for serious cases.

---

## 8. Submissions & marking (`/teacher/submissions`, `/teacher/marking`)

1. Open submissions for an exam.
2. Mark as required (auto-score objectives may already be computed).
3. Publish/release only according to school workflow (officer/admin may control final publish).

---

## 9. Results (`/teacher/results`)

- View results for your course exams.
- Export/print if the UI provides it.

---

## 10. Materials (`/teacher/materials`) — **My Materials**

1. You see **only materials you uploaded**.
2. Upload: title, course, type, description, tags, file(s).
3. Prefer uploading **original PDFs/files** (optional “combine images to PDF” can increase size — leave off unless needed).
4. Students see your uploads with a **Teacher** role badge.
5. **No Study Help** on teacher account (Study Help is student-only).

---

## 11. Notifications & Profile

- Same pattern as other roles; integrity and exam events matter most for teachers.

---

## 12. Settings (`/teacher/settings`)

- Language, timezone, compact tables, reduced motion, appearance  
- Notification toggles  
- App unlock password & fingerprint  
- Offline/storage when available  
- **Do not expect** personal Settings to weaken exam security defaults for students  

---

## 13. Security responsibilities (teacher)

- Set fair but clear security before the exam window.
- Monitor live when possible.
- Never share student credentials.
- Report platform issues to School Admin / Officer.

---

*End of Teacher Manual*
