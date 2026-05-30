'use strict';

/* ══════════════════════════════════════════
   REGISTRAR — Accounts, Assignment, Performance
══════════════════════════════════════════ */

registerPage('reg-accounts', renderRegAccounts);
registerPage('reg-assign',   renderRegAssign);
registerPage('reg-perf',     renderRegPerf);

/* ══════════════════════════════════════════
   ACCOUNT MANAGEMENT
══════════════════════════════════════════ */
function renderRegAccounts() {
  const users    = DB.users.filter(u => u.role !== 'Registrar');
  const students = DB.students;

  set(`
    <div class="page-header">
      <div class="page-title">Account Management</div>
      <div class="flex gap-8">
        <button class="btn btn-primary" onclick="showCreateUserModal()">+ Add Staff</button>
        <button class="btn btn-primary" onclick="showCreateStudentModal()">+ Add Student</button>
      </div>
    </div>

    <!-- Staff Accounts -->
    <div class="section-card mb-20">
      <div class="section-card-head">
        <div class="fw-7">Staff Accounts (${users.length})</div>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Name</th><th>Role</th><th>Username</th><th>College</th><th>Department</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            ${users.length === 0
              ? `<tr><td colspan="7" class="table-empty">No staff accounts yet.</td></tr>`
              : users.map(u => {
                  const col  = getCollege(u.collegeId);
                  const dept = getDept(u.deptId);
                  return `<tr>
                    <td><div class="flex gap-8"><div class="avatar avatar-sm">${initials(u.name)}</div>${esc(u.name)}</div></td>
                    <td><span class="badge badge-${roleBadge(u.role)}">${esc(u.role)}</span></td>
                    <td class="mono text-sm">${esc(u.username)}</td>
                    <td class="text-sm text-muted">${col ? esc(col.name) : '—'}</td>
                    <td class="text-sm text-muted">${dept ? esc(dept.name) : '—'}</td>
                    <td><span class="badge badge-${u.active ? 'success' : 'muted'}">${u.active ? 'Active' : 'Inactive'}</span></td>
                    <td>
                      <button class="btn btn-sm btn-ghost" onclick="showEditUserModal(${u.id})">✎ Edit</button>
                      <button class="btn btn-sm btn-ghost" onclick="toggleUserActive(${u.id})">${u.active ? 'Deactivate' : 'Activate'}</button>
                    </td>
                  </tr>`;
                }).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Student Accounts -->
    <div class="section-card">
      <div class="section-card-head">
        <div class="fw-7">Student Accounts (${students.length})</div>
        <div class="text-xs text-muted">Login: Student ID + Birthday (mmddyyyy)</div>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Student ID</th><th>Name</th><th>Department</th><th>Year</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            ${students.length === 0
              ? `<tr><td colspan="6" class="table-empty">No students yet.</td></tr>`
              : students.map(s => {
                  const dept = getDept(s.deptId);
                  return `<tr>
                    <td class="mono text-sm fw-6">${esc(s.id)}</td>
                    <td><div class="flex gap-8"><div class="avatar avatar-sm">${initials(s.name)}</div>${esc(s.name)}</div></td>
                    <td class="text-sm text-muted">${dept ? esc(dept.name) : '—'}</td>
                    <td>Year ${s.year}</td>
                    <td><span class="badge badge-${s.status === 'enrolled' ? 'success' : 'muted'}">${esc(s.status)}</span></td>
                    <td>
                      <button class="btn btn-sm btn-ghost" onclick="showEditStudentModal('${s.id}')">✎ Edit</button>
                    </td>
                  </tr>`;
                }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `);
}

function roleBadge(role) {
  return { Dean:'blue', Chairman:'info', Faculty:'muted' }[role] || 'muted';
}

/* ── Create Staff Modal ──────────────── */
function showCreateUserModal() {
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
        ${DB.colleges.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}
      </select>
    </div>
    <div id="cu-dept-wrap" class="field-wrap hidden">
      <label class="field-label">Department</label>
      <select id="cu-dept" class="field-select">
        <option value="">— Select Department —</option>
      </select>
    </div>
    <div class="grid-2">
      <div class="field-wrap">
        <label class="field-label">Username</label>
        <input id="cu-user" class="field-input" placeholder="e.g. dean2" />
      </div>
      <div class="field-wrap">
        <label class="field-label">Password</label>
        <input id="cu-pass" class="field-input" type="password" placeholder="Set password" />
      </div>
    </div>
    <button class="btn btn-primary btn-full" onclick="doCreateUser()">Create Account</button>
  `);
}

function updateUserCollegeDeptFields() {
  const role    = document.getElementById('cu-role').value;
  const colWrap  = document.getElementById('cu-college-wrap');
  const deptWrap = document.getElementById('cu-dept-wrap');

  if (role === 'Dean') {
    colWrap.classList.remove('hidden');
    deptWrap.classList.add('hidden');
  } else if (role === 'Chairman' || role === 'Faculty') {
    colWrap.classList.remove('hidden');
    deptWrap.classList.remove('hidden');
    updateUserDeptField();
  } else {
    colWrap.classList.add('hidden');
    deptWrap.classList.add('hidden');
  }
}

function updateUserDeptField() {
  const colId    = parseInt(document.getElementById('cu-college')?.value);
  const deptSel  = document.getElementById('cu-dept');
  if (!deptSel) return;
  const depts = DB.departments.filter(d => d.collegeId === colId);
  deptSel.innerHTML = `<option value="">— Select Department —</option>` +
    depts.map(d => `<option value="${d.id}">${esc(d.name)}</option>`).join('');
}

function doCreateUser() {
  const name   = document.getElementById('cu-name').value.trim();
  const role   = document.getElementById('cu-role').value;
  const user   = document.getElementById('cu-user').value.trim();
  const pass   = document.getElementById('cu-pass').value;
  const colId  = parseInt(document.getElementById('cu-college')?.value) || null;
  const deptId = parseInt(document.getElementById('cu-dept')?.value) || null;

  if (!name || !role || !user || !pass) { toast('Please fill in all required fields.', 'error'); return; }
  if (DB.users.find(u => u.username === user)) { toast('Username already taken.', 'error'); return; }

  DB.users.push({
    id:        DB.nextId.user++,
    name,
    role,
    username:  user,
    password:  pass,
    active:    true,
    collegeId: colId,
    deptId:    deptId,
    studentId: null,
  });
  save();
  toast('Account created.', 'success');
  closeModal();
  renderRegAccounts();
}

/* ── Edit Staff Modal ────────────────── */
function showEditUserModal(userId) {
  const u = getUser(userId);
  if (!u) return;
  showModal('Edit Account — ' + u.name, `
    <div class="field-wrap">
      <label class="field-label">Full Name</label>
      <input id="eu-name" class="field-input" value="${esc(u.name)}" />
    </div>
    <div class="field-wrap">
      <label class="field-label">New Password <span class="text-muted">(leave blank to keep)</span></label>
      <input id="eu-pass" class="field-input" type="password" placeholder="New password" />
    </div>
    <button class="btn btn-primary btn-full" onclick="doEditUser(${userId})">Save Changes</button>
  `);
}

function doEditUser(userId) {
  const u    = getUser(userId);
  const name = document.getElementById('eu-name').value.trim();
  const pass = document.getElementById('eu-pass').value;
  if (!name) { toast('Name is required.', 'error'); return; }
  u.name = name;
  if (pass) u.password = pass;
  save();
  toast('Account updated.', 'success');
  closeModal();
  renderRegAccounts();
}

function toggleUserActive(userId) {
  const u = getUser(userId);
  if (!u) return;
  u.active = !u.active;
  save();
  toast(`Account ${u.active ? 'activated' : 'deactivated'}.`, 'success');
  renderRegAccounts();
}

/* ── Create Student Modal ────────────── */
function showCreateStudentModal() {
  showModal('Add Student Account', `
    <div class="alert alert-info mb-12">Student login: use their ID + Birthday (mmddyyyy)</div>
    <div class="grid-2">
      <div class="field-wrap">
        <label class="field-label">Student ID</label>
        <input id="cs2-id" class="field-input" placeholder="e.g. 238107" />
      </div>
      <div class="field-wrap">
        <label class="field-label">Birthday (mmddyyyy)</label>
        <input id="cs2-bday" class="field-input" placeholder="e.g. 01152004" maxlength="8" />
      </div>
    </div>
    <div class="field-wrap">
      <label class="field-label">Full Name</label>
      <input id="cs2-name" class="field-input" placeholder="e.g. Maria Santos" />
    </div>
    <div class="grid-2">
      <div class="field-wrap">
        <label class="field-label">Department</label>
        <select id="cs2-dept" class="field-select">
          <option value="">— Select —</option>
          ${DB.departments.map(d => `<option value="${d.id}">${esc(d.name)}</option>`).join('')}
        </select>
      </div>
      <div class="field-wrap">
        <label class="field-label">Year Level</label>
        <select id="cs2-year" class="field-select">
          <option value="1">Year 1</option>
          <option value="2">Year 2</option>
          <option value="3">Year 3</option>
          <option value="4">Year 4</option>
        </select>
      </div>
    </div>
    <button class="btn btn-primary btn-full" onclick="doCreateStudent()">Create Student</button>
  `);
}

function doCreateStudent() {
  const id   = document.getElementById('cs2-id').value.trim();
  const bday = document.getElementById('cs2-bday').value.trim();
  const name = document.getElementById('cs2-name').value.trim();
  const dept = parseInt(document.getElementById('cs2-dept').value) || null;
  const year = parseInt(document.getElementById('cs2-year').value);

  if (!id || !bday || !name || !dept) { toast('Please fill in all required fields.', 'error'); return; }
  if (!/^\d{6}$/.test(id))   { toast('Student ID must be exactly 6 digits.', 'error'); return; }
  if (!/^\d{8}$/.test(bday)) { toast('Birthday must be 8 digits (mmddyyyy).', 'error'); return; }
  if (DB.students.find(s => s.id === id)) { toast('Student ID already exists.', 'error'); return; }

  DB.students.push({ id, name, deptId: dept, year, birthday: bday, status: 'enrolled' });
  save();
  toast('Student account created.', 'success');
  closeModal();
  renderRegAccounts();
}

/* ── Edit Student Modal ──────────────── */
function showEditStudentModal(stuId) {
  const s = getStudent(stuId);
  if (!s) return;
  showModal('Edit Student — ' + s.name, `
    <div class="field-wrap">
      <label class="field-label">Full Name</label>
      <input id="es-name" class="field-input" value="${esc(s.name)}" />
    </div>
    <div class="grid-2">
      <div class="field-wrap">
        <label class="field-label">Year Level</label>
        <select id="es-year" class="field-select">
          ${[1,2,3,4].map(yr => `<option value="${yr}" ${s.year==yr?'selected':''}>${yr}</option>`).join('')}
        </select>
      </div>
      <div class="field-wrap">
        <label class="field-label">Status</label>
        <select id="es-status" class="field-select">
          <option value="enrolled"  ${s.status==='enrolled'  ?'selected':''}>Enrolled</option>
          <option value="inactive"  ${s.status==='inactive'  ?'selected':''}>Inactive</option>
          <option value="graduated" ${s.status==='graduated' ?'selected':''}>Graduated</option>
        </select>
      </div>
    </div>
    <div class="field-wrap">
      <label class="field-label">New Birthday <span class="text-muted">(mmddyyyy, leave blank to keep)</span></label>
      <input id="es-bday" class="field-input" placeholder="mmddyyyy" maxlength="8" />
    </div>
    <button class="btn btn-primary btn-full" onclick="doEditStudent('${stuId}')">Save Changes</button>
  `);
}

function doEditStudent(stuId) {
  const s    = getStudent(stuId);
  const name = document.getElementById('es-name').value.trim();
  const year = parseInt(document.getElementById('es-year').value);
  const stat = document.getElementById('es-status').value;
  const bday = document.getElementById('es-bday').value.trim();

  if (!name) { toast('Name is required.', 'error'); return; }
  s.name   = name;
  s.year   = year;
  s.status = stat;
  if (bday) {
    if (!/^\d{8}$/.test(bday)) { toast('Birthday must be 8 digits.', 'error'); return; }
    s.birthday = bday;
  }
  save();
  toast('Student updated.', 'success');
  closeModal();
  renderRegAccounts();
}

/* ══════════════════════════════════════════
   DEAN & CHAIRMAN ASSIGNMENT
══════════════════════════════════════════ */
function renderRegAssign() {
  const deans    = DB.users.filter(u => u.role === 'Dean');
  const chairs   = DB.users.filter(u => u.role === 'Chairman');

  set(`
    <div class="page-header">
      <div class="page-title">Dean & Chairman Assignment</div>
    </div>

    <!-- Deans -->
    <div class="section-card mb-20">
      <div class="section-card-head"><div class="fw-7">Deans — College Assignment</div></div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Name</th><th>Username</th><th>Assigned College</th><th>Actions</th></tr></thead>
          <tbody>
            ${deans.length === 0
              ? `<tr><td colspan="4" class="table-empty">No deans yet. Add one via Account Management.</td></tr>`
              : deans.map(u => {
                  const col = getCollege(u.collegeId);
                  return `<tr>
                    <td><div class="flex gap-8"><div class="avatar avatar-sm">${initials(u.name)}</div>${esc(u.name)}</div></td>
                    <td class="mono text-sm">${esc(u.username)}</td>
                    <td>${col ? esc(col.name) : '<span class="text-muted text-sm">Not assigned</span>'}</td>
                    <td><button class="btn btn-sm btn-primary" onclick="showAssignCollegeModal(${u.id})">Assign College</button></td>
                  </tr>`;
                }).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Chairmen -->
    <div class="section-card">
      <div class="section-card-head"><div class="fw-7">Chairmen — Department Assignment</div></div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Name</th><th>Username</th><th>Assigned Department</th><th>Actions</th></tr></thead>
          <tbody>
            ${chairs.length === 0
              ? `<tr><td colspan="4" class="table-empty">No chairmen yet. Add one via Account Management.</td></tr>`
              : chairs.map(u => {
                  const dept = getDept(u.deptId);
                  return `<tr>
                    <td><div class="flex gap-8"><div class="avatar avatar-sm">${initials(u.name)}</div>${esc(u.name)}</div></td>
                    <td class="mono text-sm">${esc(u.username)}</td>
                    <td>${dept ? esc(dept.name) : '<span class="text-muted text-sm">Not assigned</span>'}</td>
                    <td><button class="btn btn-sm btn-primary" onclick="showAssignDeptModal(${u.id})">Assign Department</button></td>
                  </tr>`;
                }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `);
}

/* ── Assign College to Dean ──────────── */
function showAssignCollegeModal(userId) {
  const u = getUser(userId);
  showModal('Assign College — ' + u.name, `
    <div class="field-wrap">
      <label class="field-label">College</label>
      <select id="ac-col" class="field-select">
        <option value="">— Select College —</option>
        ${DB.colleges.map(c => `<option value="${c.id}" ${u.collegeId===c.id?'selected':''}>${esc(c.name)}</option>`).join('')}
      </select>
    </div>
    <button class="btn btn-primary btn-full" onclick="doAssignCollege(${userId})">Save</button>
  `);
}

function doAssignCollege(userId) {
  const u   = getUser(userId);
  const cid = parseInt(document.getElementById('ac-col').value) || null;
  u.collegeId = cid;
  save();
  toast('College assigned.', 'success');
  closeModal();
  renderRegAssign();
}

/* ── Assign Department to Chairman ───── */
function showAssignDeptModal(userId) {
  const u = getUser(userId);
  showModal('Assign Department — ' + u.name, `
    <div class="field-wrap">
      <label class="field-label">College</label>
      <select id="ad-col" class="field-select" onchange="updateAssignDeptOptions(${userId})">
        <option value="">— Select College —</option>
        ${DB.colleges.map(c => `<option value="${c.id}" ${u.collegeId===c.id?'selected':''}>${esc(c.name)}</option>`).join('')}
      </select>
    </div>
    <div class="field-wrap">
      <label class="field-label">Department</label>
      <select id="ad-dept" class="field-select">
        <option value="">— Select Department —</option>
        ${DB.departments.filter(d => d.collegeId === u.collegeId).map(d =>
          `<option value="${d.id}" ${u.deptId===d.id?'selected':''}>${esc(d.name)}</option>`
        ).join('')}
      </select>
    </div>
    <button class="btn btn-primary btn-full" onclick="doAssignDept(${userId})">Save</button>
  `);
}

function updateAssignDeptOptions(userId) {
  const colId = parseInt(document.getElementById('ad-col').value);
  const sel   = document.getElementById('ad-dept');
  const depts = DB.departments.filter(d => d.collegeId === colId);
  sel.innerHTML = `<option value="">— Select Department —</option>` +
    depts.map(d => `<option value="${d.id}">${esc(d.name)}</option>`).join('');
}

function doAssignDept(userId) {
  const u      = getUser(userId);
  const colId  = parseInt(document.getElementById('ad-col').value) || null;
  const deptId = parseInt(document.getElementById('ad-dept').value) || null;
  u.collegeId  = colId;
  u.deptId     = deptId;
  save();
  toast('Department assigned.', 'success');
  closeModal();
  renderRegAssign();
}

/* ══════════════════════════════════════════
   ACADEMIC PERFORMANCE (Registrar view)
══════════════════════════════════════════ */
function renderRegPerf() {
  const allSecIds = DB.sections.filter(s => s.submitted).map(s => s.id);
  const sm        = gradeSummary(allSecIds);
  const yearData  = perfByYear(allSecIds);

  set(`
    <div class="page-header">
      <div>
        <div class="page-title">Academic Performance</div>
        <div class="page-sub">Institution-wide · Submitted grades only</div>
      </div>
    </div>

    <!-- Top stats -->
    <div class="grid-4 mb-20">
      ${statCard('📊','Total Grades', sm.total,  '#374151', '#f3f4f6')}
      ${statCard('✅','Passed',       sm.passed, 'var(--success)', '#dcfce7')}
      ${statCard('❌','Failed',       sm.failed, 'var(--danger)',  '#fee2e2')}
      ${statCard('📈','Pass Rate', sm.passRate != null ? sm.passRate+'%':'—', 'var(--blue)', '#dbeafe')}
    </div>

    <!-- Performance by Year Level -->
    <div class="section-card mb-20">
      <div class="section-card-head"><div class="fw-7">Performance by Year Level</div></div>
      <div class="section-card-body">
        ${yearData.length === 0
          ? `<div class="text-muted text-sm">No submitted grades yet.</div>`
          : `<div class="table-wrap"><table>
              <thead><tr><th>Year Level</th><th>Total</th><th>Passed</th><th>Failed</th><th>Pass Rate</th><th>Average</th></tr></thead>
              <tbody>
                ${yearData.map(r => `<tr>
                  <td class="fw-7">Year ${r.year}</td>
                  <td>${r.total}</td>
                  <td style="color:var(--success)">${r.passed}</td>
                  <td style="color:var(--danger)">${r.failed}</td>
                  <td>${prCell(r.passRate)}</td>
                  <td class="mono text-sm">${r.avg ? fmt2(r.avg) : '—'}</td>
                </tr>`).join('')}
              </tbody>
            </table></div>`}
      </div>
    </div>

    <!-- Performance by College -->
    <div class="section-card mb-20">
      <div class="section-card-head"><div class="fw-7">Performance by College</div></div>
      <div class="section-card-body">
        ${DB.colleges.length === 0
          ? `<div class="text-muted text-sm">No colleges found.</div>`
          : `<div class="table-wrap"><table>
              <thead><tr><th>College</th><th>Total</th><th>Passed</th><th>Failed</th><th>Pass Rate</th><th>Average</th></tr></thead>
              <tbody>
                ${DB.colleges.map(col => {
                  const sids = secIdsForCollege(col.id).filter(sid => getSection(sid)?.submitted);
                  const sm   = gradeSummary(sids);
                  return `<tr>
                    <td class="fw-6">${esc(col.name)}</td>
                    <td>${sm.total}</td>
                    <td style="color:var(--success)">${sm.passed}</td>
                    <td style="color:var(--danger)">${sm.failed}</td>
                    <td>${prCell(sm.passRate)}</td>
                    <td class="mono text-sm">${sm.avg ? fmt2(sm.avg) : '—'}</td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table></div>`}
      </div>
    </div>

    <!-- Visual bar chart -->
    <div class="card">
      <div class="card-title">Pass Rate by Year Level</div>
      ${yearData.length === 0
        ? `<div class="text-muted text-sm">No data yet.</div>`
        : yearData.map(r => barRow(`Year ${r.year}`, r.passRate, r.passRate!=null&&r.passRate>=75?'var(--success)':'var(--warning)')).join('')}
    </div>
  `);
}
