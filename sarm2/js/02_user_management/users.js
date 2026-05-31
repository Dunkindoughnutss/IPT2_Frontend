function renderUsers(activeRole = null, q = '', filterColId = null, filterDeptId = null) {
  const roles      = ['Registrar', 'Dean', 'Chairman', 'Faculty', 'Student'];
  const lockedCount = DB.users.filter(u => u.lockedOut).length;

  // Role card overview
  if (!activeRole) {
    const roleMeta = {
      Registrar: { icon: '🗂', color: 'var(--blue)',    bg: 'var(--blue-dim)',    desc: 'System administrator' },
      Dean:      { icon: '🏛', color: 'var(--teal)',    bg: 'var(--teal-dim)',    desc: 'College-level access' },
      Chairman:  { icon: '🏫', color: '#8b5cf6',       bg: 'rgba(139,92,246,.1)', desc: 'Department-level access' },
      Faculty:   { icon: '👨‍🏫',color: 'var(--warning)', bg: 'var(--warning-dim)', desc: 'Grade encoding & advisees' },
      Student:   { icon: '🎓', color: 'var(--success)', bg: 'var(--success-dim)', desc: 'Student portal access' },
    };
    set(`
      <div class="page-header">
        <div class="page-title">
          User Accounts (${DB.users.length})
          ${lockedCount ? `<span class="badge badge-danger" style="margin-left:8px">${lockedCount} Locked</span>` : ''}
        </div>
        <button class="btn btn-primary" onclick="showAddUserModal()">+ Add Account</button>
      </div>
      <div class="mb-12 text-sm text-muted">Select a role to view and manage accounts.</div>
      <div class="grid-3" style="gap:14px">
        ${roles.map(role => {
          const meta  = roleMeta[role] || { icon: '👤', color: 'var(--text3)', bg: 'var(--bg4)', desc: '' };
          const count = DB.users.filter(u => u.role === role).length;
          const locked = DB.users.filter(u => u.role === role && u.lockedOut).length;
          return `<div onclick="renderUsers('${role}','',null,null)" style="cursor:pointer;background:var(--white);border:1.5px solid var(--border);border-radius:var(--radius-lg);padding:20px;box-shadow:var(--shadow);transition:all .18s" onmouseover="this.style.borderColor='var(--blue)';this.style.transform='translateY(-2px)'" onmouseout="this.style.borderColor='var(--border)';this.style.transform='none'">
            <div class="flex gap-12 mb-12">
              <div style="width:44px;height:44px;border-radius:12px;background:${meta.bg};display:flex;align-items:center;justify-content:center;font-size:1.3rem;flex-shrink:0">${meta.icon}</div>
              <div>
                <div class="fw-7" style="color:${meta.color};font-size:1rem">${role}</div>
                <div class="text-xs text-muted">${meta.desc}</div>
              </div>
            </div>
            <div class="flex-between">
              <span style="font-size:1.6rem;font-weight:800;color:var(--text)">${count}</span>
              ${locked ? `<span class="badge badge-danger">⛔ ${locked} Locked</span>` : '<span class="badge badge-success">All Active</span>'}
            </div>
          </div>`;
        }).join('')}
      </div>`);
    return;
  }

  // Filter list
  let list = DB.users.filter(u => u.role === activeRole);
  if (activeRole === 'Student') {
    // For student accounts, filter by linked student record's college/dept
    if (filterColId)  list = list.filter(u => getStudent(u.studentId)?.collegeId === filterColId);
    if (filterDeptId) list = list.filter(u => getStudent(u.studentId)?.deptId    === filterDeptId);
  }
  if (q) {
    const lq = q.toLowerCase();
    list = list.filter(u =>
      u.name.toLowerCase().includes(lq) ||
      u.username.toLowerCase().includes(lq) ||
      (u.studentId && u.studentId.toLowerCase().includes(lq))
    );
  }

  const isStudent = activeRole === 'Student';
  const colOpts   = DB.colleges.map(c => `<option value="${c.id}" ${filterColId===c.id?'selected':''}>${esc(c.name)}</option>`).join('');
  const deptOpts  = (filterColId
    ? DB.departments.filter(d => d.collegeId === filterColId)
    : DB.departments
  ).map(d => `<option value="${d.id}" ${filterDeptId===d.id?'selected':''}>${esc(d.name.replace('Department of ',''))}</option>`).join('');

  set(`
    <div class="page-header">
      <div class="flex gap-10" style="align-items:center;flex-wrap:wrap">
        <button class="btn btn-ghost btn-sm" onclick="renderUsers(null,'',null,null)">← All Roles</button>
        <div class="page-title">${activeRole} Accounts (${list.length})</div>
      </div>
      <div class="flex gap-10" style="flex-wrap:wrap">
        <div class="search-wrap">
          <input class="search-input" placeholder="${isStudent ? 'Search name or student ID…' : 'Search name or username…'}"
            value="${esc(q)}" oninput="renderUsers('${activeRole}',this.value,${filterColId||'null'},${filterDeptId||'null'})">
        </div>
        ${isStudent ? `
        <select class="select-input" style="width:200px" onchange="renderUsers('Student','${q}',+this.value||null,null)">
          <option value="">— All Colleges —</option>${colOpts}
        </select>
        <select class="select-input" style="width:210px" onchange="renderUsers('Student','${q}',${filterColId||'null'},+this.value||null)">
          <option value="">— All Departments —</option>${deptOpts}
        </select>` : ''}
        <button class="btn btn-primary" onclick="showAddUserModal()">+ Add Account</button>
      </div>
    </div>
    <div class="section-card">
      <div class="table-wrap"><table>
        <thead><tr>
          <th>Name</th><th>Username</th><th>Scope</th><th>Created</th><th>Status</th><th>Actions</th>
        </tr></thead>
        <tbody>
          ${list.length === 0
            ? `<tr><td colspan="6" class="table-empty">No ${activeRole} accounts found.</td></tr>`
            : list.map(u => {
                let scope = '—';
                if (u.studentId)      scope = 'ID: ' + u.studentId;
                else if (u.deptId)    scope = getDept(u.deptId)?.name?.replace('Department of ', '') || '—';
                else if (u.collegeId) scope = getCollege(u.collegeId)?.name?.replace('College of ', '') || '—';
                const statusBadge = u.lockedOut
                  ? '<span class="badge badge-danger">⛔ Locked</span>'
                  : u.active ? '<span class="badge badge-success">Active</span>'
                  : '<span class="badge badge-muted">Inactive</span>';
                return `<tr>
                  <td><div class="flex gap-10">
                    <div class="avatar avatar-sm">${initials(u.name)}</div>
                    <span class="fw-6">${esc(u.name)}</span>
                  </div></td>
                  <td class="mono text-sm text-muted">${esc(u.username)}</td>
                  <td class="text-xs text-muted">${esc(scope)}</td>
                  <td class="text-sm text-muted">${esc(u.created || '—')}</td>
                  <td>${statusBadge}${u.failedAttempts > 0 && !u.lockedOut ? `<span class="text-xs text-muted" style="margin-left:6px">${u.failedAttempts} fail(s)</span>` : ''}</td>
                  <td><div class="flex gap-8">
                    <button class="btn btn-sm btn-ghost" onclick="showEditUserModal(${u.id})">✎ Edit</button>
                    ${u.lockedOut
                      ? `<button class="btn btn-sm btn-success" onclick="unlockUser(${u.id})">🔓 Unlock</button>`
                      : `<button class="btn btn-sm ${u.active ? 'btn-danger' : 'btn-success'}" onclick="toggleUser(${u.id})">${u.active ? 'Deactivate' : 'Activate'}</button>`}
                    ${currentUser.id !== u.id ? `<button class="btn btn-sm btn-danger" onclick="deleteUser(${u.id})">✕</button>` : ''}
                  </div></td>
                </tr>`;
              }).join('')}
        </tbody>
      </table></div>
    </div>`);
}

function unlockUser(id) {
  const u = DB.users.find(x => x.id === id);
  if (!u) return;
  u.lockedOut = false;
  u.failedAttempts = 0;
  save();
  logAudit(`Account unlocked: ${u.username}`);
  toast(`${u.name}'s account has been unlocked`, 'success');
  renderUsers(u.role,'',null,null);
}

function showAddUserModal() {
  const roles   = ['Dean', 'Chairman', 'Faculty', 'Student'];
  const colOpts = DB.colleges.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
  const deptOpts = DB.departments.map(d => `<option value="${d.id}">${esc(d.name)}</option>`).join('');

  showModal('Add New Account', `
    <div class="grid-2">
      <div class="field-wrap"><div class="field-label">Full Name</div><input id="fn" class="input" placeholder="Juan dela Cruz"></div>
      <div class="field-wrap"><div class="field-label">Role</div>
        <select id="fr" class="select-input" onchange="toggleScope(this.value)">
          ${roles.map(r => `<option>${r}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="grid-2">
      <div class="field-wrap"><div class="field-label">Username</div><input id="fu" class="input" placeholder="username"></div>
      <div class="field-wrap"><div class="field-label">Password</div>
        <div style="position:relative">
          <input id="fp" class="input" type="password" placeholder="••••••••" style="padding-right:40px">
          <button type="button" onclick="togglePwdVis('fp',this)" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:var(--text3);font-size:1rem;padding:2px">👁</button>
        </div>
      </div>
    </div>
    <div id="sc-col"  class="field-wrap"><div class="field-label">College</div><select id="fc" class="select-input" onchange="filterStuSearch()">${colOpts}</select></div>
    <div id="sc-dept" class="field-wrap hidden"><div class="field-label">Department</div><select id="fd" class="select-input" onchange="filterStuSearch()">${deptOpts}</select></div>

    <!-- Student link panel -->
    <div id="sc-stu" class="field-wrap hidden">
      <div class="field-label">Link to Student Record</div>
      <div class="flex gap-8 mb-8">
        <select id="stu-filter-col" class="select-input" style="flex:1" onchange="filterStuSearch()">
          <option value="">— All Colleges —</option>
          ${DB.colleges.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}
        </select>
        <select id="stu-filter-dept" class="select-input" style="flex:1" onchange="filterStuSearch()">
          <option value="">— All Departments —</option>
          ${DB.departments.map(d => `<option value="${d.id}">${esc(d.name.replace('Department of ',''))}</option>`).join('')}
        </select>
      </div>
      <input id="stu-search" class="input" placeholder="Search name or student ID…" oninput="filterStuSearch()" style="margin-bottom:8px">
      <select id="fs" class="select-input" style="height:140px" size="5">
        <option value="">— Select a student record —</option>
        ${DB.students.filter(s => !DB.users.find(u => u.studentId === s.id))
          .map(s => `<option value="${s.id}">${esc(s.id)} — ${esc(s.name)} (${getDept(s.deptId)?.name.replace('Department of ','') || '—'})</option>`).join('')}
      </select>
      <div class="text-xs text-muted mt-4">Only students without an account are shown.</div>
    </div>`,
    `<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" onclick="addUser()">Create Account</button>`
  );
  toggleScope('Dean');
}

function filterStuSearch() {
  const q      = (document.getElementById('stu-search')?.value || '').toLowerCase();
  const colId  = +document.getElementById('stu-filter-col')?.value || null;
  const deptId = +document.getElementById('stu-filter-dept')?.value || null;
  const sel    = document.getElementById('fs');
  if (!sel) return;
  const linked = new Set(DB.users.filter(u => u.studentId).map(u => u.studentId));
  const pool   = DB.students.filter(s => {
    if (linked.has(s.id)) return false;
    if (colId  && s.collegeId !== colId)  return false;
    if (deptId && s.deptId    !== deptId) return false;
    if (q && !s.name.toLowerCase().includes(q) && !s.id.includes(q)) return false;
    return true;
  });
  sel.innerHTML = `<option value="">— Select a student record —</option>` +
    pool.map(s => `<option value="${s.id}">${esc(s.id)} — ${esc(s.name)} (${getDept(s.deptId)?.name.replace('Department of ','') || '—'})</option>`).join('');
}

function toggleScope(role) {
  document.getElementById('sc-col').classList.toggle('hidden',  role === 'Student');
  document.getElementById('sc-dept').classList.toggle('hidden', role !== 'Chairman' && role !== 'Faculty');
  document.getElementById('sc-stu').classList.toggle('hidden',  role !== 'Student');
}

function addUser() {
  const name  = document.getElementById('fn').value.trim();
  const role  = document.getElementById('fr').value;
  const uname = document.getElementById('fu').value.trim();
  const pass  = document.getElementById('fp').value;
  if (!name || !uname || !pass) { toast('All fields are required', 'error'); return; }
  if (DB.users.find(u => u.username === uname)) { toast('Username already exists', 'error'); return; }

  // One-per-scope validation
  if (role === 'Dean') {
    const colId = +document.getElementById('fc').value;
    const existing = DB.users.find(u => u.role === 'Dean' && u.collegeId === colId);
    if (existing) {
      const colName = getCollege(colId)?.name || 'this college';
      showModal('⚠ Account Already Exists',
        `<div class="alert-box" style="background:var(--warning-dim);border:1px solid rgba(244,140,6,.3);color:#92400e;border-radius:10px;padding:14px 16px;font-size:.88rem;line-height:1.6">
          <strong>${esc(colName)}</strong> already has a Dean account assigned to <strong>${esc(existing.name)}</strong>.<br><br>
          Only <strong>one Dean account</strong> is allowed per college. Please remove the existing Dean account first before creating a new one.
        </div>`,
        `<button class="btn btn-primary" onclick="closeModal()">Understood</button>`
      );
      return;
    }
  }

  if (role === 'Chairman') {
    const deptId = +document.getElementById('fd').value;
    const existing = DB.users.find(u => u.role === 'Chairman' && u.deptId === deptId);
    if (existing) {
      const deptName = getDept(deptId)?.name || 'this department';
      showModal('⚠ Account Already Exists',
        `<div class="alert-box" style="background:var(--warning-dim);border:1px solid rgba(244,140,6,.3);color:#92400e;border-radius:10px;padding:14px 16px;font-size:.88rem;line-height:1.6">
          <strong>${esc(deptName)}</strong> already has a Chairman account assigned to <strong>${esc(existing.name)}</strong>.<br><br>
          Only <strong>one Chairman account</strong> is allowed per department. Please remove the existing Chairman account first before creating a new one.
        </div>`,
        `<button class="btn btn-primary" onclick="closeModal()">Understood</button>`
      );
      return;
    }
  }

  const obj = { id: DB.nextId.user++, name, role, username: uname, password: pass, active: true, created: new Date().toISOString().slice(0, 10), failedAttempts: 0, lockedOut: false };
  if (role === 'Dean') obj.collegeId = +document.getElementById('fc').value;
  if (role === 'Chairman' || role === 'Faculty') {
    obj.deptId    = +document.getElementById('fd').value;
    obj.collegeId = getDept(obj.deptId)?.collegeId;
  }
  if (role === 'Student') {
    const sid = document.getElementById('fs').value;
    if (sid) obj.studentId = sid;
  }
  DB.users.push(obj);
  save();
  logAudit(`User created: ${uname}`);
  toast('Account created successfully', 'success');
  closeModal();
  renderUsers(role,'',null,null);
}

function showEditUserModal(id) {
  const u = DB.users.find(x => x.id === id);
  if (!u) return;
  showModal('Edit Account', `
    <div class="grid-2">
      <div class="field-wrap"><div class="field-label">Full Name</div><input id="en" class="input" value="${esc(u.name)}"></div>
      <div class="field-wrap"><div class="field-label">Role</div><input class="input" value="${esc(u.role)}" disabled style="opacity:.5"></div>
    </div>
    <div class="field-wrap">
      <div class="field-label">New Password <span class="text-muted" style="font-weight:400;text-transform:none">(leave blank to keep current)</span></div>
      <input id="ep" class="input" type="password" placeholder="••••••••">
    </div>`,
    `<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" onclick="editUser(${id})">Save Changes</button>`
  );
}

function editUser(id) {
  const u = DB.users.find(x => x.id === id);
  if (!u) return;
  u.name = document.getElementById('en').value.trim() || u.name;
  const np = document.getElementById('ep').value;
  if (np) u.password = np;
  save();
  logAudit(`User edited: ${u.username}`);
  toast('Account updated', 'success');
  closeModal();
  renderUsers(u.role,'',null,null);
}

function toggleUser(id) {
  const u = DB.users.find(x => x.id === id);
  if (!u || u.id === currentUser.id) { toast('Cannot deactivate yourself', 'error'); return; }
  u.active = !u.active;
  save();
  logAudit(`User ${u.active ? 'activated' : 'deactivated'}: ${u.username}`);
  toast(`Account ${u.active ? 'activated' : 'deactivated'}`, u.active ? 'success' : 'info');
  renderUsers(u.role,'',null,null);
}

function deleteUser(id) {
  const u = DB.users.find(x => x.id === id);
  if (!confirm('Delete this account? This cannot be undone.')) return;
  DB.users = DB.users.filter(x => x.id !== id);
  save();
  logAudit('User account deleted');
  toast('Account removed', 'info');
  renderUsers(u?.role||null,'',null,null);
}


/* ──────────────────────────────────────────────
   ACADEMIC PERFORMANCE
────────────────────────────────────────────── */
