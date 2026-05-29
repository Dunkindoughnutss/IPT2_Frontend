'use strict';

/* ══════════════════════════════════════════
   FACULTY — Encode & Submit Grades
══════════════════════════════════════════ */

registerPage('fac-encode', renderEncodeGrades);

let activeSection = null; // currently selected section ID

function renderEncodeGrades() {
  const mySecs = DB.sections.filter(s => s.facultyId === currentUser.id);

  set(`
    <div class="page-header">
      <div class="page-title">Encode Grades</div>
    </div>

    ${mySecs.length === 0
      ? `<div class="empty"><div class="empty-icon">📋</div><div class="empty-text">No sections assigned to you.<br>Contact your Chairman.</div></div>`
      : `
      <!-- Section selector -->
      <div class="section-card mb-20">
        <div class="section-card-head"><div class="fw-7">Select a Section</div></div>
        <div class="section-card-body">
          <div class="grid-3">
            ${mySecs.map(sec => {
              const subj    = getSubject(sec.subjectId);
              const enrolled = enrolledIn(sec.id).length;
              const graded  = DB.grades.filter(g => g.sectionId === sec.id).length;
              const isActive = activeSection === sec.id;
              return `
                <div onclick="selectSection(${sec.id})"
                  style="cursor:pointer;padding:16px;border-radius:10px;border:2px solid ${isActive ? 'var(--blue)' : 'var(--border)'};background:${isActive ? '#eff6ff' : 'var(--white)'};transition:all .15s">
                  <div class="flex-between mb-8">
                    <span class="chip">${subj ? esc(subj.code) : '—'}</span>
                    <span class="badge badge-${sec.submitted ? 'success' : 'warning'}">${sec.submitted ? '✔ Done' : 'Pending'}</span>
                  </div>
                  <div class="fw-7 text-sm mb-4">${subj ? esc(subj.name) : '—'}</div>
                  <div class="text-xs text-muted">${esc(sec.sectionName)} · ${esc(sec.sem)} Sem · ${esc(sec.sy)}</div>
                  <div class="text-xs mt-6" style="color:var(--blue)">${graded}/${enrolled} graded</div>
                </div>`;
            }).join('')}
          </div>
        </div>
      </div>

      <!-- Grade table for selected section -->
      <div id="grade-table-area"></div>
      `}
  `);

  // Auto-select if only one section
  if (mySecs.length === 1 && activeSection === null) {
    activeSection = mySecs[0].id;
  }

  if (activeSection) renderGradeTable();
}

function selectSection(secId) {
  activeSection = secId;
  renderEncodeGrades();
}

function renderGradeTable() {
  const sec  = getSection(activeSection);
  if (!sec) return;
  const subj = getSubject(sec.subjectId);
  const stus = enrolledIn(activeSection);

  const areaEl = document.getElementById('grade-table-area');
  if (!areaEl) return;

  const VALID_GRADES = ['1.0','1.25','1.5','1.75','2.0','2.25','2.5','2.75','3.0','5.0','INC'];

  areaEl.innerHTML = `
    <div class="section-card">
      <div class="section-card-head">
        <div>
          <div class="fw-7">${subj ? esc(subj.name) : '—'} — ${esc(sec.sectionName)}</div>
          <div class="text-xs text-muted mt-2">${esc(sec.sem)} Semester · ${esc(sec.sy)}</div>
        </div>
        ${!sec.submitted
          ? `<button class="btn btn-success btn-sm" onclick="submitGrades(${sec.id})">🔒 Submit All Grades</button>`
          : `<span class="badge badge-success">🔒 Submitted — Read Only</span>`}
      </div>
      <div class="section-card-body">
        ${stus.length === 0
          ? `<div class="text-muted text-sm">No students enrolled in this section.</div>`
          : `
            ${!sec.submitted ? `<div class="alert alert-info mb-16">Select a grade for each student, then click <strong>Submit All Grades</strong>.</div>` : ''}
            <div class="table-wrap">
              <table>
                <thead><tr><th>Student ID</th><th>Name</th><th>Year</th><th>Grade</th><th>Description</th></tr></thead>
                <tbody>
                  ${stus.map(stu => {
                    const g = gradeFor(stu.id, activeSection);
                    return `<tr class="${g && !isPassing(g.grade) ? 'row-fail' : ''}">
                      <td class="mono text-sm text-muted">${esc(stu.id)}</td>
                      <td><div class="flex gap-8"><div class="avatar avatar-sm">${initials(stu.name)}</div>${esc(stu.name)}</div></td>
                      <td>Year ${stu.year}</td>
                      <td>
                        ${sec.submitted
                          ? `<span class="${g ? gradeClass(g.grade) : 'text-muted'}">${g ? fmt2(g.grade) : '—'}</span>`
                          : `<select class="field-select" style="width:90px" id="grade-${stu.id}" onchange="saveGradeDraft('${stu.id}',${activeSection},this.value)">
                              <option value="">—</option>
                              ${VALID_GRADES.map(v =>
                                `<option value="${v}" ${g && String(g.grade) === v ? 'selected' : ''}>${v}</option>`
                              ).join('')}
                             </select>`}
                      </td>
                      <td class="text-sm text-muted">${g ? gradeDesc(g.grade) : '—'}</td>
                    </tr>`;
                  }).join('')}
                </tbody>
              </table>
            </div>`}
      </div>
    </div>`;
}

/* ── Save one grade (draft) ──────────── */
function saveGradeDraft(studentId, sectionId, value) {
  if (!value) {
    // Remove grade if cleared
    DB.grades = DB.grades.filter(g => !(g.studentId === studentId && g.sectionId === sectionId));
    save();
    return;
  }

  const grade  = value === 'INC' ? 'INC' : parseFloat(value);
  const exists = DB.grades.find(g => g.studentId === studentId && g.sectionId === sectionId);

  if (exists) {
    exists.grade = grade;
  } else {
    DB.grades.push({ id: DB.nextId.grade++, studentId, sectionId, grade });
  }
  save();
}

/* ── Submit (lock) all grades in a section ── */
function submitGrades(sectionId) {
  const sec  = getSection(sectionId);
  if (!sec) return;
  const stus = enrolledIn(sectionId);

  // Check all students have a grade
  const ungraded = stus.filter(s => !gradeFor(s.id, sectionId));
  if (ungraded.length > 0) {
    toast(`${ungraded.length} student(s) still have no grade. Please fill all grades first.`, 'error');
    return;
  }

  if (!confirm('Are you sure you want to submit and lock all grades for this section? This cannot be undone.')) return;

  sec.submitted = true;
  save();
  toast('Grades submitted and locked successfully.', 'success');
  renderEncodeGrades();
}
