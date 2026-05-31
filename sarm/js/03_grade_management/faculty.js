'use strict';

/* ══════════════════════════════════════════
   FACULTY — Encode & Submit Grades (API)
══════════════════════════════════════════ */

registerPage('fac-encode', renderEncodeGrades);

let _sections   = [];
let _activeSecId = null;

async function renderEncodeGrades() {
  set(`<div class="empty"><div class="empty-icon">⏳</div><div class="empty-text">Loading sections…</div></div>`);
  try {
    _sections = await api.getSections();
    _activeSecId = _sections.length === 1 ? _sections[0].id : (_activeSecId || null);
    _drawEncodeShell();
    if (_activeSecId) await _drawGradeTable();
  } catch (err) { apiErr(err); }
}

function _drawEncodeShell() {
  const mySecs = _sections;
  document.getElementById('page-content').innerHTML = `
    <div class="page-header"><div class="page-title">Encode Grades</div></div>
    ${mySecs.length === 0
      ? `<div class="empty"><div class="empty-icon">📋</div><div class="empty-text">No sections assigned to you.<br>Contact your Chairman.</div></div>`
      : `<div class="section-card mb-20">
          <div class="section-card-head"><div class="fw-7">Select a Section</div></div>
          <div class="section-card-body">
            <div class="grid-3">
              ${mySecs.map(sec => {
                const isActive = _activeSecId === sec.id;
                return `<div onclick="selectSection(${sec.id})"
                  style="cursor:pointer;padding:16px;border-radius:10px;
                         border:2px solid ${isActive ? 'var(--blue)' : 'var(--border)'};
                         background:${isActive ? '#eff6ff' : 'var(--white)'};transition:all .15s">
                  <div class="flex-between mb-8">
                    <span class="chip">${esc(sec.subject_code)}</span>
                    <span class="badge badge-${sec.submitted ? 'success' : 'warning'}">${sec.submitted ? '✔ Done' : 'Pending'}</span>
                  </div>
                  <div class="fw-7 text-sm mb-4">${esc(sec.subject_name)}</div>
                  <div class="text-xs text-muted">${esc(sec.section_name)} · ${esc(sec.sem)} Sem · ${esc(sec.sy)}</div>
                </div>`;
              }).join('')}
            </div>
          </div>
        </div>
        <div id="grade-table-area"></div>`}`;
}

async function selectSection(secId) {
  _activeSecId = secId;
  _drawEncodeShell();
  await _drawGradeTable();
}

async function _drawGradeTable() {
  const area = document.getElementById('grade-table-area');
  if (!area) return;
  area.innerHTML = `<div class="empty"><div class="empty-icon">⏳</div><div class="empty-text">Loading grades…</div></div>`;

  const sec = _sections.find(s => s.id === _activeSecId);
  if (!sec) return;

  try {
    const [enrollments, grades] = await Promise.all([
      api.getEnrollments({ section_id: _activeSecId }),
      api.getGrades({ section_id: _activeSecId }),
    ]);

    const gradeMap = {};
    grades.forEach(g => { gradeMap[g.student_id] = g.grade; });

    const VALID = ['1.0','1.25','1.5','1.75','2.0','2.25','2.5','2.75','3.0','5.0','INC'];

    area.innerHTML = `
      <div class="section-card">
        <div class="section-card-head">
          <div>
            <div class="fw-7">${esc(sec.subject_name)} — ${esc(sec.section_name)}</div>
            <div class="text-xs text-muted mt-2">${esc(sec.sem)} Semester · ${esc(sec.sy)}</div>
          </div>
          ${!sec.submitted
            ? `<button class="btn btn-success btn-sm" onclick="submitSection(${sec.id})">🔒 Submit All Grades</button>`
            : `<span class="badge badge-success">🔒 Submitted — Read Only</span>`}
        </div>
        <div class="section-card-body">
          ${enrollments.length === 0
            ? `<div class="text-muted text-sm">No students enrolled.</div>`
            : `${!sec.submitted ? `<div class="alert alert-info mb-16">Select a grade for each student then click <strong>Submit All Grades</strong>.</div>` : ''}
               <div class="table-wrap"><table>
                 <thead><tr><th>Student ID</th><th>Name</th><th>Year</th><th>Grade</th><th>Description</th></tr></thead>
                 <tbody>
                   ${enrollments.map(e => {
                     const g     = gradeMap[e.student_id];
                     const gNum  = g && g !== 'INC' ? parseFloat(g) : null;
                     const failing = gNum !== null && gNum > 3;
                     return `<tr class="${failing ? 'row-fail' : ''}">
                       <td class="mono text-sm text-muted">${esc(e.student_id)}</td>
                       <td><div class="flex gap-8"><div class="avatar avatar-sm">${initials(e.student_name)}</div>${esc(e.student_name)}</div></td>
                       <td>Year ${e.year_level}</td>
                       <td>${sec.submitted
                         ? `<span class="${g ? gradeClass(g === 'INC' ? 'INC' : parseFloat(g)) : 'text-muted'}">${g || '—'}</span>`
                         : `<select class="field-select" style="width:90px"
                               onchange="saveDraftGrade('${e.student_id}',${_activeSecId},this.value)">
                             <option value="">—</option>
                             ${VALID.map(v => `<option value="${v}" ${g === v ? 'selected' : ''}>${v}</option>`).join('')}
                           </select>`}
                       </td>
                       <td class="text-sm text-muted">${g ? gradeDesc(g === 'INC' ? 'INC' : parseFloat(g)) : '—'}</td>
                     </tr>`;
                   }).join('')}
                 </tbody>
               </table></div>`}
        </div>
      </div>`;
  } catch (err) { apiErr(err); }
}

/* ── Save one draft grade ────────────── */
async function saveDraftGrade(studentId, sectionId, value) {
  try {
    await api.saveGrade({ student_id: studentId, section_id: sectionId, grade: value });
  } catch (err) {
    apiErr(err);
    // Re-render to restore correct state
    await _drawGradeTable();
  }
}

/* ── Submit (lock) section ───────────── */
async function submitSection(sectionId) {
  if (!confirm('Submit and lock all grades for this section? This cannot be undone.')) return;
  try {
    await api.submitGrades({ section_id: sectionId });
    toast('Grades submitted and locked.', 'success');
    _sections = await api.getSections();
    _drawEncodeShell();
    await _drawGradeTable();
  } catch (err) { apiErr(err); }
}