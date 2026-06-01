'use strict';

/* ══════════════════════════════════════════
   api.js — Central REST API Client
   Token-based auth via X-Auth-Token header
══════════════════════════════════════════ */

const API_BASE = `${window.location.origin}/repos/IPT2_Frontend/sarm/backend/api`;

// Global current user
let currentUser = null;

// ── Token storage ─────────────────────────
function getToken()         { return localStorage.getItem('sarm_token') || ''; }
function setToken(t)        { localStorage.setItem('sarm_token', t); }
function clearToken()       { localStorage.removeItem('sarm_token'); localStorage.removeItem('sarm_user'); }
function saveUser(u)        { localStorage.setItem('sarm_user', JSON.stringify(u)); }
function loadSavedUser()    { try { return JSON.parse(localStorage.getItem('sarm_user')); } catch { return null; } }

/* ── Core fetch wrapper ──────────────────
   Attaches X-Auth-Token on every request  */
async function apiFetch(path, options = {}) {
  const url    = `${API_BASE}/${path}`;
  const token  = getToken();
  const method = options.method || 'GET';

  const config = {
    method,
    credentials: 'include',
    headers: {
      'Content-Type':     'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      ...(token ? { 'X-Auth-Token': token } : {}),
    },
  };

  if (options.body) config.body = options.body;

  const res = await fetch(url, config);

  let json;
  try { json = await res.json(); }
  catch { throw { message: 'Server returned an invalid response.' }; }

  if (!json.success) throw { message: json.message || 'An error occurred.' };
  return json.data;
}

const api = {
  /* ── Auth ──────────────────────────── */
  login: async (username, password) => {
    const data = await apiFetch('auth/login.php', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    // Store token + user
    setToken(data.token);
    saveUser(data.user);
    return data.user;
  },
  logout: async () => {
    await apiFetch('auth/logout.php', { method: 'POST' }).catch(() => {});
    clearToken();
  },
  me: async () => {
    // Just restore from localStorage — token was already validated at login
    const saved = loadSavedUser();
    const token = getToken();
    if (!saved || !token) throw { message: 'No saved session.' };
    return saved;
  },

  /* ── Users ─────────────────────────── */
  getUsers:    ()     => apiFetch('users/get.php'),
  createUser:  (data) => apiFetch('users/create.php',  { method:'POST', body: JSON.stringify(data) }),
  updateUser:  (data) => apiFetch('users/update.php',  { method:'POST', body: JSON.stringify(data) }),

  /* ── Students ──────────────────────── */
  getStudents:   (params = {}) => apiFetch('students/get.php?'    + new URLSearchParams(params)),
  createStudent: (data)        => apiFetch('students/create.php',  { method:'POST', body: JSON.stringify(data) }),
  updateStudent: (data)        => apiFetch('students/update.php',  { method:'POST', body: JSON.stringify(data) }),

  /* ── Colleges & Departments ────────── */
  getColleges: () => apiFetch('colleges/get.php'),

  /* ── Subjects ──────────────────────── */
  getSubjects: (params = {}) => apiFetch('subjects/get.php?' + new URLSearchParams(params)),

  /* ── Sections ──────────────────────── */
  getSections:   (params = {}) => apiFetch('sections/get.php?'    + new URLSearchParams(params)),
  createSection: (data)        => apiFetch('sections/create.php',  { method:'POST', body: JSON.stringify(data) }),
  assignFaculty: (data)        => apiFetch('sections/assign.php',  { method:'POST', body: JSON.stringify(data) }),

  /* ── Enrollments ───────────────────── */
  getEnrollments:   (params = {}) => apiFetch('enrollments/get.php?'   + new URLSearchParams(params)),
  toggleEnrollment: (data)        => apiFetch('enrollments/toggle.php', { method:'POST', body: JSON.stringify(data) }),

  /* ── Grades ────────────────────────── */
  getGrades:    (params = {}) => apiFetch('grades/get.php?'    + new URLSearchParams(params)),
  saveGrade:    (data)        => apiFetch('grades/save.php',   { method:'POST', body: JSON.stringify(data) }),
  submitGrades: (data)        => apiFetch('grades/submit.php', { method:'POST', body: JSON.stringify(data) }),

  /* ── Graduates ─────────────────────── */
  getGraduates:   (params = {}) => apiFetch('graduates/get.php?'    + new URLSearchParams(params)),
  createGraduate: (data)        => apiFetch('graduates/create.php',  { method:'POST', body: JSON.stringify(data) }),

  /* ── Analytics ─────────────────────── */
  getAnalytics: (params = {}) => apiFetch('analytics/get.php?' + new URLSearchParams(params)),
};

/* ── UI helpers ──────────────────────── */
function setLoading(selector, on) {
  const el = typeof selector === 'string' ? document.querySelector(selector) : selector;
  if (!el) return;
  if (on) {
    el.dataset.origText = el.innerHTML;
    el.innerHTML = '<span style="opacity:.6">Loading…</span>';
    el.disabled  = true;
  } else {
    el.innerHTML = el.dataset.origText || el.innerHTML;
    el.disabled  = false;
  }
}

function apiErr(err, fallback = 'Something went wrong.') {
  const msg = err?.message || fallback;
  toast(msg, 'error');
  console.error('[API]', msg, err);
}