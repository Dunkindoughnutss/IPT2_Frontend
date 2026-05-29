'use strict';

/* ══════════════════════════════════════════
   CHAIRMAN — Subject Assignment & Failing Students
══════════════════════════════════════════ */

registerPage('chair-assign',  renderChairAssign);
registerPage('chair-failing', renderChairFailing);

/* ══════════════════════════════════════════
   SUBJECT ASSIGNMENT
══════════════════════════════════════════ */
function renderChairAssign() {
  const deptId  = currentUser.deptId;
  const subjects = DB.subjects.filter(s => s.deptId === deptId);
  const faculty  = DB.users.filter(u => u.role === 'Faculty' && u.deptId === deptId && u.active);

  set(`
    <div class="page-header">
      <div class="page-title">Subject Assignment</div>
      <button class="btn btn-primary" onclick="showCreateSectionModal()">+ Create Section</button>
    </div>

    ${subjects.length === 0
      ? `<div class="empty"><div class="empty-icon">📚</div><div class="empty-text">No subjects in your department.<br>Contact the Registrar to add subjects.</div></div>`
      : `
        <div class="section-card">
          <div class="section-card-head"><div class="fw-7">Subjects & Faculty Assignments</div></div>
          <div class="table-wrap">
            <table>
              <thead><tr>
                <th>Code</th><th>Subject Name</th><th>Units</th><th>Year</th><th>Sem</th>
                <th>Assigned Faculty</th><th>Sections</th><th>Actions</th>
              </tr></thead>
              <tbody>
                ${subjects.map(subj => {
                  const secs     = DB.sections.filter(s => s.subjectId === subj.id);
                  const facIds   = [...new Set(secs.map(s => s.facultyId).filter(Boolean))];
                  const facNames = facIds.map(id => getUser(id)?.name || '—').join(', ');
                  return `<tr>
                    <td><span class="chip">${esc(subj.code)}</span></td>
                    <td class="fw-6">${esc(subj.name)}</td>
                    <td>${subj.units}</td>
                    <td>Year ${subj.year}</td>
                    <td>${esc(subj.sem)} Sem</td>
                    <td class="text-sm text-muted">${facNames || '<span class="text-muted">Unassigned</span>'}</td>
                    <td>
                      ${secs.map(sec =>
                        `<span class="badge badge-blue" style="margin:2px">${esc(sec.sectionName)}</span>`
                      ).join('') || '<span class="text-muted text-xs">None</span>'}
                    </td>
                    <td>
                      <button class="btn btn-sm btn-primary" onclick="showCreateSectionModal(${subj.id})">+ Section</button>
                    </td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- All sections table -->
        <div class="section-card">
          <div class="section-card-head">
            <div class="fw-7">All Sections</div>
            <div class="text-xs text-muted">Reassign faculty per section</div>
          </div>
          <div class="table-wrap">
            <table>
              <thead><tr>
                <th>Subject</th><th>Section</th><th>Faculty</th><th>School Year</th><th>Sem</th><th>Students</th><th>Status</th><th>Actions</th>
              </tr></thead>
              <tbody>
                ${DB.sections.filter(s => subjects.map(x=>x.id).includes(s.subjectId)).length === 0
                  ? `<tr><td colspan="8" class="table-empty">No sections yet.</td></tr>`
                  : DB.sections.filter(s => subjects.map(x=>x.id).includes(s.subjectId)).map(sec => {
                      const subj = getSubject(sec.subjectId);
                      const fac  = getUser(sec.facultyId);
                      const enr  = enrolledIn(sec.id).length;
                      return `<tr>
                        <td><span class="chip">${subj ? esc(subj.code) : '—'}</span></td>
                        <td class="fw-6">${esc(sec.sectionName)}</td>
                        <td class="text-sm">${fac ? esc(fac.name) : '<span class="text-muted">Unassigned</span>'}</td>
                        <td class="text-sm text-muted">${esc(sec.sy)}</td>
                        <td class="text-sm text-muted">${esc(sec.sem)} Sem</td>
                        <td class="fw-6" style="color:var(--blue)">${enr}</td>
                        <td><span class="badge badge-${sec.submitted ? 'success' : 'muted'}">${sec.submitted ? '✔ Submitted' : 'Open'}</span></td>
                        <td>
                          <button class="btn btn-sm btn-ghost" onclick="showReassignModal(${sec.id})">✎ Faculty</button>
                          <button class="btn btn-sm btn-ghost" onclick="showEnrollModal(${sec.id})">👥 Students</button>
                        </td>
                      </tr>`;
                    }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `}
  `);
}

/* ── Create Section Modal ────────────── */
function showCreateSectionModal(preselectedSubjId = null) {
  const deptId   = currentUser.deptId;
  const subjects = DB.subjects.filter(s => s.deptId === deptId);
  const faculty  = DB.users.filter(u => u.role === 'Faculty' && u.deptId === deptId && u.active);

  showModal('Create Section', `
    <div class="field-wrap">
      <label class="field-label">Subject</label>
      <select id="cs-subj" class="field-select">
        <option value="">— Select Subject —</option>
        ${subjects.map(s => `<option value="${s.id}" ${s.id === preselectedSubjId ? 'selected' : ''}>${esc(s.code)} — ${esc(s.name)}</option>`).join('')}
      </select>
    </div>
    <div class="field-wrap">
      <label class="field-label">Section Name</label>
      <input id="cs-name" class="field-input" placeholder="e.g. IT1A" />
    </div>
    <div class="grid-2">
      <div class="field-wrap">
        <label class="field-label">School Year</label>
        <input id="cs-sy" class="field-input" placeholder="e.g. 2024-2025" value="2024-2025" />
      </div>
      <div class="field-wrap">
        <label class="field-label">Semester</label>
        <select id="cs-sem" class="field-select">
          <option value="1st">1st</option>
          <option value="2nd">2nd</option>
          <option value="Summer">Summer</option>
        </select>
      </div>
    </div>
    <div class="field-wrap">
      <label class="field-label">Assign Faculty</label>
      <select id="cs-fac" class="field-select">
        <option value="">— Unassigned —</option>
        ${faculty.map(f => `<option value="${f.id}">${esc(f.name)}</option>`).join('')}
      </select>
    </div>
    <button class="btn btn-primary btn-full" onclick="doCreateSection()">Create Section</button>
  `);
}

function doCreateSection() {
  const subjId = parseInt(document.getElementById('cs-subj').value);
  const name   = document.getElementById('cs-name').value.trim();
  const sy     = document.getElementById('cs-sy').value.trim();
  const sem    = document.getElementById('cs-sem').value;
  const facId  = parseInt(document.getElementById('cs-fac').value) || null;

  if (!subjId || !name || !sy) { toast('Please fill in all required fields.', 'error'); return; }

  DB.sections.push({
    id:          DB.nextId.section++,
    subjectId:   subjId,
    facultyId:   facId,
    sectionName: name,
    sy,
    sem,
    submitted:   false,
  });
  save();
  toast('Section created.', 'success');
  closeModal();
  renderChairAssign();
}

/* ── Reassign Faculty Modal ──────────── */
function showReassignModal(secId) {
  const sec     = getSection(secId);
  const deptId  = currentUser.deptId;
  const faculty = DB.users.filter(u => u.role === 'Faculty' && u.deptId === deptId && u.active);

  showModal('Reassign Faculty', `
    <div class="field-wrap">
      <label class="field-label">Faculty</label>
      <select id="ra-fac" class="field-select">
        <option value="">— Unassigned —</option>
        ${faculty.map(f => `<option value="${f.id}" ${sec.facultyId === f.id ? 'selected' : ''}>${esc(f.name)}</option>`).join('')}
      </select>
    </div>
    <button class="btn btn-primary btn-full" onclick="doReassign(${secId})">Save</button>
  `);
}

function doReassign(secId) {
  const sec   = getSection(secId);
  const facId = parseInt(document.getElementById('ra-fac').value) || null;
  sec.facultyId = facId;
  save();
  toast('Faculty reassigned.', 'success');
  closeModal();
  renderChairAssign();
}

/* ── Enroll Students Modal ───────────── */
function showEnrollModal(secId) {
  const sec      = getSection(secId);
  const subj     = getSubject(sec?.subjectId);
  const enrolled = enrolledIn(secId).map(s => s.id);
  // Show students in the same department
  const allStus  = DB.students.filter(s => s.deptId === currentUser.deptId);

  showModal(`Students — ${sec ? esc(sec.sectionName) : ''}`, `
    <div class="text-sm text-muted mb-12">${subj ? esc(subj.name) : '—'} · ${sec ? esc(sec.sy) : ''} ${sec ? esc(sec.sem) : ''} Sem</div>
    ${allStus.length === 0
      ? `<div class="text-muted text-sm">No students in your department.</div>`
      : `<div class="table-wrap"><table>
          <thead><tr><th>Student ID</th><th>Name</th><th>Year</th><th>Enrolled</th></tr></thead>
          <tbody>
            ${allStus.map(stu => {
              const isEnrolled = enrolled.includes(stu.id);
              return `<tr>
                <td class="mono text-sm">${esc(stu.id)}</td>
                <td>${esc(stu.name)}</td>
                <td>Year ${stu.year}</td>
                <td>
                  <input type="checkbox" ${isEnrolled ? 'checked' : ''} onchange="toggleEnroll('${stu.id}',${secId},this.checked)" />
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table></div>`}
  `);
}

function toggleEnroll(studentId, sectionId, enroll) {
  if (enroll) {
    const exists = DB.enrollments.find(e => e.studentId === studentId && e.sectionId === sectionId);
    if (!exists) {
      DB.enrollments.push({ id: DB.nextId.enrollment++, studentId, sectionId });
    }
  } else {
    DB.enrollments = DB.enrollments.filter(e => !(e.studentId === studentId && e.sectionId === sectionId));
    DB.grades      = DB.grades.filter(g => !(g.studentId === studentId && g.sectionId === sectionId));
  }
  save();
}

/* ══════════════════════════════════════════
   FAILING STUDENTS (Chairman scope)
══════════════════════════════════════════ */
function renderChairFailing() {
  const deptId  = currentUser.deptId;
  const dept    = getDept(deptId);
  const secIds  = secIdsForDept(deptId).filter(sid => getSection(sid)?.submitted);
  const failing = getFailingStudents(secIds);

  // Group by year
  const byYear = {};
  failing.forEach(f => {
    const yr = f.student.year || 0;
    if (!byYear[yr]) byYear[yr] = [];
    byYear[yr].push(f);
  });

  set(`
    <div class="page-header">
      <div>
        <div class="page-title">Failing Students</div>
        <div class="page-sub">${dept ? esc(dept.name) : '—'} · Based on submitted grades</div>
      </div>
    </div>

    ${failing.length === 0
      ? `<div class="empty"><div class="empty-icon">✅</div><div class="empty-text">No failing students in your department.</div></div>`
      : Object.keys(byYear).sort().map(yr => `
        <div class="year-block">
          <div class="year-block-title">Year ${yr} Students</div>
          <div class="section-card">
            <div class="table-wrap">
              <table>
                <thead><tr><th>Student ID</th><th>Name</th><th>Failed Subjects</th><th>Details</th></tr></thead>
                <tbody>
                  ${byYear[yr].map(f => {
                    // Get each failing subject name
                    const failGrades = DB.grades.filter(g =>
                      g.studentId === f.student.id &&
                      secIds.includes(g.sectionId) &&
                      g.grade !== 'INC' &&
                      g.grade > 3.0
                    );
                    const failSubjs = failGrades.map(g => {
                      const sec  = getSection(g.sectionId);
                      const subj = getSubject(sec?.subjectId);
                      return subj ? subj.code : '—';
                    }).join(', ');
                    return `<tr class="row-fail">
                      <td class="mono text-sm">${esc(f.student.id)}</td>
                      <td><div class="flex gap-8"><div class="avatar avatar-sm">${initials(f.student.name)}</div>${esc(f.student.name)}</div></td>
                      <td><span class="badge badge-danger">${f.failCount} subject${f.failCount > 1 ? 's' : ''}</span></td>
                      <td class="text-sm text-muted">${esc(failSubjs)}</td>
                    </tr>`;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `).join('')}
  `);
}
