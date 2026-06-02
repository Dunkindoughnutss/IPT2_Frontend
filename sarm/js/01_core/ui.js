'use strict';

/* ══════════════════════════════════════════
   UI — Navigation, Toast, Modal, Render
══════════════════════════════════════════ */

const NAV = [
  { key:'dashboard',     label:'Dashboard',            icon:'⬡', roles:['Registrar','Dean','Chairman','Faculty'] },
  // Registrar
  { key:'reg-accounts',        label:'Account Management',   icon:'◈', roles:['Registrar'] },
  { key:'reg-assign',          label:'Dean & Chair Assign',  icon:'◇', roles:['Registrar'] },
  { key:'reg-student-records', label:'Student Records',      icon:'📚', roles:['Registrar'] },
  { key:'reg-perf',            label:'Academic Performance', icon:'◎', roles:['Registrar'] },
  { key:'reg-analytics',       label:'Data Analytics',       icon:'▣', roles:['Registrar'] },
  { key:'reg-archives',        label:'Graduate Archives',    icon:'◫', roles:['Registrar'] },
  // Dean
  { key:'dean-perf',      label:'Academic Performance',icon:'◎', roles:['Dean'] },
  { key:'dean-analytics', label:'Data Analytics',      icon:'▣', roles:['Dean'] },
  { key:'dean-archives',  label:'Graduate Archives',   icon:'◫', roles:['Dean'] },
  // Chairman
  { key:'chair-assign',   label:'Subject Assignment',  icon:'◇', roles:['Chairman'] },
  { key:'chair-failing',  label:'Failing Students',    icon:'⚠', roles:['Chairman'] },
  { key:'chair-analytics',label:'Data Analytics',      icon:'▣', roles:['Chairman'] },
  { key:'chair-archives', label:'Graduate Archives',   icon:'◫', roles:['Chairman'] },
  // Faculty
  { key:'fac-encode',    label:'Encode Grades',        icon:'✍', roles:['Faculty'] },
  // Student
  { key:'stu-grades',    label:'My Grades',            icon:'◉', roles:['Student'] },
];

const PAGE_RENDERERS = {};

function registerPage(key, fn) {
  PAGE_RENDERERS[key] = fn;
}

let currentPage = null;

function navigate(key) {
  currentPage = key;
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.key === key);
  });
  const fn = PAGE_RENDERERS[key];
  if (fn) fn();
  else set(`<div class="empty"><div class="empty-icon">🚧</div><div class="empty-text">Page not found.</div></div>`);
}

function set(html) {
  document.getElementById('page-content').innerHTML = html;
}

function buildNav() {
  const role  = currentUser.role;
  const navEl = document.getElementById('sidebar-nav');
  const items = NAV.filter(n => n.roles.includes(role));

  // Group analytics/archives under a label
  const sections = [
    { label: null,          keys: ['dashboard','fac-encode','stu-grades'] },
    { label: 'MANAGEMENT',  keys: ['reg-accounts','reg-assign','reg-student-records','chair-assign','chair-failing'] },
    { label: 'PERFORMANCE', keys: ['reg-perf','dean-perf'] },
    { label: 'ANALYTICS',   keys: ['reg-analytics','dean-analytics','chair-analytics'] },
    { label: 'ARCHIVES',    keys: ['reg-archives','dean-archives','chair-archives'] },
  ];

  let html = '';
  sections.forEach(sec => {
    const matching = items.filter(n => sec.keys.includes(n.key));
    if (!matching.length) return;
    if (sec.label) html += `<div class="nav-section-label">${sec.label}</div>`;
    matching.forEach(n => {
      html += `<button class="nav-item" data-key="${n.key}" onclick="navigate('${n.key}')">
        <span class="nav-item-icon">${n.icon}</span>${esc(n.label)}
      </button>`;
    });
  });

  navEl.innerHTML = html;
}

/* ── Toast ───────────────────────────── */
function toast(msg, type='info') {
  const wrap  = document.getElementById('toast-wrap');
  const icons = { success:'✔', error:'✖', info:'ℹ' };
  const el    = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.innerHTML = `<span>${icons[type]||'·'}</span><span>${esc(msg)}</span>`;
  wrap.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

/* ── Modal ───────────────────────────── */
function showModal(title, bodyHtml) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML    = bodyHtml;
  document.getElementById('modal-overlay').classList.remove('hidden');
}
function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
}