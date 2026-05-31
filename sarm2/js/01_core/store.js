/* ══════════════════════════════════════════════
   SARM · app.js  v4
   Student Academic Record Management System
   University of Eastern Philippines · College of Science

   FEATURES
   ──────────────────────────────────────────────
   ✔  Role-based access: Registrar, Dean, Chairman, Faculty, Student
   ✔  Proper record archiving (enrolled/inactive/graduated/archived)
   ✔  Grade validation + Save Draft workflow
   ✔  Grade locking — Lock & Submit routes grades to students
   ✔  Semester trend analysis
   ✔  Early Warning System (at-risk detection)
   ✔  GPA trend sparklines per student
   ✔  Bottleneck subject detection
   ✔  Account lockout after 5 failed attempts
   ✔  Auto-backup every 5 minutes
   ✔  Faculty doubles as Adviser — My Advisees module
══════════════════════════════════════════════ */

'use strict';

/* ──────────────────────────────────────────────
   STORE
────────────────────────────────────────────── */
const STORE_KEY = 'sarm_v4';

// On every page load: wipe ALL old sarm_ keys regardless of version
(function clearOldKeys() {
  try {
    const toRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('sarm_') && k !== STORE_KEY) toRemove.push(k);
    }
    toRemove.forEach(k => localStorage.removeItem(k));
  } catch {}
})();

function loadStore() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveStore(d) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(d)); } catch {}
}

// Called by the Reset Demo Data button on the login screen
function resetStore() {
  // Wipe everything sarm-related
  try {
    const toRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('sarm_')) toRemove.push(k);
    }
    toRemove.forEach(k => localStorage.removeItem(k));
  } catch {}
  DB = initStore();
  const errEl = document.getElementById('login-error');
  errEl.textContent = '✔ Data reset. You can now log in with the demo accounts below.';
  errEl.style.cssText = 'background:#f0fdf4;border:1px solid #86efac;color:#16a34a;border-radius:10px;padding:11px 15px;font-size:.85rem;margin-bottom:16px;font-weight:500;display:block';
}

function initStore() {
  let ex = null;
  try { ex = loadStore(); } catch {}
  // Only reuse valid v4 data with a populated users array
  if (ex && ex._v === 4 && Array.isArray(ex.users) && ex.users.length > 0) return ex;
  // Otherwise wipe and reseed
  try { localStorage.removeItem(STORE_KEY); } catch {}

  const d = {
    _v: 4,

    users: [
      { id:1, name:'Registrar Office', role:'Registrar', username:'registrar', password:'reg123', active:true, created:'2024-01-01', failedAttempts:0, lockedOut:false },
    ],

    colleges:    [],
    departments: [],
    subjects:    [],
    sections:    [],
    students:    [],
    enrollments: [],
    grades:      [],

    auditLog: [
      { id:1, user:'system', action:'System initialized — SARM v4', ip:'127.0.0.1', ts: new Date().toISOString().replace('T',' ').slice(0,19), ok:true },
    ],

    backupLog:   [],
    lastBackup:  null,
    backupCount: 0,

    nextId: { user:2, section:1, enrollment:1, grade:1, audit:2, college:1, dept:1, student:100001 },
  };

  saveStore(d);
  return d;
}

let DB          = initStore();
let currentUser = null;

function save() { saveStore(DB); }

function logAudit(action, ok = true) {
  if (!currentUser) return;
  const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);
  DB.auditLog.unshift({
    id:     DB.nextId.audit++,
    user:   currentUser.username,
    action,
    ip:     '192.168.1.' + (Math.floor(Math.random() * 20) + 10),
    ts,
    ok,
  });
  if (DB.auditLog.length > 200) DB.auditLog.length = 200;
  save();
}


/* ──────────────────────────────────────────────
   HELPERS
