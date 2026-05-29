'use strict';

/* ══════════════════════════════════════════
   STUDENT — My Grades
══════════════════════════════════════════ */

registerPage('stu-grades', renderStudentGrades);

function renderStudentGrades() {
  const sid     = currentUser.studentId;
  const student = getStudent(sid);

  if (!student) {
    set(`<div class="empty"><div class="empty-icon">❌</div><div class="empty-text">No student record linked to your account.<br>Contact the Registrar.</div></div>`);
    return;
  }

  // All submitted sections the student is enrolled in
  const myEnrollSectionIds = DB.enrollments
    .filter(e => e.studentId === sid)
    .map(e => e.sectionId)
    .filter(sId => getSection(sId)?.submitted);

  // Group by School Year + Semester
  const semGroups = {};
  myEnrollSectionIds.forEach(sId => {
    const sec = getSection(sId);
    const key = `${sec.sy}||${sec.sem}`;
    if (!semGroups[key]) semGroups[key] = { sy: sec.sy, sem: sec.sem, sections: [] };
    semGroups[key].sections.push(sId);
  });

  // Sort: oldest first
  const sortedKeys = Object.keys(semGroups).sort((a, b) => {
    const [asy, asem] = a.split('||');
    const [bsy, bsem] = b.split('||');
    if (asy !== bsy) return asy.localeCompare(bsy);
    const semOrder = { '1st': 1, '2nd': 2, 'Summer': 3 };
    return (semOrder[asem] || 0) - (semOrder[bsem] || 0);
  });

  // Compute overall stats
  const myGrades = DB.grades.filter(g =>
    g.studentId === sid && myEnrollSectionIds.includes(g.sectionId)
  );
  const passed = myGrades.filter(g => g.grade !== 'INC' && g.grade <= 3).length;
  const failed = myGrades.filter(g => g.grade !== 'INC' && g.grade > 3).length;

  set(`
    <!-- Student banner -->
    <div class="card mb-20" style="background:linear-gradient(135deg,#eff6ff,#dbeafe);border-color:#bfdbfe">
      <div class="flex gap-16">
        <div class="avatar avatar-lg">${initials(student.name)}</div>
        <div>
          <div style="font-size:1.1rem;font-weight:800">${esc(student.name)}</div>
          <div class="text-muted text-sm">${esc(student.id)} · Year ${student.year}</div>
          <div class="flex gap-8 mt-6">
            <span class="badge badge-success">✅ ${passed} Passed</span>
            ${failed > 0 ? `<span class="badge badge-danger">❌ ${failed} Failed</span>` : ''}
          </div>
        </div>
      </div>
    </div>

    <!-- Grades by Semester -->
    ${sortedKeys.length === 0
      ? `<div class="empty"><div class="empty-icon">📋</div><div class="empty-text">No submitted grades available yet.<br>Grades will appear here once your faculty submits them.</div></div>`
      : sortedKeys.map(key => {
          const grp = semGroups[key];
          const rows = grp.sections.map(sId => {
            const sec  = getSection(sId);
            const subj = getSubject(sec?.subjectId);
            const fac  = getUser(sec?.facultyId);
            const g    = gradeFor(sid, sId);
            return { sec, subj, fac, g };
          });

          // Semester GPA (passing grades only)
          const semGrades = rows.map(r => r.g).filter(g => g && g.grade !== 'INC' && g.grade <= 3);
          const semGPA    = semGrades.length
            ? (semGrades.reduce((a, g) => a + g.grade, 0) / semGrades.length).toFixed(2)
            : null;

          return `
            <div class="section-card mb-20">
              <div class="section-card-head">
                <div>
                  <div class="fw-7">${esc(grp.sem)} Semester · ${esc(grp.sy)}</div>
                  ${semGPA ? `<div class="text-xs text-muted mt-2">Semester GPA (passing): ${semGPA}</div>` : ''}
                </div>
              </div>
              <div class="table-wrap">
                <table>
                  <thead><tr><th>Code</th><th>Subject</th><th>Units</th><th>Faculty</th><th>Section</th><th>Grade</th><th>Description</th></tr></thead>
                  <tbody>
                    ${rows.map(r => `
                      <tr class="${r.g && r.g.grade !== 'INC' && r.g.grade > 3 ? 'row-fail' : ''}">
                        <td><span class="chip">${r.subj ? esc(r.subj.code) : '—'}</span></td>
                        <td class="fw-6">${r.subj ? esc(r.subj.name) : '—'}</td>
                        <td>${r.subj ? r.subj.units : '—'}</td>
                        <td class="text-sm text-muted">${r.fac ? esc(r.fac.name) : '—'}</td>
                        <td class="text-sm text-muted">${esc(r.sec?.sectionName)}</td>
                        <td>
                          ${r.g
                            ? `<span class="${gradeClass(r.g.grade)}">${r.g.grade === 'INC' ? 'INC' : fmt2(r.g.grade)}</span>`
                            : '<span class="badge badge-muted">Pending</span>'}
                        </td>
                        <td class="text-sm text-muted">${r.g ? gradeDesc(r.g.grade) : '—'}</td>
                      </tr>`).join('')}
                  </tbody>
                </table>
              </div>
            </div>`;
        }).join('')}
  `);
}
