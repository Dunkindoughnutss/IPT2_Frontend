'use strict';

/* ══════════════════════════════════════════
   STUDENT — My Grades (API)
══════════════════════════════════════════ */

registerPage('stu-grades', renderStudentGrades);

async function renderStudentGrades() {
  set(`<div class="empty"><div class="empty-icon">⏳</div><div class="empty-text">Loading your grades…</div></div>`);
  try {
    const grades = await api.getGrades({ student_id: currentUser.student_id });

    if (!grades.length) {
      set(`<div class="empty"><div class="empty-icon">📋</div>
        <div class="empty-text">No submitted grades available yet.<br>Grades will appear here once your faculty submits them.</div>
      </div>`);
      return;
    }

    // Group by sy + sem
    const semMap = {};
    grades.forEach(g => {
      const key = `${g.sy}||${g.sem}`;
      if (!semMap[key]) semMap[key] = { sy: g.sy, sem: g.sem, rows: [] };
      semMap[key].rows.push(g);
    });

    const semOrder = { '1st':1, '2nd':2, 'Summer':3 };
    const sortedKeys = Object.keys(semMap).sort((a, b) => {
      const [asy, asem] = a.split('||'), [bsy, bsem] = b.split('||');
      return asy !== bsy ? asy.localeCompare(bsy) : (semOrder[asem]||0) - (semOrder[bsem]||0);
    });

    // Overall stats
    const passed = grades.filter(g => g.grade !== 'INC' && parseFloat(g.grade) <= 3).length;
    const failed = grades.filter(g => g.grade !== 'INC' && parseFloat(g.grade) > 3).length;

    set(`
      <!-- Student banner -->
      <div class="card mb-20" style="background:linear-gradient(135deg,#eff6ff,#dbeafe);border-color:#bfdbfe">
        <div class="flex gap-16">
          <div class="avatar avatar-lg">${initials(currentUser.name)}</div>
          <div>
            <div style="font-size:1.1rem;font-weight:800">${esc(currentUser.name)}</div>
            <div class="text-muted text-sm">${esc(currentUser.student_id)}</div>
            <div class="flex gap-8 mt-6">
              <span class="badge badge-success">✅ ${passed} Passed</span>
              ${failed > 0 ? `<span class="badge badge-danger">❌ ${failed} Failed</span>` : ''}
            </div>
          </div>
        </div>
      </div>

      <!-- Grades per semester -->
      ${sortedKeys.map(key => {
        const grp = semMap[key];
        const semPassing = grp.rows.filter(g => g.grade !== 'INC' && parseFloat(g.grade) <= 3);
        const semGPA = semPassing.length
          ? (semPassing.reduce((a, g) => a + parseFloat(g.grade), 0) / semPassing.length).toFixed(2)
          : null;

        return `
          <div class="section-card mb-20">
            <div class="section-card-head">
              <div>
                <div class="fw-7">${esc(grp.sem)} Semester · ${esc(grp.sy)}</div>
                ${semGPA ? `<div class="text-xs text-muted mt-2">Semester GPA (passing): ${semGPA}</div>` : ''}
              </div>
            </div>
            <div class="table-wrap"><table>
              <thead><tr><th>Code</th><th>Subject</th><th>Units</th><th>Faculty</th><th>Section</th><th>Grade</th><th>Description</th></tr></thead>
              <tbody>
                ${grp.rows.map(g => {
                  const gNum    = g.grade !== 'INC' ? parseFloat(g.grade) : null;
                  const failing = gNum !== null && gNum > 3;
                  return `<tr class="${failing ? 'row-fail' : ''}">
                    <td><span class="chip">${esc(g.subject_code)}</span></td>
                    <td class="fw-6">${esc(g.subject_name)}</td>
                    <td>${g.units}</td>
                    <td class="text-sm text-muted">${esc(g.faculty_name || '—')}</td>
                    <td class="text-sm text-muted">${esc(g.section_name)}</td>
                    <td><span class="${gradeClass(g.grade === 'INC' ? 'INC' : gNum)}">${g.grade === 'INC' ? 'INC' : fmt2(gNum)}</span></td>
                    <td class="text-sm text-muted">${gradeDesc(g.grade === 'INC' ? 'INC' : gNum)}</td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table></div>
          </div>`;
      }).join('')}
    `);
  } catch (err) { apiErr(err); }
}