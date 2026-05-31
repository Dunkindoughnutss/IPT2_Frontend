function renderCollegesAdmin(activeColId = null) {
  const activeCol = activeColId ? getCollege(activeColId) : null;
  const depts     = activeColId ? DB.departments.filter(d => d.collegeId === activeColId) : [];

  set(`
    <div class="page-header">
      <div class="page-title">Colleges &amp; Departments</div>
      <button class="btn btn-primary" onclick="showAddCollegeModal()">+ Add College</button>
    </div>

    <div style="display:grid;grid-template-columns:${activeCol ? '320px 1fr' : '1fr'};gap:20px;align-items:start">

      <!-- College list -->
      <div class="section-card" style="margin-bottom:0">
        <div class="section-card-head" style="background:var(--bg3)">
          <div class="fw-6">Colleges (${DB.colleges.length})</div>
        </div>
        ${DB.colleges.length === 0
          ? `<div class="empty" style="padding:36px">
              <div class="empty-icon">🏛</div>
              <div class="empty-text">No colleges yet.<br>Click <strong>+ Add College</strong> to begin.</div>
            </div>`
          : `<div style="padding:10px">
              ${DB.colleges.map(col => {
                const deptCount = DB.departments.filter(d => d.collegeId === col.id).length;
                const stuCount  = DB.students.filter(s => s.collegeId === col.id).length;
                const isActive  = activeColId === col.id;
                return `<div onclick="renderCollegesAdmin(${col.id})"
                  style="cursor:pointer;padding:14px 16px;border-radius:10px;margin-bottom:6px;
                    border:1.5px solid ${isActive ? 'var(--blue)' : 'var(--border)'};
                    background:${isActive ? 'var(--blue-dim)' : 'var(--bg3)'};
                    transition:all .15s">
                  <div class="flex-between">
                    <div>
                      <div class="fw-7" style="font-size:.9rem;color:${isActive ? 'var(--blue)' : 'var(--text)'}">${esc(col.name)}</div>
                      <div class="text-xs text-muted mt-2">${deptCount} dept(s) · ${stuCount} student(s)</div>
                    </div>
                    ${isActive ? '' : `<button class="btn btn-sm btn-danger"
                      onclick="event.stopPropagation();deleteCollege(${col.id})"
                      title="Delete college">✕</button>`}
                  </div>
                </div>`;
              }).join('')}
            </div>`}
      </div>

      <!-- Department panel (shown when a college is selected) -->
      ${activeCol ? `
      <div class="section-card" style="margin-bottom:0">
        <div class="section-card-head" style="background:var(--bg3)">
          <div>
            <div class="fw-7">${esc(activeCol.name)}</div>
            <div class="text-xs text-muted mt-1">Departments — ${depts.length} registered</div>
          </div>
          <div class="flex gap-8">
            <button class="btn btn-ghost btn-sm" onclick="showEditCollegeModal(${activeCol.id})">✎ Edit Name</button>
            <button class="btn btn-primary btn-sm" onclick="showAddDeptModal(${activeCol.id})">+ Add Department</button>
          </div>
        </div>
        ${depts.length === 0
          ? `<div class="empty" style="padding:36px">
              <div class="empty-icon">📁</div>
              <div class="empty-text">No departments yet.<br>Click <strong>+ Add Department</strong>.</div>
            </div>`
          : `<div class="table-wrap"><table>
              <thead><tr>
                <th>Department Name</th><th>Subjects</th><th>Students</th><th>Faculty</th><th>Actions</th>
              </tr></thead>
              <tbody>${depts.map(dept => {
                const subjCount = DB.subjects.filter(s => s.deptId === dept.id).length;
                const stuCount  = DB.students.filter(s => s.deptId === dept.id).length;
                const facCount  = DB.users.filter(u => u.role === 'Faculty' && u.deptId === dept.id).length;
                return `<tr>
                  <td class="fw-6">${esc(dept.name)}</td>
                  <td>${subjCount}</td>
                  <td>${stuCount}</td>
                  <td>${facCount}</td>
                  <td><div class="flex gap-6">
                    <button class="btn btn-sm btn-ghost" onclick="showEditDeptModal(${dept.id})">✎ Edit</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteDept(${dept.id},${activeCol.id})">✕ Delete</button>
                  </div></td>
                </tr>`;
              }).join('')}</tbody>
            </table></div>`}
      </div>` : `
      <div class="empty" style="background:var(--white);border:1.5px dashed var(--border);border-radius:var(--radius-lg);padding:60px">
        <div class="empty-icon">👈</div>
        <div class="empty-text">Select a college to manage its departments.</div>
      </div>`}

    </div>
  `);
}

/* College CRUD */
function showAddCollegeModal() {
  showModal('Add College', `
    <div class="field-wrap">
      <div class="field-label">College Name</div>
      <input id="col-name" class="input" placeholder="e.g. College of Science">
    </div>`,
    `<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" onclick="addCollege()">Add College</button>`
  );
}

function addCollege() {
  const name = document.getElementById('col-name').value.trim();
  if (!name) { toast('College name is required', 'error'); return; }
  if (DB.colleges.find(c => c.name.toLowerCase() === name.toLowerCase())) {
    toast('A college with this name already exists', 'error'); return;
  }
  const id = DB.nextId.college++;
  DB.colleges.push({ id, name });
  save();
  logAudit(`College added: ${name}`);
  toast(`${name} added`, 'success');
  closeModal();
  renderCollegesAdmin(id);
}

function showEditCollegeModal(id) {
  const col = getCollege(id);
  if (!col) return;
  showModal('Edit College Name', `
    <div class="field-wrap">
      <div class="field-label">College Name</div>
      <input id="col-edit-name" class="input" value="${esc(col.name)}">
    </div>`,
    `<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" onclick="editCollege(${id})">Save</button>`
  );
}

function editCollege(id) {
  const col  = getCollege(id);
  if (!col) return;
  const name = document.getElementById('col-edit-name').value.trim();
  if (!name) { toast('Name required', 'error'); return; }
  col.name = name;
  save();
  logAudit(`College renamed: ${name}`);
  toast('College name updated', 'success');
  closeModal();
  renderCollegesAdmin(id);
}

function deleteCollege(id) {
  const col = getCollege(id);
  if (!col) return;
  const depts   = DB.departments.filter(d => d.collegeId === id);
  const stuCount = DB.students.filter(s => s.collegeId === id).length;
  if (depts.length > 0 || stuCount > 0) {
    showModal('Cannot Delete College', `
      <div class="alert-box" style="background:var(--danger-dim);border:1px solid rgba(230,57,70,.3);color:#b91c1c;border-radius:10px;padding:14px 16px;line-height:1.6">
        <strong>${esc(col.name)}</strong> cannot be deleted because it still has
        <strong>${depts.length} department(s)</strong> and <strong>${stuCount} student(s)</strong>.<br><br>
        Remove all departments and reassign or remove all students first.
      </div>`,
      `<button class="btn btn-primary" onclick="closeModal()">OK</button>`
    );
    return;
  }
  if (!confirm(`Delete "${col.name}"? This cannot be undone.`)) return;
  DB.colleges    = DB.colleges.filter(c => c.id !== id);
  DB.departments = DB.departments.filter(d => d.collegeId !== id);
  save();
  logAudit(`College deleted: ${col.name}`);
  toast(`${col.name} deleted`, 'info');
  renderCollegesAdmin(null);
}

/* Department CRUD */
function showAddDeptModal(colId) {
  showModal('Add Department', `
    <div class="field-wrap">
      <div class="field-label">Department Name</div>
      <input id="dept-name" class="input" placeholder="e.g. Department of Information Technology">
    </div>`,
    `<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" onclick="addDept(${colId})">Add Department</button>`
  );
}

function addDept(colId) {
  const name = document.getElementById('dept-name').value.trim();
  if (!name) { toast('Department name is required', 'error'); return; }
  if (DB.departments.find(d => d.collegeId === colId && d.name.toLowerCase() === name.toLowerCase())) {
    toast('A department with this name already exists in this college', 'error'); return;
  }
  const id = DB.nextId.dept++;
  DB.departments.push({ id, collegeId: colId, name });
  save();
  logAudit(`Department added: ${name}`);
  toast(`${name} added`, 'success');
  closeModal();
  renderCollegesAdmin(colId);
}

function showEditDeptModal(id) {
  const dept = getDept(id);
  if (!dept) return;
  showModal('Edit Department Name', `
    <div class="field-wrap">
      <div class="field-label">Department Name</div>
      <input id="dept-edit-name" class="input" value="${esc(dept.name)}">
    </div>`,
    `<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" onclick="editDept(${id})">Save</button>`
  );
}

function editDept(id) {
  const dept = getDept(id);
  if (!dept) return;
  const name = document.getElementById('dept-edit-name').value.trim();
  if (!name) { toast('Name required', 'error'); return; }
  dept.name = name;
  save();
  logAudit(`Department renamed: ${name}`);
  toast('Department updated', 'success');
  closeModal();
  renderCollegesAdmin(dept.collegeId);
}

function deleteDept(id, colId) {
  const dept     = getDept(id);
  if (!dept) return;
  const stuCount = DB.students.filter(s => s.deptId === id).length;
  const facCount = DB.users.filter(u => u.deptId === id).length;
  const subjCount = DB.subjects.filter(s => s.deptId === id).length;
  if (stuCount > 0 || facCount > 0 || subjCount > 0) {
    showModal('Cannot Delete Department', `
      <div class="alert-box" style="background:var(--danger-dim);border:1px solid rgba(230,57,70,.3);color:#b91c1c;border-radius:10px;padding:14px 16px;line-height:1.6">
        <strong>${esc(dept.name)}</strong> cannot be deleted because it still has
        <strong>${stuCount} student(s)</strong>, <strong>${facCount} account(s)</strong>,
        and <strong>${subjCount} subject(s)</strong>.<br><br>
        Remove all linked data before deleting this department.
      </div>`,
      `<button class="btn btn-primary" onclick="closeModal()">OK</button>`
    );
    return;
  }
  if (!confirm(`Delete "${dept.name}"? This cannot be undone.`)) return;
  DB.departments = DB.departments.filter(d => d.id !== id);
  save();
  logAudit(`Department deleted: ${dept.name}`);
  toast(`${dept.name} deleted`, 'info');
  renderCollegesAdmin(colId);
}
