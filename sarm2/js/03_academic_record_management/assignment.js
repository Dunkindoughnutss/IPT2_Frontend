function renderAssignment() {
  const deptId  = currentUser.deptId;
  const deptIds = [deptId];
  const subjects = DB.subjects.filter(s => deptIds.includes(s.deptId));
  const myFacs   = DB.users.filter(u => u.role === 'Faculty' && u.deptId === deptId && u.active);
  const mySecs   = DB.sections.filter(s => subjects.map(x=>x.id).includes(s.subjectId));

  set(`
    <div class="page-header">
      <div class="page-title">Subject Assignment</div>
      <button class="btn btn-primary" onclick="showCreateSectionModal()">+ Create Section</button>
    </div>

    ${subjects.length === 0
      ? `<div class="empty"><div class="empty-icon">📚</div><div class="empty-text">No subjects in curriculum yet.<br>Add subjects via Registrar → Curriculum.</div></div>`
      : `
      <!-- Subject-Faculty-Section table -->
      <div class="section-card mb-20">
        <div class="section-card-head" style="background:var(--bg3)">
          <div class="fw-7">📚 Subjects & Faculty Assignments</div>
          <div class="text-xs text-muted">Assign faculty per subject and manage sections</div>
        </div>
        <div class="table-wrap"><table>
          <thead><tr>
            <th>Subject Code</th><th>Subject Name</th><th>Units</th><th>Year</th><th>Sem</th>
            <th>Sections</th><th>Assigned Faculty</th><th>Actions</th>
          </tr></thead>
          <tbody>${subjects.map(subj => {
            const secList = mySecs.filter(s => s.subjectId === subj.id);
            const facIds  = [...new Set(secList.map(s => s.facultyId).filter(Boolean))];
            const facNames = facIds.map(id => getUser(id)?.name || '—').join(', ');
            return `<tr>
              <td><span class="chip">${esc(subj.code)}</span></td>
              <td class="fw-6">${esc(subj.name)}</td>
              <td>${subj.units}</td>
              <td>Year ${subj.year}</td>
              <td>${subj.sem === 1 ? '1st' : subj.sem === 2 ? '2nd' : 'Summer'}</td>
              <td>
                ${secList.length === 0
                  ? '<span class="text-muted text-xs">No sections</span>'
                  : secList.map(sec => {
                      const fac = getUser(sec.facultyId);
                      const enr = enrolledIn(sec.id).length;
                      return `<span class="badge badge-teal" style="margin:2px;cursor:pointer" title="${fac?fac.name:'No faculty'} — ${enr} students" onclick="showSectionDetailModal(${sec.id})">${esc(sec.sectionName)}</span>`;
                    }).join('')}
              </td>
              <td class="text-sm text-muted">${facNames || '—'}</td>
              <td><div class="flex gap-6">
                <button class="btn btn-sm btn-primary" onclick="showCreateSectionForSubject(${subj.id})">+ Section</button>
              </div></td>
            </tr>`;
          }).join('')}</tbody>
        </table></div>
      </div>

      <!-- All sections detail -->
      <div class="section-card">
        <div class="section-card-head" style="background:var(--bg3)">
          <div class="fw-7">📋 All Sections</div>
          <div class="text-xs text-muted">Reassign faculty · Move students between sections</div>
        </div>
        ${mySecs.length === 0
          ? `<div class="empty" style="padding:36px"><div class="empty-icon">📋</div><div class="empty-text">No sections yet.</div></div>`
          : `<div class="table-wrap"><table>
              <thead><tr>
                <th>Subject</th><th>Section</th><th>Faculty</th><th>School Year</th><th>Sem</th>
                <th>Enrolled</th><th>Status</th><th>Actions</th>
              </tr></thead>
              <tbody>${mySecs.map(sec => {
                const subj = getSubject(sec.subjectId);
                const fac  = getUser(sec.facultyId);
                const enr  = enrolledIn(sec.id).length;
                return `<tr>
                  <td><span class="chip">${subj ? esc(subj.code) : '—'}</span></td>
                  <td><span class="badge badge-teal fw-7">${esc(sec.sectionName)}</span></td>
                  <td class="text-sm">${fac ? esc(fac.name) : '<span class="text-muted">Unassigned</span>'}</td>
                  <td class="text-sm text-muted">${esc(sec.sy)}</td>
                  <td class="text-sm text-muted">${esc(sec.sem)}</td>
                  <td><span class="fw-6" style="color:var(--blue)">${enr}</span> / <span class="text-muted">${sec.quota || 40}</span></td>
                  <td><span class="badge badge-${sec.submitted?'success':'muted'}">${sec.submitted?'✔ Submitted':'Draft'}</span></td>
                  <td><div class="flex gap-6">
                    <button class="btn btn-sm btn-ghost" onclick="showReassignModal(${sec.id})">✎ Faculty</button>
                    <button class="btn btn-sm btn-ghost" onclick="showSectionDetailModal(${sec.id})">👥 Students</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteSection(${sec.id})">✕</button>
                  </div></td>
                </tr>`;
              }).join('')}</tbody>
            </table></div>`}
      </div>
    `}
  `);
}

function showCreateSectionForSubject(subjId) {
  const subj  = getSubject(subjId);
  const dids  = scopeDeptIds();
  const facs  = DB.users.filter(u => u.role === 'Faculty' && dids.includes(u.deptId) && u.active);
  showModal(`Create Section — ${subj ? esc(subj.code) : ''}`, `
    <div class="grid-2">
      <div class="field-wrap"><div class="field-label">Section Name</div>
        <input id="cs-n" class="input" placeholder="e.g. Section A or BSIT-1A">
      </div>
      <div class="field-wrap"><div class="field-label">School Year</div>
        <input id="cs-y" class="input" value="${new Date().getFullYear()}-${new Date().getFullYear()+1}">
      </div>
    </div>
    <div class="grid-2">
      <div class="field-wrap"><div class="field-label">Semester</div>
        <select id="cs-sem" class="select-input"><option>1st</option><option>2nd</option><option>Summer</option></select>
      </div>
      <div class="field-wrap"><div class="field-label">Student Quota</div>
        <input id="cs-quota" class="input" type="number" min="30" max="40" value="40" placeholder="30–40">
      </div>
    </div>
    <div class="field-wrap"><div class="field-label">Assign Faculty</div>
      <select id="cs-f" class="select-input">
        <option value="">— Unassigned —</option>
        ${facs.map(f => `<option value="${f.id}">${esc(f.name)}</option>`).join('')}
      </select>
    </div>`,
    `<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" onclick="createSectionForSubject(${subjId})">Create</button>`
  );
}

function createSectionForSubject(subjId) {
  const secName = document.getElementById('cs-n').value.trim();
  const sy      = document.getElementById('cs-y').value.trim();
  const sem     = document.getElementById('cs-sem').value;
  const quota   = Math.min(40, Math.max(30, +document.getElementById('cs-quota').value || 40));
  const facId   = +document.getElementById('cs-f').value || null;
  if (!secName || !sy) { toast('Section name and school year required', 'error'); return; }
  DB.sections.push({ id: DB.nextId.section++, subjectId: subjId, facultyId: facId, sy, sem, sectionName: secName, submitted: false, submittedAt: null, quota });
  save();
  logAudit(`Section created: ${secName}`);
  toast('Section created', 'success');
  closeModal();
  renderAssignment();
}

// Section detail modal — show enrolled students + move to another section
function showSectionDetailModal(sectionId) {
  const sec      = getSection(sectionId);
  const subj     = getSubject(sec?.subjectId);
  const enrolled = enrolledIn(sectionId);
  const fac      = getUser(sec?.facultyId);
  // Sibling sections (same subject)
  const siblings = DB.sections.filter(s => s.subjectId === sec?.subjectId && s.id !== sectionId);

  showModal(`Section: ${subj ? esc(subj.code) : '—'} — ${esc(sec?.sectionName || '')}`, `
    <div style="background:var(--bg3);border-radius:10px;padding:12px 16px;margin-bottom:16px;font-size:.84rem">
      <strong>Faculty:</strong> ${fac ? esc(fac.name) : 'Unassigned'} &nbsp;·&nbsp;
      <strong>Enrolled:</strong> ${enrolled.length}/${sec?.quota || 40}
    </div>
    ${enrolled.length === 0
      ? '<div class="text-muted text-sm">No students enrolled in this section.</div>'
      : `<div class="table-wrap"><table style="min-width:unset">
          <thead><tr><th>Name</th><th>ID</th>${siblings.length ? '<th>Move To</th>' : ''}</tr></thead>
          <tbody>${enrolled.map(s => `<tr>
            <td class="fw-6 text-sm">${esc(s.name)}</td>
            <td class="mono text-xs text-muted">${esc(s.id)}</td>
            ${siblings.length ? `<td>
              <select class="select-input" style="width:140px;font-size:.78rem" onchange="moveStudentSection('${s.id}',${sectionId},+this.value)">
                <option value="">Move to…</option>
                ${siblings.map(si => `<option value="${si.id}">${esc(si.sectionName)}</option>`).join('')}
              </select>
            </td>` : ''}
          </tr>`).join('')}</tbody>
        </table></div>`}`,
    `<button class="btn btn-ghost" onclick="closeModal()">Close</button>`
  );
}

function moveStudentSection(studentId, fromSectionId, toSectionId) {
  if (!toSectionId) return;
  const toSec = getSection(toSectionId);
  const enrInTo = enrolledIn(toSectionId).length;
  if (enrInTo >= (toSec?.quota || 40)) {
    toast(`Section ${toSec?.sectionName} is full (${toSec?.quota || 40} max)`, 'error');
    return;
  }
  // Move enrollment
  const enr = DB.enrollments.find(e => e.studentId === studentId && e.sectionId === fromSectionId);
  if (enr) enr.sectionId = toSectionId;
  // Move grade if any
  const gr = DB.grades.find(g => g.studentId === studentId && g.sectionId === fromSectionId);
  if (gr) gr.sectionId = toSectionId;
  save();
  logAudit(`Student ${studentId} moved from section ${fromSectionId} to ${toSectionId}`);
  toast('Student moved to new section', 'success');
  closeModal();
  renderAssignment();
}

function scopeDeptIds() {
  return currentUser.role === 'Dean'
    ? DB.departments.filter(d => d.collegeId === currentUser.collegeId).map(d => d.id)
    : [currentUser.deptId];
}

function showCreateSectionModal() {
  const dids  = scopeDeptIds();
  const subjs = DB.subjects.filter(s => dids.includes(s.deptId));
  const facs  = DB.users.filter(u => u.role === 'Faculty' && dids.includes(u.deptId) && u.active);

  showModal('Create Section / Assign Faculty', `
    <div class="field-wrap">
      <div class="field-label">Subject</div>
      <select id="cs-s" class="select-input">
        ${subjs.map(s => `<option value="${s.id}">${esc(s.code)} — ${esc(s.name)} (${s.units} units)</option>`).join('')}
      </select>
    </div>
    <div class="field-wrap">
      <div class="field-label">Assign to Faculty</div>
      <select id="cs-f" class="select-input">
        ${facs.map(f => `<option value="${f.id}">${esc(f.name)}</option>`).join('')}
      </select>
    </div>
    <div class="grid-2">
      <div class="field-wrap"><div class="field-label">Section Name</div><input id="cs-n" class="input" placeholder="e.g. BSIT-3A"></div>
      <div class="field-wrap"><div class="field-label">School Year</div><input id="cs-y" class="input" value="2024-2025"></div>
    </div>
    <div class="field-wrap">
      <div class="field-label">Semester</div>
      <select id="cs-sem" class="select-input"><option>1st</option><option>2nd</option><option>Summer</option></select>
    </div>`,
    `<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" onclick="createSection()">Create Section</button>`
  );
}

function createSection() {
  const subjId  = +document.getElementById('cs-s').value;
  const facId   = +document.getElementById('cs-f').value;
  const secName = document.getElementById('cs-n').value.trim();
  const sy      = document.getElementById('cs-y').value.trim();
  const sem     = document.getElementById('cs-sem').value;
  if (!secName || !sy) { toast('Section name and school year are required', 'error'); return; }
  DB.sections.push({ id: DB.nextId.section++, subjectId: subjId, facultyId: facId, sy, sem, sectionName: secName, submitted: false, submittedAt: null });
  save();
  logAudit(`Section created: ${secName} / ${getSubject(subjId)?.code}`);
  toast('Section created and faculty assigned', 'success');
  closeModal();
  renderAssignment();
}

function showReassignModal(sectionId) {
  const sec = getSection(sectionId);
  if (!sec) return;
  const dids = scopeDeptIds();
  const facs = DB.users.filter(u => u.role === 'Faculty' && dids.includes(u.deptId) && u.active);
  const subj = getSubject(sec.subjectId);

  showModal(`Reassign Faculty — ${subj ? esc(subj.code) : ''} ${esc(sec.sectionName)}`, `
    <div class="field-wrap">
      <div class="field-label">Assign to Faculty</div>
      <select id="ra-f" class="select-input">
        ${facs.map(f => `<option value="${f.id}"${f.id === sec.facultyId ? ' selected' : ''}>${esc(f.name)}</option>`).join('')}
      </select>
    </div>`,
    `<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" onclick="reassignFaculty(${sectionId})">Reassign</button>`
  );
}

function reassignFaculty(sectionId) {
  const sec = getSection(sectionId);
  if (!sec) return;
  sec.facultyId = +document.getElementById('ra-f').value;
  save();
  logAudit(`Faculty reassigned: section ${sec.sectionName}`);
  toast('Faculty reassigned successfully', 'success');
  closeModal();
  renderAssignment();
}

function showEnrollModal(sectionId) {
  const sec  = getSection(sectionId);
  const subj = getSubject(sec?.subjectId);
  if (!sec) return;

  const enrolled    = enrolledIn(sectionId);
  const enrolledIds = enrolled.map(s => s.id);
  const dids        = scopeDeptIds();
  const available   = DB.students.filter(s => stuEnrolled(s) && dids.includes(s.deptId) && !enrolledIds.includes(s.id));

  showModal(`Students — ${subj ? esc(subj.code) : ''} ${esc(sec.sectionName)}`, `
    <div class="mb-16">
      <div class="card-title mb-8">Currently Enrolled (${enrolled.length})</div>
      ${enrolled.length === 0
        ? '<div class="text-muted text-sm">No students enrolled yet.</div>'
        : enrolled.map(s => `<div class="flex-between mb-8">
            <div class="flex gap-8">
              <div class="avatar avatar-sm">${initials(s.name)}</div>
              <span class="text-sm fw-6">${esc(s.name)}</span>
            </div>
            <button class="btn btn-sm btn-danger" onclick="unenrollStudent('${s.id}',${sectionId})">Remove</button>
          </div>`).join('')}
    </div>
    <div style="height:1px;background:var(--border);margin:12px 0"></div>
    <div>
      <div class="card-title mb-8">Add Student</div>
      ${available.length === 0
        ? '<div class="text-muted text-sm">All eligible students are already enrolled.</div>'
        : `<div class="flex gap-8">
            <select id="enr-s" class="select-input" style="flex:1">
              ${available.map(s => `<option value="${s.id}">${s.id} — ${esc(s.name)}</option>`).join('')}
            </select>
            <button class="btn btn-primary" onclick="enrollStudent(${sectionId})">+ Enroll</button>
          </div>`}
    </div>`,
    `<button class="btn btn-ghost" onclick="closeModal()">Close</button>`
  );
}

function enrollStudent(sectionId) {
  const sid = document.getElementById('enr-s').value;
  if (!sid) return;
  if (DB.enrollments.find(e => e.studentId === sid && e.sectionId === sectionId)) { toast('Already enrolled', 'error'); return; }
  DB.enrollments.push({ id: DB.nextId.enrollment++, studentId: sid, sectionId });
  save();
  logAudit(`Student enrolled: ${sid} → section ${sectionId}`);
  toast('Student enrolled', 'success');
  closeModal();
  showEnrollModal(sectionId);
}

function unenrollStudent(studentId, sectionId) {
  if (DB.grades.some(g => g.studentId === studentId && g.sectionId === sectionId)) {
    toast('Cannot remove — grade already exists for this student', 'error');
    return;
  }
  DB.enrollments = DB.enrollments.filter(e => !(e.studentId === studentId && e.sectionId === sectionId));
  save();
  logAudit(`Student unenrolled: ${studentId} from section ${sectionId}`);
  toast('Student removed from section', 'info');
  closeModal();
  showEnrollModal(sectionId);
}

function deleteSection(sectionId) {
  if (!confirm('Delete this section? This cannot be undone.')) return;
  DB.sections    = DB.sections.filter(s => s.id !== sectionId);
  DB.enrollments = DB.enrollments.filter(e => e.sectionId !== sectionId);
  save();
  logAudit(`Section deleted: ${sectionId}`);
  toast('Section deleted', 'info');
  renderAssignment();
}


/* ──────────────────────────────────────────────
   MY ADVISEES  (Faculty)
