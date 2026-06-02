'use strict';

/* ══════════════════════════════════════════
   API EXTENSION (Self-Contained)
══════════════════════════════════════════ */
api.createSubject = (data) => apiFetch('subjects/create.php', { method: 'POST', body: JSON.stringify(data) });

/* ══════════════════════════════════════════
   CHAIRMAN — Subject Assignment & Failing (API)
══════════════════════════════════════════ */

registerPage('chair-assign',  renderChairAssign);
registerPage('chair-failing', renderChairFailing);

/* ══════════════════════════════════════════
   SUBJECT ASSIGNMENT & CURRICULUM MANAGEMENT
══════════════════════════════════════════ */
async function renderChairAssign() {
  set(`<div class="empty"><div class="empty-icon">⏳</div><div class="empty-text">Loading…</div></div>`);
  try {
    // Load subjects, sections, students, faculty all at once
    const [subjects, sections, students, users] = await Promise.all([
      api.getSubjects(),
      api.getSections(),
      api.getStudents(),
      api.getUsers(),
    ]);

    // SOLUTION B: Include ALL active faculty university-wide for minor subjects
    const faculty = users.filter(u => u.role === 'Faculty' && u.active);

    // Map sections onto subjects
    const subjectRows = subjects.map(subj => {
      const subSecs = sections.filter(s => s.subject_id === subj.id);
      return { ...subj, sections: subSecs };
    });

    // Store references for modal utilization
    window._chairSubjects = subjects;
    window._chairSections = sections;
    window._chairFaculty  = faculty;
    window._chairStudents = students;
    window._chairUsers    = users;

    set(`
      <div class="page-header">
        <div class="page-title">Subject Assignment</div>
        <div class="flex gap-8">
          <button class="btn btn-secondary" onclick="showCreateSubjectModal()">+ Create Subject</button>
          <button class="btn btn-primary" onclick="showCreateSectionModal()">+ Create Section</button>
        </div>
      </div>

      <!-- Subjects table -->
      <div class="section-card mb-20">
        <div class="section-card-head">
          <div class="fw-7">Subjects in Your Department</div>
          <div class="text-xs text-muted">${subjects.length} subject${subjects.length !== 1 ? 's' : ''}</div>
        </div>
        ${subjects.length === 0
          ? `<div class="section-card-body"><div class="empty" style="padding:24px">
              <div class="empty-icon">📚</div>
              <div class="empty-text">No subjects found for your department.<br>Click "+ Create Subject" to add one.</div>
             </div></div>`
          : `<div class="table-wrap"><table>
              <thead><tr>
                <th>Code</th><th>Subject Name</th><th>Units</th><th>Year</th><th>Sem</th><th>Sections</th><th>Faculty</th><th></th>
              </tr></thead>
              <tbody>
                ${subjectRows.map(subj => {
                  const facIds   = [...new Set(subj.sections.map(s => s.faculty_id).filter(Boolean))];
                  const facNames = facIds.map(id => users.find(u => u.id === id)?.name || '—').join(', ');
                  return `<tr>
                    <td><span class="chip">${esc(subj.code)}</span></td>
                    <td class="fw-6">${esc(subj.name)}</td>
                    <td>${subj.units}</td>
                    <td>Year ${subj.year}</td>
                    <td>${esc(subj.sem)} Sem</td>
                    <td>
                      ${subj.sections.length === 0
                        ? `<span class="text-muted text-xs">No sections</span>`
                        : subj.sections.map(s =>
                            `<span class="badge badge-blue" style="margin:2px">${esc(s.section_name)}</span>`
                          ).join('')}
                    </td>
                    <td class="text-sm text-muted">${facNames || '<span class="text-muted text-xs">Unassigned</span>'}</td>
                    <td>
                      <button class="btn btn-sm btn-primary" onclick="showCreateSectionModal(${subj.id})">+ Section</button>
                    </td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table></div>`}
      </div>

      <!-- All sections table -->
      <div class="section-card">
        <div class="section-card-head">
          <div class="fw-7">All Sections</div>
          <div class="text-xs text-muted">Manage faculty and student enrollment</div>
        </div>
        ${sections.length === 0
          ? `<div class="section-card-body"><div class="text-muted text-sm">No sections created yet. Click "+ Create Section" above to get started.</div></div>`
          : `<div class="table-wrap"><table>
              <thead><tr>
                <th>Subject</th><th>Section</th><th>Faculty</th><th>SY</th><th>Sem</th><th>Status</th><th>Actions</th>
              </tr></thead>
              <tbody>
                ${sections.map(sec => `<tr>
                  <td><span class="chip">${esc(sec.subject_code)}</span> <span class="text-sm">${esc(sec.subject_name)}</span></td>
                  <td class="fw-6">${esc(sec.section_name)}</td>
                  <td class="text-sm">${sec.faculty_name || '<span class="text-muted">Unassigned</span>'}</td>
                  <td class="text-sm text-muted">${esc(sec.sy)}</td>
                  <td class="text-sm text-muted">${esc(sec.sem)} Sem</td>
                  <td><span class="badge badge-${sec.submitted ? 'success' : 'muted'}">${sec.submitted ? '✔ Submitted' : 'Open'}</span></td>
                  <td class="flex gap-8">
                    <button class="btn btn-sm btn-ghost" onclick="showReassignModal(${sec.id},'${esc(sec.section_name)}',${sec.faculty_id || 'null'})">✎ Faculty</button>
                    <button class="btn btn-sm btn-ghost" onclick="showEnrollModal(${sec.id},'${esc(sec.section_name)}')">👥 Students</button>
                  </td>
                </tr>`).join('')}
              </tbody>
            </table></div>`}
      </div>
    `);
  } catch (err) { apiErr(err); }
}

/* ── Create Subject Modal ────────────────────── */
function showCreateSubjectModal() {
  const deptLabel = currentUser.dept_name || `Department ID: ${currentUser.dept_id}`;

  showModal('Create New Subject', `
    <div class="field-wrap">
      <label class="field-label">Subject Code</label>
      <input id="sub-code" class="field-input" placeholder="e.g. IT-311" style="text-transform: uppercase;" />
    </div>
    <div class="field-wrap">
      <label class="field-label">Subject Name</label>
      <input id="sub-name" class="field-input" placeholder="e.g. Advanced Database Systems" />
    </div>
    <div class="grid-2">
      <div class="field-wrap">
        <label class="field-label">Units</label>
        <input id="sub-units" type="number" class="field-input" min="1" max="5" value="3" />
      </div>
      <div class="field-wrap">
        <label class="field-label">Department</label>
        <input class="field-input" value="${esc(deptLabel)}" disabled style="background: var(--bg-muted); cursor: not-allowed;" />
      </div>
    </div>
    <div class="grid-2">
      <div class="field-wrap">
        <label class="field-label">Curriculum Year</label>
        <select id="sub-year" class="field-select">
          <option value="1">Year 1</option>
          <option value="2">Year 2</option>
          <option value="3">Year 3</option>
          <option value="4">Year 4</option>
        </select>
      </div>
      <div class="field-wrap">
        <label class="field-label">Default Sem</label>
        <select id="sub-sem" class="field-select">
          <option value="1st">1st</option>
          <option value="2nd">2nd</option>
          <option value="Summer">Summer</option>
        </select>
      </div>
    </div>
    <button class="btn btn-primary btn-full mt-12" onclick="doCreateSubject()">Create Subject</button>
  `);
}

/* ── Create Subject Submission Handler ────────── */
async function doCreateSubject() {
  const code  = document.getElementById('sub-code').value.trim().toUpperCase();
  const name  = document.getElementById('sub-name').value.trim();
  const units = parseInt(document.getElementById('sub-units').value);
  const year  = parseInt(document.getElementById('sub-year').value);
  const sem   = document.getElementById('sub-sem').value;

  if (!code || !name || !units) {
    toast('Please fill out all fields.', 'error'); return;
  }

  try {
    await api.createSubject({ code, name, units, dept_id: currentUser.dept_id, year, sem });
    toast('Subject added to curriculum.', 'success');
    closeModal();
    renderChairAssign();
  } catch (err) { apiErr(err); }
}

/* ── Create Section Modal ────────────────────── */
function showCreateSectionModal(preSubjId = null) {
  const subjects = window._chairSubjects || [];
  const faculty  = window._chairFaculty  || [];

  showModal('Create Section', `
    <div class="field-wrap">
      <label class="field-label">Subject</label>
      <select id="cs-subj" class="field-select">
        <option value="">— Select Subject —</option>
        ${subjects.map(s =>
          `<option value="${s.id}" ${s.id === preSubjId ? 'selected' : ''}>${esc(s.code)} — ${esc(s.name)}</option>`
        ).join('')}
      </select>
    </div>
    <div class="field-wrap">
      <label class="field-label">Section Name</label>
      <input id="cs-name" class="field-input" placeholder="e.g. IT1A" />
    </div>
    <div class="grid-2">
      <div class="field-wrap">
        <label class="field-label">School Year</label>
        <input id="cs-sy" class="field-input" value="2024-2025" />
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
      <label class="field-label">Assign Faculty <span class="text-muted">(optional)</span></label>
      <select id="cs-fac" class="field-select">
        <option value="">— Unassigned —</option>
        ${faculty.map(f => `<option value="${f.id}">${esc(f.name)} ${f.dept_id !== currentUser.dept_id ? '(Minor / External)' : ''}</option>`).join('')}
      </select>
    </div>
    <button class="btn btn-primary btn-full" onclick="doCreateSection()">Create Section</button>
  `);
}

async function doCreateSection() {
  const subjId = parseInt(document.getElementById('cs-subj').value);
  const name   = document.getElementById('cs-name').value.trim();
  const sy     = document.getElementById('cs-sy').value.trim();
  const sem    = document.getElementById('cs-sem').value;
  const facId  = parseInt(document.getElementById('cs-fac').value) || null;

  if (!subjId || !name || !sy) {
    toast('Please fill in all required fields.', 'error'); return;
  }
  try {
    await api.createSection({ subject_id: subjId, faculty_id: facId, section_name: name, sy, sem });
    toast('Section created.', 'success');
    closeModal();
    renderChairAssign();
  } catch (err) { apiErr(err); }
}

/* ── Reassign Faculty Modal ──────────────────── */
function showReassignModal(secId, secName, currentFacId) {
  const faculty = window._chairFaculty || [];
  showModal(`Reassign Faculty — ${secName}`, `
    <div class="field-wrap">
      <label class="field-label">Faculty</label>
      <select id="ra-fac" class="field-select">
        <option value="">— Unassigned —</option>
        ${faculty.map(f =>
          `<option value="${f.id}" ${currentFacId === f.id ? 'selected' : ''}>${esc(f.name)} ${f.dept_id !== currentUser.dept_id ? '(Minor / External)' : ''}</option>`
        ).join('')}
      </select>
    </div>
    <button class="btn btn-primary btn-full" onclick="doReassign(${secId})">Save</button>
  `);
}

async function doReassign(secId) {
  const facId = parseInt(document.getElementById('ra-fac').value) || null;
  try {
    await api.assignFaculty({ section_id: secId, faculty_id: facId });
    toast('Faculty reassigned.', 'success');
    closeModal();
    renderChairAssign();
  } catch (err) { apiErr(err); }
}

/* ── Enroll Students Modal ───────────────────── */
async function showEnrollModal(secId, secName) {
  showModal(`Students — ${secName}`, `<div class="text-muted text-sm" style="padding:12px">Loading…</div>`);
  try {
    const [enrolled, allStudents] = await Promise.all([
      api.getEnrollments({ section_id: secId }),
      api.getStudents(),
    ]);
    const enrolledIds = enrolled.map(e => e.student_id);

    // Apply strict enrollment display parameters (department boundary & active indicators)
    const deptStudents = allStudents
      .filter(s => s.dept_id === currentUser.dept_id && s.active)
      .sort((a, b) => (a.year_level || 0) - (b.year_level || 0));

    document.getElementById('modal-body').innerHTML = deptStudents.length === 0
      ? `<div class="text-muted text-sm" style="padding:12px">No active students found in your department roster.</div>`
      : `<div class="alert alert-info mb-12" style="font-size:12px; padding:8px 12px">
          Showing active department students. Changes save instantly.
         </div>
         <div class="table-wrap" style="max-height: 400px; overflow-y: auto;">
          <table>
            <thead><tr><th>ID</th><th>Name</th><th>Year</th><th>Enrolled</th></tr></thead>
            <tbody>
              ${deptStudents.map(s => `<tr>
                <td class="mono text-sm">${esc(s.id)}</td>
                <td>
                  <button type="button" style="background:none;border:none;color:var(--blue);text-decoration:underline;padding:0;cursor:pointer" data-student-id="${esc(s.id)}" data-student-name="${esc(s.name)}" onclick="openStudentGrades(this)">
                    ${esc(s.name)}
                  </button>
                </td>
                <td><span class="badge badge-muted">Year ${s.year_level}</span></td>
                <td>
                  <input type="checkbox"
                    ${enrolledIds.includes(s.id) ? 'checked' : ''}
                    onchange="toggleEnroll('${s.id}', ${secId}, this)" />
                </td>
              </tr>`).join('')}
            </tbody>
          </table>
         </div>`;
  } catch (err) { apiErr(err); }
}

async function toggleEnroll(studentId, sectionId, checkboxElement) {
  const originalState = checkboxElement.checked;
  try {
    await api.toggleEnrollment({ student_id: studentId, section_id: sectionId, enroll: originalState });
  } catch (err) {
    apiErr(err);
    // UI state auto-rollback on constraint execution failures
    checkboxElement.checked = !originalState;
  }
}

/* ══════════════════════════════════════════
   FAILING STUDENTS
══════════════════════════════════════════ */
async function renderChairFailing() {
  set(`<div class="empty"><div class="empty-icon">⏳</div><div class="empty-text">Loading…</div></div>`);
  try {
    const sections = await api.getSections({ submitted: 1 });

    if (sections.length === 0) {
      set(`<div class="page-header"><div class="page-title">Failing Students</div></div>
           <div class="empty"><div class="empty-icon">✅</div><div class="empty-text">No submitted grades yet in your department.</div></div>`);
      return;
    }

    const gradePromises = sections.map(s => api.getGrades({ section_id: s.id }));
    const gradeArrays   = await Promise.all(gradePromises);
    const allGrades     = gradeArrays.flat();

    const failMap = {};
    allGrades
      .filter(g => g.grade !== 'INC' && parseFloat(g.grade) > 3)
      .forEach(g => {
        if (!failMap[g.student_id]) {
          failMap[g.student_id] = {
            name:     g.student_name,
            year:     g.year_level,
            subjects: [],
          };
        }
        failMap[g.student_id].subjects.push(g.subject_code || g.subject_name);
      });

    const failing = Object.entries(failMap).map(([id, v]) => ({ id, ...v }));

    const byYear = {};
    failing.forEach(f => {
      const yr = f.year || '—';
      if (!byYear[yr]) byYear[yr] = [];
      byYear[yr].push(f);
    });

    set(`
      <div class="page-header">
        <div>
          <div class="page-title">Failing Students</div>
          <div class="page-sub">Based on submitted grades in your department</div>
        </div>
      </div>

      ${failing.length === 0
        ? `<div class="empty"><div class="empty-icon">✅</div><div class="empty-text">No failing students in your department.</div></div>`
        : Object.keys(byYear).sort().map(yr => `
            <div class="year-block">
              <div class="year-block-title">Year ${yr}</div>
              <div class="section-card">
                <div class="table-wrap"><table>
                  <thead><tr><th>Student ID</th><th>Name</th><th>Failed Subjects</th><th>Subjects</th></tr></thead>
                  <tbody>
                    ${byYear[yr].map(f => `<tr class="row-fail">
                      <td class="mono text-sm">${esc(f.id)}</td>
                      <td>
                        <div class="flex gap-8">
                          <div class="avatar avatar-sm">${initials(f.name)}</div>
                          <button type="button" style="background:none;border:none;color:var(--blue);text-decoration:underline;padding:0;cursor:pointer" data-student-id="${esc(f.id)}" data-student-name="${esc(f.name)}" onclick="openStudentGrades(this)">${esc(f.name)}</button>
                        </div>
                      </td>
                      <td><span class="badge badge-danger">${f.subjects.length} subject${f.subjects.length > 1 ? 's' : ''}</span></td>
                      <td class="text-sm text-muted">${esc(f.subjects.join(', '))}</td>
                    </tr>`).join('')}
                  </tbody>
                </table></div>
              </div>
            </div>
          `).join('')}
    `);
  } catch (err) { apiErr(err); }
}