# SARM — Student Academic Record Management System
**University of Eastern Philippines · College of Science · IPT2**

---

## Quick Start

1. Place all files in the **same folder**
2. Add your logo as `assets/logo.png`
3. Open `index.html` in a browser
4. Login: `registrar` / `reg123`

> No server required — runs entirely in the browser via localStorage.

---

## Project Structure

```
sarm/
├── index.html                    ← Modular entry point
├── index_singlefile.html         ← Single-file fallback (uses app.js)
├── app.js                        ← Complete single-file JS (4,872 lines)
├── styles.css                    ← Design system
├── assets/
│   └── logo.png                  ← Your logo here
└── js/
    ├── 01_core/
    │   ├── store.js              ← Data layer ← REPLACE for backend
    │   ├── helpers.js            ← Pure utility functions
    │   ├── ui_atoms.js           ← Shared UI builders
    │   └── modal.js              ← Modal engine + toast
    │
    ├── 02_user_management/
    │   ├── auth.js               ← Login, logout, session, navigation
    │   └── users.js              ← User CRUD, role enforcement
    │
    ├── 03_academic_record_management/
    │   ├── dashboard.js          ← Role dashboards
    │   ├── performance.js        ← Academic performance views
    │   ├── college.js            ← Dean college view
    │   └── assignment.js         ← Subject/section/faculty assignment
    │
    ├── 04_student_record_management/
    │   ├── students.js           ← Student records CRUD (Registrar)
    │   ├── chair_students.js     ← Student records read-only (Chairman)
    │   ├── archives.js           ← Archive & restore
    │   └── colleges_admin.js     ← Colleges & departments CRUD
    │
    ├── 05_grade_management/
    │   └── faculty.js            ← Encode grades, handled sections, advisees
    │
    ├── 06_curriculum_assessment/
    │   └── curriculum.js         ← Subjects by year level + prerequisites
    │
    ├── 07_analytics_module/
    │   └── analytics.js          ← Descriptive analytics, filters, charts
    │
    └── 08_student_portal/
        ├── student_portal.js     ← My Grades + Academic Progress kiosk
        └── security.js           ← Audit trail + backup (Registrar)
```

---

## Module Descriptions

| Module | Roles | Key Features |
|---|---|---|
| **01 Core** | All | Data layer, utilities, modal engine |
| **02 User Management** | Registrar | Login, accounts, role enforcement |
| **03 Academic Record** | Registrar, Dean, Chairman | Dashboards, performance, section assignment |
| **04 Student Records** | Registrar, Chairman | Student CRUD, archives, colleges & depts |
| **05 Grade Management** | Faculty | Grade encoding, INC, submit grades |
| **06 Curriculum** | Registrar | Subjects, year levels, prerequisites |
| **07 Analytics** | Registrar, Dean, Chairman | Trends, EWS, GPA, bottleneck, comparison |
| **08 Student Portal** | Student | My grades, progress tracker |

---

## Login

**Staff** — Toggle "No" → Username + Password  
**Student** — Toggle "Yes" → Student ID (6-digit) + Birthday (mmddyyyy)  
Default admin: `registrar` / `reg123`

---

## Grade Scale

| Grade | Description |
|---|---|
| 1.00 | Excellent |
| 1.25–1.50 | Very Good |
| 1.75–2.00 | Good |
| 2.25–2.50 | Satisfactory |
| 2.75–3.00 | Passing |
| 5.00 | Failed |
| **INC** | **Incomplete** (excluded from GPA calculations) |

---

## Backend Migration

Only replace `js/01_core/store.js` — all 138 other functions remain unchanged.

*Vanilla HTML + CSS + JavaScript. Zero dependencies.*
