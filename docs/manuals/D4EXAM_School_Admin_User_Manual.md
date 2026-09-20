# D4EXAM — School Admin User Manual

School Admins configure structure, users, and school identity. They do **not** replace invigilation; officers/teachers run live exams.

---

## 1. Access

Login → **Admin Dashboard** (`/admin`).

---

## 2. Dashboard

- School-wide counts: students, teachers, exams, results snapshots.
- Nav into structure and people management.

---

## 3. Academic structure

Use in order when setting up a new school:

| Page | Route | Purpose |
|------|--------|---------|
| Faculties | `/admin/faculties` | Top academic units |
| Departments | `/admin/departments` | Under faculties |
| Levels | `/admin/levels` | e.g. 100–400 |
| Sessions | `/admin/sessions` | Academic year sessions |
| Semesters | `/admin/semesters` | Semester definitions |
| Courses | `/admin/courses` | Course codes/names; assign teachers |
| Structure | `/admin/structure` | Overview / linked structure tools |

**Tip:** Create faculty → department → courses before bulk-importing students.

---

## 4. People

### Students (`/admin/students`, `/admin/student/$id`, `/admin/student-import`)
1. Add individually or **import** CSV/list.
2. Assign department, level, matric numbers.
3. Open student record to edit status or details.

### Teachers (`/admin/teachers`)
- Create teacher accounts; assign to courses.

### Officers (`/admin/officers`)
- Departmental examination officers for approvals & monitoring scope.

### Users (`/admin/users`)
- Cross-role user administration where exposed.

---

## 5. Examinations & results (admin oversight)

- `/admin/examinations` — school-level exam list  
- `/admin/results` — publication oversight  
- `/admin/reports` — institutional reports  

Day-to-day paper creation remains **Teacher**; approval **Officer**.

---

## 6. Notifications (`/admin/notifications`)

- School-wide announcement tools where available.

---

## 7. Settings (`/admin/settings`)

### School identity
- **School name** and **logo** (square PNG/JPG) — appears on portal header and branded surfaces.

### Preferences
- Language (UI), timezone, compact tables, reduced motion, appearance.

### Security
- App unlock password, fingerprint, session/sign-out tools.

### Notifications / Push
- Admin-relevant alerts.

Admins should set timezone to **Africa/Lagos** (or Automatic) for Nigerian institutions so schedules display consistently.

---

## 8. Security & policy (admin)

- Provision real emails for password recovery where possible.
- Rotate officer/teacher access when staff leave.
- Do not disable platform integrity features globally for convenience.
- Privacy: student data is only for legitimate academic operations.

---

## 9. Profile (`/admin/profile`)

- Personal admin profile fields.

---

## 10. First-week setup checklist

1. School name + logo  
2. Faculties → departments → levels → session/semester  
3. Courses + assign teachers  
4. Create officers  
5. Import students  
6. Teachers create sample exam → officer approves → student trial  

---

*End of School Admin Manual*
