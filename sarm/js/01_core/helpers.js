'use strict';

/* ══════════════════════════════════════════
   HELPERS — utility + analytics functions
══════════════════════════════════════════ */

/* ── String helpers ──────────────────── */
function esc(s) {
  return String(s == null ? '—' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function initials(n) {
  return (n||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
}
function fmt2(g) { return parseFloat(g).toFixed(2); }
function toNum(v) { const n = Number(v); return Number.isFinite(n) ? n : null; }
function percentLabel(v) { return Number.isFinite(v) ? `${Math.round(v)}%` : '—'; }
function safePassRate(passed, total) {
  const p = toNum(passed);
  const t = toNum(total);
  return t > 0 && Number.isFinite(p) ? Math.round(p / t * 100) : null;
}
function avgLabel(v) {
  const n = toNum(v);
  return n !== null ? fmt2(n) : '—';
}

/* ── Grade helpers ───────────────────── */
function gradeDesc(g) {
  if (g==='INC') return 'Incomplete';
  if (g<=1.0)    return 'Excellent';
  if (g<=1.5)    return 'Very Good';
  if (g<=2.0)    return 'Good';
  if (g<=2.5)    return 'Satisfactory';
  if (g<=3.0)    return 'Passing';
  return 'Failed';
}
function gradeClass(g) {
  if (g==='INC') return 'grade-inc';
  if (g>3.0)     return 'grade-fail';
  if (g>2.5)     return 'grade-warn';
  return 'grade-pass';
}
function isPassing(g) { return g!=='INC' && g<=3.0; }

function openStudentGrades(el) {
  const studentId   = el.dataset.studentId;
  const studentName = el.dataset.studentName || studentId;
  if (!studentId) return;
  showStudentGradesModal(studentId, studentName);
}

async function showStudentGradesModal(studentId, studentName) {
  showModal(`Grades — ${esc(studentName)}`, `<div class="text-muted text-sm" style="padding:12px">Loading grades…</div>`);
  try {
    const grades = await api.getGrades({ student_id: studentId });
    if (!grades.length) {
      document.getElementById('modal-body').innerHTML = `<div class="text-muted text-sm">No grades found for ${esc(studentName)}.</div>`;
      return;
    }

    document.getElementById('modal-body').innerHTML = `
      <div class="section-card">
        <div class="section-card-body">
          <div class="text-sm text-muted mb-16">Student ID: <span class="mono">${esc(studentId)}</span></div>
          <div class="table-wrap"><table>
            <thead><tr>
              <th>Subject</th><th>Section</th><th>SY</th><th>Sem</th><th>Grade</th><th>Description</th><th>Faculty</th>
            </tr></thead>
            <tbody>
              ${grades.map(g => {
                const gNum = g.grade === 'INC' ? null : parseFloat(g.grade);
                return `<tr>
                  <td><span class="chip">${esc(g.subject_code)}</span> ${esc(g.subject_name)}</td>
                  <td>${esc(g.section_name)}</td>
                  <td class="text-sm text-muted">${esc(g.sy)}</td>
                  <td class="text-sm text-muted">${esc(g.sem)}</td>
                  <td><span class="${gradeClass(g.grade === 'INC' ? 'INC' : gNum)}">${g.grade === 'INC' ? 'INC' : fmt2(gNum)}</span></td>
                  <td class="text-sm text-muted">${esc(gradeDesc(g.grade === 'INC' ? 'INC' : gNum))}</td>
                  <td class="text-sm text-muted">${esc(g.faculty_name || '—')}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table></div>
        </div>
      </div>`;
  } catch (err) {
    apiErr(err, 'Unable to load student grades.');
    document.getElementById('modal-body').innerHTML = `<div class="text-muted text-sm">Unable to load grades.</div>`;
  }
}

/* ── Record lookups ──────────────────── */
const getCollege = id => DB.colleges.find(c=>c.id===id);
const getDept    = id => DB.departments.find(d=>d.id===id);
const getSubject = id => DB.subjects.find(s=>s.id===id);
const getSection = id => DB.sections.find(s=>s.id===id);
const getUser    = id => DB.users.find(u=>u.id===id);
const getStudent = id => DB.students.find(s=>s.id===id);

/* ── Students enrolled in a section ─── */
function enrolledIn(sectionId) {
  return DB.enrollments
    .filter(e=>e.sectionId===sectionId)
    .map(e=>getStudent(e.studentId))
    .filter(Boolean);
}

/* ── Grade of a student in a section ── */
function gradeFor(studentId, sectionId) {
  return DB.grades.find(g=>g.studentId===studentId && g.sectionId===sectionId);
}

/* ── Grade summary for an array of section IDs ── */
function gradeSummary(secIds) {
  const gs     = DB.grades.filter(g=>secIds.includes(g.sectionId) && g.grade!=='INC');
  const total   = gs.length;
  const passed  = gs.filter(g=>g.grade<=3).length;
  const failed  = total-passed;
  const avg     = total ? gs.reduce((a,g)=>a+g.grade,0)/total : null;
  const passRate= total ? Math.round(passed/total*100) : null;
  return { total, passed, failed, avg, passRate };
}

/* ── All section IDs under a department ── */
function secIdsForDept(deptId) {
  const subjIds = DB.subjects.filter(s=>s.deptId===deptId).map(s=>s.id);
  return DB.sections.filter(s=>subjIds.includes(s.subjectId)).map(s=>s.id);
}

/* ── All section IDs under a college ─── */
function secIdsForCollege(collegeId) {
  const deptIds = DB.departments.filter(d=>d.collegeId===collegeId).map(d=>d.id);
  const subjIds = DB.subjects.filter(s=>deptIds.includes(s.deptId)).map(s=>s.id);
  return DB.sections.filter(s=>subjIds.includes(s.subjectId)).map(s=>s.id);
}

/* ── Failing students in a set of section IDs ── */
function getFailingStudents(scopeSecIds) {
  const failGrades = DB.grades.filter(g=>
    scopeSecIds.includes(g.sectionId) && g.grade!=='INC' && g.grade>3.0
  );
  const stuIds = [...new Set(failGrades.map(g=>g.studentId))];
  return stuIds.map(sid=>{
    const student = getStudent(sid);
    const fails   = failGrades.filter(g=>g.studentId===sid);
    return { student, failCount:fails.length };
  }).filter(x=>x.student);
}

/* ── Performance by year level ──────── */
function perfByYear(secIds) {
  return [1,2,3,4].map(yr=>{
    const subjIds = DB.subjects.filter(s=>s.year===yr).map(s=>s.id);
    const sIds    = DB.sections.filter(s=>secIds.includes(s.id)&&subjIds.includes(s.subjectId)).map(s=>s.id);
    const sm      = gradeSummary(sIds);
    return { year:yr, ...sm };
  }).filter(r=>r.total>0);
}

/* ══════════════════════════════════════════
   ANALYTICS HELPERS
══════════════════════════════════════════ */

/* ── All unique "sy||sem" keys in sorted order ── */
function allSemesters() {
  const keys = new Set(DB.sections.filter(s=>s.submitted).map(s=>`${s.sy}||${s.sem}`));
  const semOrder = { '1st':1, '2nd':2, 'Summer':3 };
  return [...keys].sort((a,b)=>{
    const [asy,asem]=a.split('||'), [bsy,bsem]=b.split('||');
    return asy!==bsy ? asy.localeCompare(bsy) : (semOrder[asem]||0)-(semOrder[bsem]||0);
  });
}

/* ── Semester trend: pass rate + avg grade + headcount per semester ──
   scoped to a list of section IDs (already filtered by role scope)  */
function semesterTrend(scopeSecIds) {
  return allSemesters().map(key=>{
    const [sy,sem] = key.split('||');
    const sIds = DB.sections
      .filter(s=>scopeSecIds.includes(s.id) && s.sy===sy && s.sem===sem && s.submitted)
      .map(s=>s.id);
    if (!sIds.length) return null;

    const sm = gradeSummary(sIds);
    // Unique enrolled students
    const headcount = new Set(
      DB.enrollments.filter(e=>sIds.includes(e.sectionId)).map(e=>e.studentId)
    ).size;

    return { label:`${sy} ${sem}`, sy, sem, ...sm, headcount };
  }).filter(Boolean);
}

/* ── Department comparison ──────────────
   Returns one row per dept in scope      */
function deptComparison(deptIds) {
  return deptIds.map(deptId=>{
    const dept   = getDept(deptId);
    const secIds = secIdsForDept(deptId).filter(sid=>getSection(sid)?.submitted);
    const sm     = gradeSummary(secIds);
    const headcount = new Set(
      DB.enrollments.filter(e=>secIds.includes(e.sectionId)).map(e=>e.studentId)
    ).size;
    return { dept, ...sm, headcount };
  });
}

/* ── Headcount per semester for a set of section IDs ── */
function headcountTrend(scopeSecIds) {
  return allSemesters().map(key=>{
    const [sy,sem]=key.split('||');
    const sIds = DB.sections
      .filter(s=>scopeSecIds.includes(s.id)&&s.sy===sy&&s.sem===sem&&s.submitted)
      .map(s=>s.id);
    if(!sIds.length) return null;
    const count = new Set(DB.enrollments.filter(e=>sIds.includes(e.sectionId)).map(e=>e.studentId)).size;
    return { label:`${sy} ${sem}`, count };
  }).filter(Boolean);
}

/* ══════════════════════════════════════════
   SVG CHART HELPERS  (pure HTML strings)
══════════════════════════════════════════ */

/* ── Mini SVG line/bar chart for trend ──
   data = [{label, passRate, headcount}]  */
function trendChart(data, valueKey, color, unit='%') {
  if (!data.length) return '<div class="text-muted text-sm">No data.</div>';
  const W=600, H=160, PAD={t:20,b:44,l:40,r:16};
  const iW=W-PAD.l-PAD.r, iH=H-PAD.t-PAD.b;
  const vals   = data.map(d=>d[valueKey]??0);
  const maxVal = Math.max(...vals, unit==='%'?100:10);
  const minVal = 0;
  const range  = maxVal-minVal||1;

  const pts = data.map((d,i)=>{
    const x = PAD.l + (i/(data.length-1||1))*iW;
    const y = PAD.t + iH - ((d[valueKey]??0)-minVal)/range*iH;
    return {x,y,d};
  });

  const polyline = pts.map(p=>`${p.x},${p.y}`).join(' ');
  const areaBot  = PAD.t+iH;
  const area     = `${PAD.l},${areaBot} `+polyline+` ${pts[pts.length-1].x},${areaBot}`;

  const gridLines = [0,25,50,75,100].filter(v=>v<=maxVal+5).map(v=>{
    const y = PAD.t+iH-(v-minVal)/range*iH;
    return `<line x1="${PAD.l}" y1="${y}" x2="${W-PAD.r}" y2="${y}" stroke="#e5e7eb" stroke-dasharray="3,3"/>
            <text x="${PAD.l-4}" y="${y+4}" text-anchor="end" font-size="9" fill="#9ca3af">${v}${unit}</text>`;
  }).join('');

  const labels = pts.map(p=>
    `<text x="${p.x}" y="${H-6}" text-anchor="middle" font-size="9" fill="#6b7280"
      transform="rotate(-30,${p.x},${H-6})">${esc(p.d.label)}</text>`
  ).join('');

  const dots = pts.map(p=>
    `<circle cx="${p.x}" cy="${p.y}" r="4" fill="${color}" stroke="#fff" stroke-width="2"/>
     <title>${p.d.label}: ${p.d[valueKey]??'—'}${unit}</title>`
  ).join('');

  return `<div style="overflow-x:auto">
  <svg viewBox="0 0 ${W} ${H}" style="width:100%;max-width:${W}px;height:${H}px" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="tg${color.replace(/[^a-z]/gi,'')}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${color}" stop-opacity=".18"/>
        <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
      </linearGradient>
    </defs>
    ${gridLines}
    <polygon points="${area}" fill="url(#tg${color.replace(/[^a-z]/gi,'')})" />
    <polyline points="${polyline}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
    ${dots}
    ${labels}
  </svg></div>`;
}

/* ── Horizontal bar chart for dept comparison ── */
function deptBarChart(rows, valueKey, color, unit='%') {
  if (!rows.length) return '<div class="text-muted text-sm">No data.</div>';
  const vals   = rows.map(r=>r[valueKey]??0);
  const maxVal = Math.max(...vals,1);
  return rows.map(r=>{
    const val = r[valueKey]??0;
    const w   = Math.round(val/maxVal*100);
    return `<div class="bar-row">
      <div class="bar-label" style="width:180px;font-size:.78rem">${esc(r.dept?.name||'—')}</div>
      <div class="bar-track" style="flex:1"><div class="bar-fill" style="width:${w}%;background:${color}"></div></div>
      <div class="bar-val" style="color:${color};width:52px;text-align:right">${val??'—'}${unit}</div>
    </div>`;
  }).join('');
}

/* ══════════════════════════════════════════
   UI COMPONENT HELPERS
══════════════════════════════════════════ */

function barRow(label, pct, color) {
  const w = pct==null ? 0 : Math.min(pct,100);
  return `<div class="bar-row">
    <div class="bar-label">${esc(label)}</div>
    <div class="bar-track"><div class="bar-fill" style="width:${w}%;background:${color}"></div></div>
    <div class="bar-val" style="color:${color}">${pct==null?'—':pct+'%'}</div>
  </div>`;
}

function statCard(icon, label, val, color, bg) {
  return `<div class="stat-card">
    <div class="stat-icon" style="background:${bg};color:${color}">${icon}</div>
    <div><div class="stat-val">${val}</div><div class="stat-label">${label}</div></div>
  </div>`;
}

function prCell(pr) {
  if (pr==null) return '<span class="text-muted text-sm">—</span>';
  const color = pr>=75 ? 'var(--success)' : 'var(--danger)';
  return `<span style="color:${color};font-weight:700">${pr}%</span>`;
}