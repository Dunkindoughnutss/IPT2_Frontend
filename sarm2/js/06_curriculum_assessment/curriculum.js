function renderCurriculum(filterCol = null, filterDept = null) {
  const colleges = DB.colleges;
  const depts    = DB.departments;

  const colLabel  = filterCol  ? getCollege(filterCol)?.name  : null;
  const deptLabel = filterDept ? getDept(filterDept)?.name    : null;

  let breadcrumb = `<span onclick="renderCurriculum()" style="cursor:pointer;color:var(--blue)">All Colleges</span>`;
  if (filterCol)  breadcrumb += ` <span style="color:var(--text3)">›</span> <span onclick="renderCurriculum(${filterCol})" style="cursor:pointer;color:var(--blue)">${esc(colLabel?.replace('College of ','') || '')}</span>`;
  if (filterDept) breadcrumb += ` <span style="color:var(--text3)">›</span> <span style="color:var(--text2)">${esc(deptLabel?.replace('Department of ','') || '')}</span>`;

  set(`
    <div class="page-header">
      <div>
        <div class="page-title">Curriculum Management</div>
        <div class="text-sm text-muted mt-1">${breadcrumb}</div>
      </div>
      ${filterDept ? `<button class="btn btn-primary" onclick="showAddSubjectModal(${filterDept})">+ Add Subject</button>` : ''}
    </div>

    <!-- College folders -->
    ${!filterCol ? `
      <div class="mb-8 text-sm text-muted fw-6" style="letter-spacing:.8px">SELECT A COLLEGE</div>
      <div class="grid-3 mb-20">
        ${colleges.map(col => {
          const deptCount = depts.filter(d => d.collegeId === col.id).length;
          const subjCount = DB.subjects.filter(s => depts.filter(d => d.collegeId === col.id).map(d => d.id).includes(s.deptId)).length;
          return `<div onclick="renderCurriculum(${col.id})"
            style="cursor:pointer;background:var(--white);border:1.5px solid var(--border);border-radius:var(--radius-lg);padding:22px;box-shadow:var(--shadow);transition:all .18s"
            onmouseover="this.style.borderColor='var(--blue)';this.style.transform='translateY(-2px)'"
            onmouseout="this.style.borderColor='var(--border)';this.style.transform='none'">
            <div style="font-size:2.2rem;margin-bottom:12px">🏛</div>
            <div class="fw-7" style="font-size:.95rem;margin-bottom:4px">${esc(col.name)}</div>
            <div class="text-xs text-muted mb-12">${deptCount} department(s)</div>
            <div class="flex-between">
              <span style="font-size:1.4rem;font-weight:800;color:var(--blue)">${subjCount}</span>
              <span class="badge badge-info">Subjects</span>
            </div>
          </div>`;
        }).join('')}
      </div>` : ''}

    <!-- Dept folders -->
    ${filterCol && !filterDept ? `
      <div class="mb-8 text-sm text-muted fw-6" style="letter-spacing:.8px">SELECT A DEPARTMENT</div>
      <div class="grid-3 mb-20">
        ${depts.filter(d => d.collegeId === filterCol).map(dept => {
          const subjCount = DB.subjects.filter(s => s.deptId === dept.id).length;
          return `<div onclick="renderCurriculum(${filterCol},${dept.id})"
            style="cursor:pointer;background:var(--white);border:1.5px solid var(--border);border-radius:var(--radius-lg);padding:22px;box-shadow:var(--shadow);transition:all .18s"
            onmouseover="this.style.borderColor='var(--teal)';this.style.transform='translateY(-2px)'"
            onmouseout="this.style.borderColor='var(--border)';this.style.transform='none'">
            <div style="font-size:2.2rem;margin-bottom:12px">📂</div>
            <div class="fw-7" style="font-size:.9rem;margin-bottom:4px">${esc(dept.name)}</div>
            <div class="flex-between mt-12">
              <span style="font-size:1.4rem;font-weight:800;color:var(--teal)">${subjCount}</span>
              <span class="badge badge-teal">Subjects</span>
            </div>
          </div>`;
        }).join('')}
      </div>` : ''}

    <!-- Subject curriculum table by year level -->
    ${filterDept ? (() => {
      const subjects = DB.subjects.filter(s => s.deptId === filterDept);
      const years    = [1,2,3,4];
      const ordMap   = {1:'1st Year',2:'2nd Year',3:'3rd Year',4:'4th Year'};
      return years.map(yr => {
        const yrSubjs = subjects.filter(s => s.year === yr).sort((a,b) => a.sem - b.sem || a.code.localeCompare(b.code));
        return `
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;margin-top:${yr>1?'24px':'0'}">
            <div style="width:4px;height:26px;background:var(--blue);border-radius:4px"></div>
            <div style="font-size:1rem;font-weight:800;color:var(--blue)">${ordMap[yr]}</div>
            <span class="badge badge-info">${yrSubjs.length} subject(s)</span>
          </div>
          <div class="section-card mb-16">
            <div class="section-card-head" style="background:var(--bg3)">
              <div class="fw-6">${ordMap[yr]} Curriculum</div>
              <button class="btn btn-sm btn-primary" onclick="showAddSubjectModal(${filterDept},${yr})">+ Add Subject</button>
            </div>
            ${yrSubjs.length === 0
              ? `<div class="empty" style="padding:28px"><div class="empty-icon" style="font-size:1.6rem">📋</div><div class="empty-text">No subjects set for ${ordMap[yr]}.</div></div>`
              : `<div class="table-wrap"><table>
                  <thead><tr>
                    <th>Code</th><th>Subject Name</th><th>Units</th><th>Semester</th><th>Prerequisite</th><th>Actions</th>
                  </tr></thead>
                  <tbody>${yrSubjs.map(s => {
                    const prereq = s.prerequisiteId ? getSubject(s.prerequisiteId) : null;
                    return `<tr>
                      <td><span class="chip">${esc(s.code)}</span></td>
                      <td class="fw-6">${esc(s.name)}</td>
                      <td>${s.units}</td>
                      <td>${s.sem === 1 ? '1st Sem' : s.sem === 2 ? '2nd Sem' : 'Summer'}</td>
                      <td>${prereq
                        ? `<span class="badge badge-warning" title="${esc(prereq.name)}">${esc(prereq.code)}</span>`
                        : '<span class="text-muted text-xs">None</span>'}</td>
                      <td><div class="flex gap-6">
                        <button class="btn btn-sm btn-ghost" onclick="showEditSubjectModal(${s.id})">✎ Edit</button>
                        <button class="btn btn-sm btn-danger" onclick="deleteSubject(${s.id},${filterDept})">✕</button>
                      </div></td>
                    </tr>`;
                  }).join('')}</tbody>
                </table></div>`}
          </div>`;
      }).join('');
    })() : ''}
  `);
}

function showAddSubjectModal(deptId, defaultYear = 1) {
  const dept    = getDept(deptId);
  const allSubj = DB.subjects.filter(s => s.deptId === deptId);
  const prereqOpts = `<option value="">— None —</option>` +
    allSubj.map(s => `<option value="${s.id}">${esc(s.code)} — ${esc(s.name)}</option>`).join('');

  showModal(`Add Subject — ${dept ? esc(dept.name.replace('Department of ','')) : ''}`, `
    <div class="grid-2">
      <div class="field-wrap"><div class="field-label">Subject Code</div><input id="sc-code" class="input" placeholder="e.g. IT 301"></div>
      <div class="field-wrap"><div class="field-label">Subject Name</div><input id="sc-name" class="input" placeholder="e.g. Database Systems"></div>
    </div>
    <div class="grid-3">
      <div class="field-wrap"><div class="field-label">Units</div>
        <select id="sc-units" class="select-input">
          ${[1,2,3,4,5,6].map(u => `<option value="${u}" ${u===3?'selected':''}>${u}</option>`).join('')}
        </select>
      </div>
      <div class="field-wrap"><div class="field-label">Year Level</div>
        <select id="sc-year" class="select-input">
          ${[1,2,3,4].map(y => `<option value="${y}" ${y===defaultYear?'selected':''}>${y === 1?'1st':y===2?'2nd':y===3?'3rd':'4th'} Year</option>`).join('')}
        </select>
      </div>
      <div class="field-wrap"><div class="field-label">Semester</div>
        <select id="sc-sem" class="select-input">
          <option value="1">1st Semester</option>
          <option value="2">2nd Semester</option>
          <option value="3">Summer</option>
        </select>
      </div>
    </div>
    <div class="field-wrap">
      <div class="field-label">Prerequisite Subject <span style="font-weight:400;text-transform:none;color:var(--text4)">(optional)</span></div>
      <select id="sc-prereq" class="select-input">${prereqOpts}</select>
    </div>`,
    `<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" onclick="addSubject(${deptId})">Add Subject</button>`
  );
}

function addSubject(deptId) {
  const code   = document.getElementById('sc-code').value.trim();
  const name   = document.getElementById('sc-name').value.trim();
  const units  = +document.getElementById('sc-units').value;
  const year   = +document.getElementById('sc-year').value;
  const sem    = +document.getElementById('sc-sem').value;
  const prereq = +document.getElementById('sc-prereq').value || null;
  if (!code || !name) { toast('Subject code and name are required', 'error'); return; }
  if (DB.subjects.find(s => s.code === code && s.deptId === deptId)) { toast('Subject code already exists in this dept', 'error'); return; }

  const maxId = DB.subjects.length ? Math.max(...DB.subjects.map(s => s.id)) : 0;
  DB.subjects.push({ id: maxId + 1, deptId, code, name, units, year, sem, prerequisiteId: prereq });
  save();
  logAudit(`Subject added: ${code} — ${name}`);
  toast(`${code} added to curriculum`, 'success');
  closeModal();
  renderCurriculum(getCollege(getDept(deptId)?.collegeId)?.id, deptId);
}

function showEditSubjectModal(subjId) {
  const s       = getSubject(subjId);
  if (!s) return;
  const allSubj = DB.subjects.filter(x => x.deptId === s.deptId && x.id !== subjId);
  const prereqOpts = `<option value="">— None —</option>` +
    allSubj.map(x => `<option value="${x.id}" ${s.prerequisiteId===x.id?'selected':''}>${esc(x.code)} — ${esc(x.name)}</option>`).join('');

  showModal(`Edit Subject — ${esc(s.code)}`, `
    <div class="grid-2">
      <div class="field-wrap"><div class="field-label">Subject Code</div><input id="es-code" class="input" value="${esc(s.code)}"></div>
      <div class="field-wrap"><div class="field-label">Subject Name</div><input id="es-name" class="input" value="${esc(s.name)}"></div>
    </div>
    <div class="grid-3">
      <div class="field-wrap"><div class="field-label">Units</div>
        <select id="es-units" class="select-input">
          ${[1,2,3,4,5,6].map(u => `<option value="${u}" ${u===s.units?'selected':''}>${u}</option>`).join('')}
        </select>
      </div>
      <div class="field-wrap"><div class="field-label">Year Level</div>
        <select id="es-year" class="select-input">
          ${[1,2,3,4].map(y => `<option value="${y}" ${y===s.year?'selected':''}>${y===1?'1st':y===2?'2nd':y===3?'3rd':'4th'} Year</option>`).join('')}
        </select>
      </div>
      <div class="field-wrap"><div class="field-label">Semester</div>
        <select id="es-sem" class="select-input">
          <option value="1" ${s.sem===1?'selected':''}>1st Semester</option>
          <option value="2" ${s.sem===2?'selected':''}>2nd Semester</option>
          <option value="3" ${s.sem===3?'selected':''}>Summer</option>
        </select>
      </div>
    </div>
    <div class="field-wrap">
      <div class="field-label">Prerequisite</div>
      <select id="es-prereq" class="select-input">${prereqOpts}</select>
    </div>`,
    `<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" onclick="editSubject(${subjId})">Save Changes</button>`
  );
}

function editSubject(subjId) {
  const s = getSubject(subjId);
  if (!s) return;
  s.code           = document.getElementById('es-code').value.trim()  || s.code;
  s.name           = document.getElementById('es-name').value.trim()  || s.name;
  s.units          = +document.getElementById('es-units').value;
  s.year           = +document.getElementById('es-year').value;
  s.sem            = +document.getElementById('es-sem').value;
  s.prerequisiteId = +document.getElementById('es-prereq').value || null;
  save();
  logAudit(`Subject updated: ${s.code} — ${s.name}`);
  toast('Subject updated', 'success');
  closeModal();
  renderCurriculum(getCollege(getDept(s.deptId)?.collegeId)?.id, s.deptId);
}

function deleteSubject(subjId, deptId) {
  const s = getSubject(subjId);
  if (!s) return;
  if (DB.sections.some(sec => sec.subjectId === subjId)) {
    toast('Cannot delete — active sections exist for this subject', 'error');
    return;
  }
  if (!confirm(`Delete ${s.code} — ${s.name}? This cannot be undone.`)) return;
  DB.subjects = DB.subjects.filter(x => x.id !== subjId);
  // Clear prereq references
  DB.subjects.forEach(x => { if (x.prerequisiteId === subjId) x.prerequisiteId = null; });
  save();
  logAudit(`Subject deleted: ${s.code}`);
  toast(`${s.code} removed from curriculum`, 'info');
  renderCurriculum(getCollege(getDept(deptId)?.collegeId)?.id, deptId);
}

/* ══════════════════════════════════════════════
   END CURRICULUM MODULE
══════════════════════════════════════════════ */

/* ══════════════════════════════════════════════
   COLLEGES & DEPARTMENTS MODULE  (Registrar)
   Full CRUD for colleges and their departments
   (replaces hardcoded seed data)
══════════════════════════════════════════════ */
