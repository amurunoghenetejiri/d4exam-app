# D4EXAM — Departmental Officer User Manual

Officers approve exams, monitor live sessions for their department scope, manage integrity, results visibility, and student communications.

---

## 1. Access

Login / app lock → **Officer Dashboard** (`/officer`).

---

## 2. Dashboard

- Live exam counts should reflect **active** writing sessions (not finished/offline leftovers when fixed).
- Pending approvals badge.
- Shortcuts to Live Monitor, Approvals, Results, Integrity, Audit logs.

---

## 3. Approvals (`/officer/approvals`)

1. Open pending exam requests from teachers.
2. Review paper settings, duration, security summary.
3. **Approve** or **Reject** with reason if required.
4. Approved exams become available to students in schedule.

---

## 4. Live Monitor (`/officer/live-monitor`)

**Purpose:** See students currently writing, with camera and/or screen share.

**How to use**
1. Open Live Monitor.
2. Filter by **level / course / exam** when multiple cohorts write at once — pick the cohort you intend to watch.
3. Grid of student cards: identity, timer, status, live feeds.
4. **Focus mode**: enlarge one student; camera and screen share should be equal height when both exist.
5. Actions (when wired): **Pause / Resume**, **Terminate**, **Submit**, **Send warning** — these must apply to the **current attempt**, not an old finished exam.
6. Integrity strip/events: face missing, multiple faces, tab issues — treat as operational signals.
7. Alerts should not permanently block the grid (dismissible / non-blocking).

**Matching rule (important)**  
Monitoring must follow the attempt the student is writing **now** (started_at / attempt id), not a previous paper from hours ago.

---

## 5. Integrity (`/officer/integrity`)

- Search/filter events by exam, student, time.
- Export or escalate per school policy.

---

## 6. Results (`/officer/results`)

- Oversee publication state.
- Coordinate with teachers on marking completion.

---

## 7. Reports & Audit logs (`/officer/reports`, `/officer/audit-logs`)

- Operational reports.
- Audit: who approved what, critical actions.

---

## 8. Post to students (`/officer/post-to-students`)

- Send announcements to student cohorts (respect notification prefs where applicable).

---

## 9. Notifications, Profile, Settings

- Same Settings architecture: language, timezone, compact tables, reduced motion, push, app lock.
- Officers should keep **integrity alerts** enabled.

---

## 10. Exam preview (`/officer/exam-preview/$id`)

- Preview paper as configured before/during approval without altering student attempts.

---

## 11. Operational checklist (exam day)

1. Confirm approvals done  
2. Open Live Monitor before start window  
3. Verify feeds for a sample of students  
4. Watch integrity queue  
5. Use pause/warn sparingly and document  
6. After window: confirm submissions / time-ups  

---

*End of Officer Manual*
