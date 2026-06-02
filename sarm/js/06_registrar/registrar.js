'use strict';

/* ══════════════════════════════════════════
   REGISTRAR — Accounts, Assignment, Performance (API)
══════════════════════════════════════════ */

registerPage('reg-accounts',        renderRegAccounts);
registerPage('reg-assign',          renderRegAssign);
registerPage('reg-student-records', renderRegStudentRecords);
registerPage('reg-perf',            renderRegPerf);

let _regStudentRecordFilters = { college_id:'', dept_id:'', year_level:'', search:'' };
let _regStudentRecordMeta = { colleges: [], departments: [] };

/* ══════════════════════════════════════════
   ACCOUNT MANAGEMENT
══════════════════════════════════════════ */


async function renderRegStudentRecords() {
  set(`<div class="empty"><div class="empty-icon">⏳</div><div class="empty-text">Loading…</div></div>`);
  try {
    const [meta, students] = await Promise.all([
      api.getColleges().catch(() => ({ colleges: [], departments: [] })),
      api.getStudents({
        college_id: _regStudentRecordFilters.college_id,
        dept_id: _regStudentRecordFilters.dept_id,
        year_level: _regStudentRecordFilters.year_level,
        search: _regStudentRecordFilters.search,
      }),
    ]);
    _regStudentRecordMeta = meta;
    _drawRegStudentRecords(meta, students);
  } catch (err) { apiErr(err); }
}

function _drawRegStudentRecords(meta, students) {
  const colleges = meta.colleges || [];
  const departments = meta.departments || [];
  const selectedCollege = parseInt(_regStudentRecordFilters.college_id) || null;
  const filteredDepts = departments.filter(d => !selectedCollege || d.college_id === selectedCollege);

  set(`
    <div class="page-header">
      <div>
        <div class="page-title">Student Records</div>
        <div class="page-sub">View all students filtered by college, course, year level, or search.</div>
      </div>
    </div>

    <div class="section-card mb-20">
      <div class="grid-4 gap-12" style="align-items:flex-end;">
        <div class="field-wrap">
          <label class="field-label">College</label>
          <select id="rr-college" class="field-select" onchange="setRegStudentRecordFilter('college_id', this.value)">
            <option value="">— All Colleges —</option>
            ${colleges.map(c => `<option value="${c.id}" ${selectedCollege === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
          </select>
        </div>
        <div class="field-wrap">
          <label class="field-label">Course</label>
          <select id="rr-dept" class="field-select" onchange="setRegStudentRecordFilter('dept_id', this.value)">
            <option value="">— All Courses —</option>
            ${filteredDepts.map(d => `<option value="${d.id}" ${_regStudentRecordFilters.dept_id == d.id ? 'selected' : ''}>${esc(d.name)}</option>`).join('')}
          </select>
        </div>
        <div class="field-wrap">
          <label class="field-label">Year Level</label>
          <select id="rr-year" class="field-select" onchange="setRegStudentRecordFilter('year_level', this.value)">
            <option value="">— All Years —</option>
            ${[1,2,3,4].map(y => `<option value="${y}" ${_regStudentRecordFilters.year_level == y ? 'selected' : ''}>Year ${y}</option>`).join('')}
          </select>
        </div>
        <div class="field-wrap">
          <label class="field-label">Search</label>
          <input id="rr-search" class="field-input" placeholder="Search by name or ID" value="${esc(_regStudentRecordFilters.search)}" oninput="setRegStudentRecordFilter('search', this.value)" />
        </div>
      </div>
    </div>

    <div class="section-card">
      <div class="section-card-head"><div class="fw-7">Student Records (${students.length})</div></div>
      <div class="table-wrap"><table>
        <thead><tr><th>Student ID</th><th>Name</th><th>College</th><th>Course</th><th>Year</th><th>Status</th></tr></thead>
        <tbody>
          ${students.length === 0
            ? `<tr><td colspan="6" class="table-empty">No matching student records.</td></tr>`
            : students.map(s => `<tr>
                <td class="mono text-sm fw-6">${esc(s.id)}</td>
                <td><div class="flex gap-8"><div class="avatar avatar-sm">${initials(s.name)}</div>${esc(s.name)}</div></td>
                <td class="text-sm text-muted">${esc(s.college_name || '—')}</td>
                <td class="text-sm text-muted">${esc(s.dept_name || '—')}</td>
                <td>Year ${esc(s.year_level)}</td>
                <td><span class="badge badge-${s.status === 'enrolled' ? 'success' : 'muted'}">${esc(s.status)}</span></td>
              </tr>`).join('')}
        </tbody>
      </table></div>
    </div>
  `);
}

function setRegStudentRecordFilter(field, value) {
  _regStudentRecordFilters[field] = value || '';
  if (field === 'college_id') {
    _regStudentRecordFilters.dept_id = '';
  }
  renderRegStudentRecords();
}

async function renderRegAccounts() {
  set(`<div class="empty"><div class="empty-icon">⏳</div><div class="empty-text">Loading…</div></div>`);
  try {
    const [users, students] = await Promise.all([api.getUsers(), api.getStudents()]);
    _drawRegAccounts(users, students);
  } catch (err) { apiErr(err); }
}

function _drawRegAccounts(users, students) {
  set(`
    <div class="page-header">
      <div class="page-title">Account Management</div>
      <div class="flex gap-8">
        <button class="btn btn-primary" onclick="showCreateUserModal()">+ Add Staff</button>
        <button class="btn btn-primary" onclick="showCreateStudentModal()">+ Add Student</button>
      </div>
    </div>

    <div class="section-card mb-20">
      <div class="section-card-head"><div class="fw-7">Staff Accounts (${users.length})</div></div>
      <div class="table-wrap"><table>
        <thead><tr><th>Name</th><th>Role</th><th>Username</th><th>College</th><th>Department</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>
          ${users.length === 0
            ? `<tr><td colspan="7" class="table-empty">No staff accounts yet.</td></tr>`
            : users.map(u => `<tr>
                <td><div class="flex gap-8"><div class="avatar avatar-sm">${initials(u.name)}</div>${esc(u.name)}</div></td>
                <td><span class="badge badge-${roleBadge(u.role)}">${esc(u.role)}</span></td>
                <td class="mono text-sm">${esc(u.username)}</td>
                <td class="text-sm text-muted">${esc(u.college_name || '—')}</td>
                <td class="text-sm text-muted">${esc(u.dept_name   || '—')}</td>
                <td><span class="badge badge-${u.active ? 'success' : 'muted'}">${u.active ? 'Active' : 'Inactive'}</span></td>
                <td class="flex gap-8">
                  <button class="btn btn-sm btn-ghost" onclick="showEditUserModal(${u.id},'${esc(u.name)}')">✎ Edit</button>
                  <button class="btn btn-sm btn-ghost" onclick="toggleUserActive(${u.id},${u.active})">${u.active ? 'Deactivate' : 'Activate'}</button>
                </td>
              </tr>`).join('')}
        </tbody>
      </table></div>
    </div>

<div class="section-card">
      <div class="section-card-head" style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <div class="fw-7">Student Accounts</div>
        </div>
        <div class="field-wrap" style="margin: 0; width: 220px;">
          <input id="stu-search" class="field-input" placeholder="Search by name or ID..." 
            oninput="filterStudentTable(this.value)" />
        </div>
      </div>
      <div class="table-wrap"><table>
        <thead><tr><th>Student ID</th><th>Name</th><th>Department</th><th>Year</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody id="student-table-body">
          ${students.length === 0
            ? `<tr><td colspan="6" class="table-empty">No students yet.</td></tr>`
            : students.map(s => `<tr class="student-row" data-name="${esc(s.name).toLowerCase()}" data-id="${esc(s.id)}">
                <td class="mono text-sm fw-6">${esc(s.id)}</td>
                <td><div class="flex gap-8"><div class="avatar avatar-sm">${initials(s.name)}</div>${esc(s.name)}</div></td>
                <td class="text-sm text-muted">${esc(s.dept_name || '—')}</td>
                <td>Year ${s.year_level}</td>
                <td><span class="badge badge-${s.status === 'enrolled' ? 'success' : 'muted'}">${esc(s.status)}</span></td>
                <td><button class="btn btn-sm btn-ghost" onclick="showEditStudentModal('${s.id}','${esc(s.name)}',${s.year_level},'${s.status}')">✎ Edit</button></td>
              </tr>`).join('')}
        </tbody>
      </table></div>
    </div>
  `);
}

function roleBadge(role) {
  return { Dean:'blue', Chairman:'info', Faculty:'muted' }[role] || 'muted';
}

/* ── Create Staff ────────────────────── */
async function showCreateUserModal() {
  // Fetch colleges and depts for dropdowns
  let colleges = [], depts = [];
  try {
    const analytics = await api.getAnalytics().catch(() => null);
    // Use hardcoded fallback from dept_comparison
    if (analytics) {
      const colMap = {}, depMap = {};
      analytics.dept_comparison.forEach(d => {
        colMap[d.dept_id] = d.college_name;
        depMap[d.dept_id] = d.dept_name;
      });
    }
  } catch {}

  // Re-fetch from graduates endpoint to get colleges/depts
  const grads = await api.getGraduates().catch(() => []);
  const colMap = {}, depMap = {};
  grads.forEach(g => {
    colMap[g.college_id] = g.college_name;
    if (!depMap[g.college_id]) depMap[g.college_id] = [];
    if (!depMap[g.college_id].find(d => d.id === g.dept_id)) {
      depMap[g.college_id].push({ id: g.dept_id, name: g.dept_name });
    }
  });
  colleges = Object.entries(colMap).map(([id, name]) => ({ id: parseInt(id), name }));
  depts    = depMap;

  window._regColleges = colleges;
  window._regDepts    = depts;

  showModal('Add Staff Account', `
    <div class="field-wrap">
      <label class="field-label">Full Name</label>
      <input id="cu-name" class="field-input" placeholder="e.g. Dr. Juan dela Cruz" />
    </div>
    <div class="field-wrap">
      <label class="field-label">Role</label>
      <select id="cu-role" class="field-select" onchange="updateUserCollegeDeptFields()">
        <option value="">— Select Role —</option>
        <option value="Dean">Dean</option>
        <option value="Chairman">Chairman</option>
        <option value="Faculty">Faculty</option>
      </select>
    </div>
    <div id="cu-college-wrap" class="field-wrap hidden">
      <label class="field-label">College</label>
      <select id="cu-college" class="field-select" onchange="updateUserDeptField()">
        <option value="">— Select College —</option>
        ${colleges.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}
      </select>
    </div>
    <div id="cu-dept-wrap" class="field-wrap hidden">
      <label class="field-label">Department</label>
      <select id="cu-dept" class="field-select"><option value="">— Select Department —</option></select>
    </div>
    <div class="grid-2">
      <div class="field-wrap">
        <label class="field-label">Username</label>
        <input id="cu-user" class="field-input" placeholder="e.g. dean2" />
      </div>
      <div class="field-wrap">
        <label class="field-label">Password</label>
        <input id="cu-pass" class="field-input" type="password" />
      </div>
    </div>
    <button class="btn btn-primary btn-full" onclick="doCreateUser()">Create Account</button>
  `);
}

function updateUserCollegeDeptFields() {
  const role    = document.getElementById('cu-role').value;
  const colWrap  = document.getElementById('cu-college-wrap');
  const deptWrap = document.getElementById('cu-dept-wrap');
  if (role === 'Dean') { colWrap.classList.remove('hidden'); deptWrap.classList.add('hidden'); }
  else if (role === 'Chairman' || role === 'Faculty') { colWrap.classList.remove('hidden'); deptWrap.classList.remove('hidden'); updateUserDeptField(); }
  else { colWrap.classList.add('hidden'); deptWrap.classList.add('hidden'); }
}

function updateUserDeptField() {
  const colId = parseInt(document.getElementById('cu-college')?.value);
  const sel   = document.getElementById('cu-dept');
  if (!sel) return;
  const depts = (window._regDepts || {})[colId] || [];
  sel.innerHTML = `<option value="">— Select Department —</option>`
    + depts.map(d => `<option value="${d.id}">${esc(d.name)}</option>`).join('');
}

async function doCreateUser() {
  const name   = document.getElementById('cu-name').value.trim();
  const role   = document.getElementById('cu-role').value;
  const user   = document.getElementById('cu-user').value.trim();
  const pass   = document.getElementById('cu-pass').value;
  const colId  = parseInt(document.getElementById('cu-college')?.value) || null;
  const deptId = parseInt(document.getElementById('cu-dept')?.value)    || null;
  if (!name || !role || !user || !pass) { toast('Please fill all required fields.', 'error'); return; }
  try {
    await api.createUser({ name, role, username: user, password: pass, college_id: colId, dept_id: deptId });
    toast('Account created.', 'success');
    closeModal();
    renderRegAccounts();
  } catch (err) { apiErr(err); }
}

/* ── Edit Staff ──────────────────────── */
function showEditUserModal(userId, currentName) {
  showModal('Edit Account', `
    <div class="field-wrap">
      <label class="field-label">Full Name</label>
      <input id="eu-name" class="field-input" value="${esc(currentName)}" />
    </div>
    <div class="field-wrap">
      <label class="field-label">New Password <span class="text-muted">(leave blank to keep)</span></label>
      <input id="eu-pass" class="field-input" type="password" />
    </div>
    <button class="btn btn-primary btn-full" onclick="doEditUser(${userId})">Save Changes</button>
  `);
}

async function doEditUser(userId) {
  const name = document.getElementById('eu-name').value.trim();
  const pass = document.getElementById('eu-pass').value;
  if (!name) { toast('Name is required.', 'error'); return; }
  const data = { id: userId, name };
  if (pass) data.password = pass;
  try {
    await api.updateUser(data);
    toast('Account updated.', 'success');
    closeModal();
    renderRegAccounts();
  } catch (err) { apiErr(err); }
}

async function toggleUserActive(userId, currentActive) {
  try {
    await api.updateUser({ id: userId, active: !currentActive });
    toast(`Account ${currentActive ? 'deactivated' : 'activated'}.`, 'success');
    renderRegAccounts();
  } catch (err) { apiErr(err); }
}

/* ── Create Student ──────────────────── */
async function showCreateStudentModal() {
  const grads = await api.getGraduates().catch(() => []);
  const depMap = {};
  grads.forEach(g => {
    if (!depMap[g.dept_id]) depMap[g.dept_id] = g.dept_name;
  });
  const depts = Object.entries(depMap).map(([id, name]) => ({ id: parseInt(id), name }));

  showModal('Add Student Account', `
    <div class="alert alert-info mb-12">Login: Student ID + Birthday (mmddyyyy)</div>
    <div class="grid-2">
      <div class="field-wrap">
        <label class="field-label">Student ID (6 digits)</label>
        <input id="cs2-id" class="field-input" placeholder="e.g. 238109" maxlength="6" />
      </div>
      <div class="field-wrap">
        <label class="field-label">Birthday (mmddyyyy)</label>
        <input id="cs2-bday" class="field-input" placeholder="e.g. 01152004" maxlength="8" />
      </div>
    </div>
    <div class="field-wrap">
      <label class="field-label">Full Name</label>
      <input id="cs2-name" class="field-input" placeholder="Full name" />
    </div>
    <div class="grid-2">
      <div class="field-wrap">
        <label class="field-label">Department</label>
        <select id="cs2-dept" class="field-select">
          <option value="">— Select —</option>
          ${depts.map(d => `<option value="${d.id}">${esc(d.name)}</option>`).join('')}
        </select>
      </div>
      <div class="field-wrap">
        <label class="field-label">Year Level</label>
        <select id="cs2-year" class="field-select">
          ${[1,2,3,4].map(y => `<option value="${y}">Year ${y}</option>`).join('')}
        </select>
      </div>
    </div>
    <button class="btn btn-primary btn-full" onclick="doCreateStudent()">Create Student</button>
  `);
}

async function doCreateStudent() {
  const id   = document.getElementById('cs2-id').value.trim();
  const bday = document.getElementById('cs2-bday').value.trim();
  const name = document.getElementById('cs2-name').value.trim();
  const dept = parseInt(document.getElementById('cs2-dept').value) || 0;
  const year = parseInt(document.getElementById('cs2-year').value);
  if (!id || !bday || !name || !dept) { toast('Please fill all required fields.', 'error'); return; }
  try {
    await api.createStudent({ id, name, dept_id: dept, year_level: year, birthday: bday });
    toast('Student created.', 'success');
    closeModal();
    renderRegAccounts();
  } catch (err) { apiErr(err); }
}
/* ── Instant Student Name Search Filter ── */
function filterStudentTable(query) {
  const q = query.toLowerCase().trim();
  const rows = document.querySelectorAll('#student-table-body .student-row');
  
  rows.forEach(row => {
    const name = row.getAttribute('data-name');
    const id = row.getAttribute('data-id');
    
    // Show row if query matches name or student ID, otherwise hide it
    if (name.includes(q) || id.includes(q)) {
      row.style.display = '';
    } else {
      row.style.display = 'none';
    }
  });
}

/* ── Edit Student ────────────────────── */
function showEditStudentModal(stuId, currentName, currentYear, currentStatus) {
  showModal('Edit Student', `
    <div class="field-wrap">
      <label class="field-label">Full Name</label>
      <input id="es-name" class="field-input" value="${esc(currentName)}" />
    </div>
    <div class="grid-2">
      <div class="field-wrap">
        <label class="field-label">Year Level</label>
        <select id="es-year" class="field-select">
          ${[1,2,3,4].map(y => `<option value="${y}" ${currentYear==y?'selected':''}>${y}</option>`).join('')}
        </select>
      </div>
      <div class="field-wrap">
        <label class="field-label">Status</label>
        <select id="es-status" class="field-select">
          ${['enrolled','inactive','graduated'].map(s => `<option value="${s}" ${currentStatus===s?'selected':''}>${s}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="field-wrap">
      <label class="field-label">New Birthday <span class="text-muted">(leave blank to keep)</span></label>
      <input id="es-bday" class="field-input" placeholder="mmddyyyy" maxlength="8" />
    </div>
    <button class="btn btn-primary btn-full" onclick="doEditStudent('${stuId}')">Save Changes</button>
  `);
}

async function doEditStudent(stuId) {
  const name = document.getElementById('es-name').value.trim();
  const year = parseInt(document.getElementById('es-year').value);
  const stat = document.getElementById('es-status').value;
  const bday = document.getElementById('es-bday').value.trim();
  if (!name) { toast('Name is required.', 'error'); return; }
  const data = { id: stuId, name, year_level: year, status: stat };
  if (bday) data.birthday = bday;
  try {
    await api.updateStudent(data);
    toast('Student updated.', 'success');
    closeModal();
    renderRegAccounts();
  } catch (err) { apiErr(err); }
}

/* ══════════════════════════════════════════
   DEAN & CHAIRMAN ASSIGNMENT
══════════════════════════════════════════ */
async function renderRegAssign() {
  set(`<div class="empty"><div class="empty-icon">⏳</div><div class="empty-text">Loading…</div></div>`);
  try {
    const users = await api.getUsers();
    const deans  = users.filter(u => u.role === 'Dean');
    const chairs = users.filter(u => u.role === 'Chairman');
    window._regAllUsers = users;

    set(`
      <div class="page-header"><div class="page-title">Dean & Chairman Assignment</div></div>

      <div class="section-card mb-20">
        <div class="section-card-head"><div class="fw-7">Deans — College Assignment</div></div>
        <div class="table-wrap"><table>
          <thead><tr><th>Name</th><th>Username</th><th>Assigned College</th><th>Action</th></tr></thead>
          <tbody>
            ${deans.length === 0
              ? `<tr><td colspan="4" class="table-empty">No deans yet.</td></tr>`
              : deans.map(u => `<tr>
                  <td><div class="flex gap-8"><div class="avatar avatar-sm">${initials(u.name)}</div>${esc(u.name)}</div></td>
                  <td class="mono text-sm">${esc(u.username)}</td>
                  <td>${u.college_name || '<span class="text-muted text-sm">Not assigned</span>'}</td>
                  <td><button class="btn btn-sm btn-primary" onclick="showAssignCollegeModal(${u.id},'${esc(u.name)}',${u.college_id||'null'})">Assign College</button></td>
                </tr>`).join('')}
          </tbody>
        </table></div>
      </div>

      <div class="section-card">
        <div class="section-card-head"><div class="fw-7">Chairmen — Department Assignment</div></div>
        <div class="table-wrap"><table>
          <thead><tr><th>Name</th><th>Username</th><th>Assigned Department</th><th>Action</th></tr></thead>
          <tbody>
            ${chairs.length === 0
              ? `<tr><td colspan="4" class="table-empty">No chairmen yet.</td></tr>`
              : chairs.map(u => `<tr>
                  <td><div class="flex gap-8"><div class="avatar avatar-sm">${initials(u.name)}</div>${esc(u.name)}</div></td>
                  <td class="mono text-sm">${esc(u.username)}</td>
                  <td>${u.dept_name || '<span class="text-muted text-sm">Not assigned</span>'}</td>
                  <td><button class="btn btn-sm btn-primary" onclick="showAssignDeptModal(${u.id},'${esc(u.name)}',${u.college_id||'null'},${u.dept_id||'null'})">Assign Dept</button></td>
                </tr>`).join('')}
          </tbody>
        </table></div>
      </div>
    `);
  } catch (err) { apiErr(err); }
}

async function showAssignCollegeModal(userId, userName, currentColId) {
  const grads = await api.getGraduates().catch(() => []);
  const colMap = {};
  grads.forEach(g => { colMap[g.college_id] = g.college_name; });
  const colleges = Object.entries(colMap).map(([id, name]) => ({ id: parseInt(id), name }));

  showModal(`Assign College — ${userName}`, `
    <div class="field-wrap">
      <label class="field-label">College</label>
      <select id="ac-col" class="field-select">
        <option value="">— Select —</option>
        ${colleges.map(c => `<option value="${c.id}" ${currentColId===c.id?'selected':''}>${esc(c.name)}</option>`).join('')}
      </select>
    </div>
    <button class="btn btn-primary btn-full" onclick="doAssignCollege(${userId})">Save</button>
  `);
}

async function doAssignCollege(userId) {
  const colId = parseInt(document.getElementById('ac-col').value) || null;
  try {
    await api.updateUser({ id: userId, college_id: colId, dept_id: null });
    toast('College assigned.', 'success');
    closeModal();
    renderRegAssign();
  } catch (err) { apiErr(err); }
}

async function showAssignDeptModal(userId, userName, currentColId, currentDeptId) {
  const grads = await api.getGraduates().catch(() => []);
  const colMap = {}, depMap = {};
  grads.forEach(g => {
    colMap[g.college_id] = g.college_name;
    if (!depMap[g.college_id]) depMap[g.college_id] = [];
    if (!depMap[g.college_id].find(d => d.id === g.dept_id))
      depMap[g.college_id].push({ id: g.dept_id, name: g.dept_name });
  });
  const colleges = Object.entries(colMap).map(([id, name]) => ({ id: parseInt(id), name }));
  window._adDepts = depMap;

  showModal(`Assign Department — ${userName}`, `
    <div class="field-wrap">
      <label class="field-label">College</label>
      <select id="ad-col" class="field-select" onchange="updateAdDepts()">
        <option value="">— Select —</option>
        ${colleges.map(c => `<option value="${c.id}" ${currentColId===c.id?'selected':''}>${esc(c.name)}</option>`).join('')}
      </select>
    </div>
    <div class="field-wrap">
      <label class="field-label">Department</label>
      <select id="ad-dept" class="field-select">
        <option value="">— Select college first —</option>
        ${currentColId && depMap[currentColId]
          ? depMap[currentColId].map(d => `<option value="${d.id}" ${currentDeptId===d.id?'selected':''}>${esc(d.name)}</option>`).join('')
          : ''}
      </select>
    </div>
    <button class="btn btn-primary btn-full" onclick="doAssignDept(${userId})">Save</button>
  `);
}

function updateAdDepts() {
  const colId = parseInt(document.getElementById('ad-col').value);
  const sel   = document.getElementById('ad-dept');
  const depts = (window._adDepts || {})[colId] || [];
  sel.innerHTML = `<option value="">— Select Dept —</option>`
    + depts.map(d => `<option value="${d.id}">${esc(d.name)}</option>`).join('');
}

async function doAssignDept(userId) {
  const colId  = parseInt(document.getElementById('ad-col').value)  || null;
  const deptId = parseInt(document.getElementById('ad-dept').value) || null;
  try {
    await api.updateUser({ id: userId, college_id: colId, dept_id: deptId });
    toast('Department assigned.', 'success');
    closeModal();
    renderRegAssign();
  } catch (err) { apiErr(err); }
}

/* ══════════════════════════════════════════
   ACADEMIC PERFORMANCE
══════════════════════════════════════════ */
async function renderRegPerf() {
  set(`<div class="empty"><div class="empty-icon">⏳</div><div class="empty-text">Loading…</div></div>`);
  try {
    const analytics = await api.getAnalytics();
    const dist  = analytics.grade_distribution;
    const trend = analytics.semester_trend;
    const depts = analytics.dept_comparison;
    const overallPassRate = percentLabel(safePassRate(dist.passed, dist.grand_total));

    set(`
      <div class="page-header">
        <div><div class="page-title">Academic Performance</div>
        <div class="page-sub">Institution-wide · Submitted grades only</div></div>
      </div>

      <div class="grid-4 mb-20">
        ${statCard('📊','Total Grades', dist.grand_total,  '#374151','#f3f4f6')}
        ${statCard('✅','Passed',        dist.passed  ?? 0, 'var(--success)','#dcfce7')}
        ${statCard('❌','Failed',         dist.failed  ?? 0, 'var(--danger)','#fee2e2')}
        ${statCard('📈','Pass Rate', overallPassRate, 'var(--blue)','#dbeafe')}
      </div>

      <div class="section-card mb-20">
        <div class="section-card-head"><div class="fw-7">Semester Trend</div></div>
        <div class="section-card-body">
          <div class="table-wrap"><table>
            <thead><tr><th>Semester</th><th>Total</th><th>Passed</th><th>Failed</th><th>Pass Rate</th><th>Avg Grade</th><th>Students</th></tr></thead>
            <tbody>
              ${trend.length === 0
                ? `<tr><td colspan="7" class="table-empty">No submitted grades yet.</td></tr>`
                : trend.map(t => `<tr>
                    <td class="fw-6">${esc(t.label)}</td>
                    <td>${t.total}</td>
                    <td style="color:var(--success)">${t.passed}</td>
                    <td style="color:var(--danger)">${t.failed}</td>
                    <td>${prCell(t.pass_rate)}</td>
                    <td class="mono text-sm">${avgLabel(t.avg_grade)}</td>
                    <td class="fw-7" style="color:var(--teal)">${t.headcount}</td>
                  </tr>`).join('')}
            </tbody>
          </table></div>
        </div>
      </div>

      <div class="section-card mb-20">
        <div class="section-card-head"><div class="fw-7">Performance by Department</div></div>
        <div class="section-card-body">
          <div class="table-wrap"><table>
            <thead><tr><th>Department</th><th>Total</th><th>Passed</th><th>Failed</th><th>Pass Rate</th><th>Avg Grade</th></tr></thead>
            <tbody>
              ${depts.map(d => `<tr>
                <td class="fw-6">${esc(d.dept_name)}</td>
                <td>${d.total}</td>
                <td style="color:var(--success)">${d.passed}</td>
                <td style="color:var(--danger)">${d.failed}</td>
                <td>${prCell(d.pass_rate)}</td>
                <td class="mono text-sm">${avgLabel(d.avg_grade)}</td>
              </tr>`).join('')}
            </tbody>
          </table></div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">Pass Rate by Department</div>
        ${depts.map(d => barRow(d.dept_name, d.pass_rate, d.pass_rate!=null&&d.pass_rate>=75?'var(--success)':'var(--warning)')).join('')
          || '<div class="text-muted text-sm">No data.</div>'}
      </div>
    `);
  } catch (err) { apiErr(err); }
}