'use strict';

/* ══════════════════════════════════════════
   STORE — SARM Simplified
   Roles: Registrar, Dean, Chairman, Faculty, Student
══════════════════════════════════════════ */

const STORE_KEY = 'sarm_simple_v1';

function loadStore() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveStore(d) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(d)); } catch {}
}

function resetStore() {
  try { localStorage.removeItem(STORE_KEY); } catch {}
  DB = initStore();
  const errEl = document.getElementById('login-error');
  errEl.textContent = '✔ Data reset. You can now log in with the demo accounts.';
  errEl.className = 'alert alert-success';
  errEl.classList.remove('hidden');
}

function initStore() {
  const ex = loadStore();
  if (ex && ex._v === 1 && Array.isArray(ex.users) && ex.users.length > 0) return ex;
  try { localStorage.removeItem(STORE_KEY); } catch {}

  const d = {
    _v: 1,

    /* ── Users ────────────────────────── */
    users: [
      { id: 1, name: 'Registrar Office',  role: 'Registrar', username: 'registrar', password: 'reg123',   active: true, collegeId: null, deptId: null, studentId: null },
      { id: 2, name: 'Dean Maria Santos', role: 'Dean',       username: 'dean1',     password: 'dean123',  active: true, collegeId: 1,    deptId: null, studentId: null },
      { id: 3, name: 'Chairman Jose Reyes',role:'Chairman',   username: 'chair1',    password: 'chair123', active: true, collegeId: 1,    deptId: 1,    studentId: null },
      { id: 4, name: 'Prof. Ana Cruz',    role: 'Faculty',    username: 'fac1',      password: 'fac123',   active: true, collegeId: 1,    deptId: 1,    studentId: null },
      { id: 5, name: 'Prof. Ben Lim',     role: 'Faculty',    username: 'fac2',      password: 'fac456',   active: true, collegeId: 1,    deptId: 1,    studentId: null },
    ],

    /* ── Colleges & Departments ───────── */
    colleges: [
      { id: 1, name: 'College of Science' },
    ],
    departments: [
      { id: 1, name: 'Information Technology', collegeId: 1 },
      { id: 2, name: 'Computer Science',        collegeId: 1 },
    ],

    /* ── Subjects ────────────────────── */
    subjects: [
      { id: 1, code: 'IT101', name: 'Introduction to Computing',    units: 3, year: 1, sem: '1st', deptId: 1 },
      { id: 2, code: 'IT102', name: 'Computer Programming 1',       units: 3, year: 1, sem: '1st', deptId: 1 },
      { id: 3, code: 'IT201', name: 'Data Structures & Algorithms', units: 3, year: 2, sem: '1st', deptId: 1 },
      { id: 4, code: 'IT202', name: 'Web Development',              units: 3, year: 2, sem: '1st', deptId: 1 },
      { id: 5, code: 'IT301', name: 'Database Management',          units: 3, year: 3, sem: '1st', deptId: 1 },
    ],

    /* ── Sections (subject + faculty assignment) ── */
    sections: [
      { id: 1, subjectId: 1, facultyId: 4, sectionName: 'IT1A', sy: '2024-2025', sem: '1st', submitted: true },
      { id: 2, subjectId: 2, facultyId: 4, sectionName: 'IT1A', sy: '2024-2025', sem: '1st', submitted: true },
      { id: 3, subjectId: 3, facultyId: 5, sectionName: 'IT2A', sy: '2024-2025', sem: '1st', submitted: true },
      { id: 4, subjectId: 4, facultyId: 5, sectionName: 'IT2A', sy: '2024-2025', sem: '1st', submitted: true },
      { id: 5, subjectId: 5, facultyId: 4, sectionName: 'IT3A', sy: '2024-2025', sem: '1st', submitted: false },
    ],

    /* ── Students ────────────────────── */
    students: [
      { id: '238101', name: 'Alice Mendoza',    deptId: 1, year: 1, birthday: '02242003', status: 'enrolled' },
      { id: '238102', name: 'Brian Santos',     deptId: 1, year: 1, birthday: '06151003', status: 'enrolled' },
      { id: '238103', name: 'Carla Reyes',      deptId: 1, year: 2, birthday: '11302002', status: 'enrolled' },
      { id: '238104', name: 'Dennis Cruz',      deptId: 1, year: 2, birthday: '04082002', status: 'enrolled' },
      { id: '238105', name: 'Eva Lim',          deptId: 1, year: 3, birthday: '09192001', status: 'enrolled' },
      { id: '238106', name: 'Frank Torres',     deptId: 2, year: 1, birthday: '12252003', status: 'enrolled' },
    ],

    /* ── Enrollments ─────────────────── */
    enrollments: [
      // Year 1 students in sections 1,2
      { id: 1, studentId: '238101', sectionId: 1 },
      { id: 2, studentId: '238101', sectionId: 2 },
      { id: 3, studentId: '238102', sectionId: 1 },
      { id: 4, studentId: '238102', sectionId: 2 },
      // Year 2 students in sections 3,4
      { id: 5, studentId: '238103', sectionId: 3 },
      { id: 6, studentId: '238103', sectionId: 4 },
      { id: 7, studentId: '238104', sectionId: 3 },
      { id: 8, studentId: '238104', sectionId: 4 },
      // Year 3 student in section 5
      { id: 9, studentId: '238105', sectionId: 5 },
    ],

    /* ── Grades ──────────────────────── */
    grades: [
      // Alice: passed both
      { id: 1, studentId: '238101', sectionId: 1, grade: 1.5 },
      { id: 2, studentId: '238101', sectionId: 2, grade: 2.0 },
      // Brian: failed one
      { id: 3, studentId: '238102', sectionId: 1, grade: 5.0 },
      { id: 4, studentId: '238102', sectionId: 2, grade: 2.5 },
      // Carla: passed both
      { id: 5, studentId: '238103', sectionId: 3, grade: 1.75 },
      { id: 6, studentId: '238103', sectionId: 4, grade: 2.25 },
      // Dennis: failed one
      { id: 7, studentId: '238104', sectionId: 3, grade: 3.0 },
      { id: 8, studentId: '238104', sectionId: 4, grade: 5.0 },
    ],

    /* ── Next IDs ────────────────────── */
    nextId: { user: 6, section: 6, enrollment: 10, grade: 9, student: 238107 },
  };

  saveStore(d);
  return d;
}

let DB          = initStore();
let currentUser = null;

function save() { saveStore(DB); }
