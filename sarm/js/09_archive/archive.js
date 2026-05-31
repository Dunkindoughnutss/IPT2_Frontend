'use strict';

/* ══════════════════════════════════════════
   GRADUATE ARCHIVES (API)
   Registrar, Dean, Chairman
══════════════════════════════════════════ */

registerPage('reg-archives',   () => renderArchives());
registerPage('dean-archives',  () => renderArchives());
registerPage('chair-archives', () => renderArchives());

let _archFilter = { college_id: '', dept_id: '', year: '', search: '' };

function renderArchives() {
  _archFilter = { college_id: '', dept_id: '', year: '', search: '' };
  _drawArchives();
}

async function _drawArchives() {
  set(`<div class="empty"><div class="empty-icon">⏳</div><div class="empty-text">Loading archives…</div></div>`);
  try {
    const params = {};
    if (_archFilter.college_id) params.college_id = _archFilter.college_id;
    if (_archFilter.dept_id)    params.dept_id    = _archFilter.dept_id;
    if (_archFilter.year)       params.year       = _archFilter.year;

    const grads = await api.getGraduates(params);

    // Client-side search filter
    const filtered = _archFilter.search.trim()
      ? grads.filter(g =>
          g.name.toLowerCase().includes(_archFilter.search.toLowerCase()) ||
          g.id.includes(_archFilter.search)
        )
      : grads;

    // Build unique colleges, depts, years from ALL graduates (unfiltered)
    const allGrads = await api.getGraduates();
    const colSet = {}, depSet = {}, yearSet = new Set();
    allGrads.forEach(g => {
      colSet[g.college_id] = g.college_name;
      if (!depSet[g.college_id]) depSet[g.college_id] = [];
      if (!depSet[g.college_id].find(d => d.id === g.dept_id))
        depSet[g.college_id].push({ id: g.dept_id, name: g.dept_name });
      yearSet.add(g.graduation_year);
    });
    const colleges  = Object.entries(colSet).map(([id, name]) => ({ id: parseInt(id), name }));
    const filtDepts = _archFilter.college_id
      ? (depSet[parseInt(_archFilter.college_id)] || [])
      : Object.values(depSet).flat();
    const years = [...yearSet].sort().reverse();

    const role = currentUser.role;

    // Stats on filtered set
    const withHonors = filtered.filter(g => g.honors).length;
    const avgGPA     = filtered.length
      ? (filtered.reduce((a, g) => a + g.gpa, 0) / filtered.length).toFixed(2)
      : '—';
    const latestYear = years[0] || '—';

    set(`
      <div class="page-header">
        <div><div class="page-title">Graduate Archives</div>
        <div class="page-sub">Organized by college and department</div></div>
        ${role === 'Registrar' ? `<button class="btn btn-primary" onclick="showAddGraduateModal()">+ Add Graduate</button>` : ''}
      </div>

      <!-- KPIs -->
      <div class="grid-4 mb-20">
        ${statCard('🎓','Total Graduates', filtered.length,  'var(--blue)',    '#dbeafe')}
        ${statCard('🏅','With Honors',     withHonors,       'var(--warning)', '#fef3c7')}
        ${statCard('📊','Average GPA',     avgGPA,           'var(--teal)',    '#ccfbf1')}
        ${statCard('📅','Latest Batch',    latestYear,       '#374151',        '#f3f4f6')}
      </div>

      <!-- Filters -->
      <div class="section-card mb-20">
        <div class="section-card-head"><div class="fw-7">Filters & Search</div></div>
        <div class="section-card-body">
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;align-items:flex-end">
            ${role === 'Registrar' ? `
            <div class="field-wrap" style="margin:0">
              <label class="field-label">College</label>
              <select class="field-select" onchange="setArchFilter('college_id',this.value)">
                <option value="">All Colleges</option>
                ${colleges.map(c => `<option value="${c.id}" ${_archFilter.college_id==c.id?'selected':''}>${esc(c.name)}</option>`).join('')}
              </select>
            </div>` : ''}
            ${role !== 'Chairman' ? `
            <div class="field-wrap" style="margin:0">
              <label class="field-label">Department</label>
              <select class="field-select" onchange="setArchFilter('dept_id',this.value)">
                <option value="">All Departments</option>
                ${filtDepts.map(d => `<option value="${d.id}" ${_archFilter.dept_id==d.id?'selected':''}>${esc(d.name)}</option>`).join('')}
              </select>
            </div>` : ''}
            <div class="field-wrap" style="margin:0">
              <label class="field-label">Graduation Year</label>
              <select class="field-select" onchange="setArchFilter('year',this.value)">
                <option value="">All Years</option>
                ${years.map(y => `<option value="${y}" ${_archFilter.year===y?'selected':''}>${esc(y)}</option>`).join('')}
              </select>
            </div>
            <div class="field-wrap" style="margin:0">
              <label class="field-label">Search</label>
              <input class="field-input" placeholder="Name or ID…"
                value="${esc(_archFilter.search)}"
                oninput="setArchFilterSearch(this.value)" />
            </div>
            <div style="display:flex;align-items:flex-end">
              <button class="btn btn-ghost btn-sm" onclick="clearArchFilters()">✕ Clear</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Results -->
      ${_renderArchGroups(filtered, colleges, depSet)}
    `);
  } catch (err) { apiErr(err); }
}

/* ── Group graduates: college > dept > batch year ── */
function _renderArchGroups(grads, colleges, depSet) {
  if (!grads.length) {
    return `<div class="empty"><div class="empty-icon">🎓</div><div class="empty-text">No graduates found.</div></div>`;
  }

  // Group by college_id > dept_id > graduation_year
  const grouped = {};
  grads.forEach(g => {
    if (!grouped[g.college_id]) grouped[g.college_id] = {};
    if (!grouped[g.college_id][g.dept_id]) grouped[g.college_id][g.dept_id] = {};
    if (!grouped[g.college_id][g.dept_id][g.graduation_year]) grouped[g.college_id][g.dept_id][g.graduation_year] = [];
    grouped[g.college_id][g.dept_id][g.graduation_year].push(g);
  });

  return Object.keys(grouped).map(colId => {
    const colGrads    = grads.filter(g => g.college_id === parseInt(colId));
    const colName     = colGrads[0]?.college_name || '—';
    const deptGroups  = grouped[colId];

    return `
      <div class="archive-college-block mb-20">
        <div class="archive-college-header">
          <span class="archive-college-icon">🏛</span>
          <span>${esc(colName)}</span>
          <span class="badge badge-blue" style="margin-left:auto">${colGrads.length} graduate${colGrads.length !== 1 ? 's' : ''}</span>
        </div>

        ${Object.keys(deptGroups).map(deptId => {
          const deptGrads = colGrads.filter(g => g.dept_id === parseInt(deptId));
          const deptName  = deptGrads[0]?.dept_name || '—';
          const yearGroups = deptGroups[deptId];

          return `
            <div class="archive-dept-block">
              <div class="archive-dept-header">
                <span>📂 ${esc(deptName)}</span>
                <span class="text-muted text-xs">${deptGrads.length} graduate${deptGrads.length !== 1 ? 's' : ''}</span>
              </div>

              ${Object.keys(yearGroups).sort().reverse().map(yr => {
                const batch    = yearGroups[yr];
                const honors   = batch.filter(g => g.honors).length;
                const batchAvg = (batch.reduce((a, g) => a + g.gpa, 0) / batch.length).toFixed(2);

                return `
                  <div class="archive-batch">
                    <div class="archive-batch-header">
                      <span class="fw-7">Batch ${esc(yr)}</span>
                      <div class="flex gap-8">
                        <span class="badge badge-muted">${batch.length} grad${batch.length !== 1 ? 's' : ''}</span>
                        ${honors ? `<span class="badge badge-warning">🏅 ${honors} with honors</span>` : ''}
                        <span class="badge badge-blue">Avg GPA: ${batchAvg}</span>
                      </div>
                    </div>
                    <div class="table-wrap">
                      <table>
                        <thead><tr><th>Student ID</th><th>Name</th><th>GPA</th><th>Latin Honors</th></tr></thead>
                        <tbody>
                          ${[...batch].sort((a, b) => a.gpa - b.gpa).map(g => `
                            <tr class="${g.honors ? 'row-honors' : ''}">
                              <td class="mono text-sm">${esc(g.id)}</td>
                              <td>
                                <div class="flex gap-8">
                                  <div class="avatar avatar-sm" style="${g.honors ? 'background:linear-gradient(135deg,#d97706,#f59e0b)' : ''}">${initials(g.name)}</div>
                                  <span class="${g.honors ? 'fw-7' : ''}">${esc(g.name)}</span>
                                </div>
                              </td>
                              <td class="mono fw-7" style="color:${g.gpa <= 1.5 ? 'var(--success)' : g.gpa <= 2.5 ? 'var(--blue)' : 'var(--text2)'}">
                                ${fmt2(g.gpa)}
                              </td>
                              <td>${g.honors
                                ? `<span class="badge ${honorsBadge(g.honors)}">🏅 ${esc(g.honors)}</span>`
                                : '<span class="text-muted text-xs">—</span>'}</td>
                            </tr>`).join('')}
                        </tbody>
                      </table>
                    </div>
                  </div>`;
              }).join('')}
            </div>`;
        }).join('')}
      </div>`;
  }).join('');
}

function honorsBadge(h) {
  if (h === 'Summa Cum Laude') return 'badge-danger';
  if (h === 'Magna Cum Laude') return 'badge-warning';
  if (h === 'Cum Laude')       return 'badge-blue';
  return 'badge-muted';
}

/* ── Filter handlers ─────────────────── */
function setArchFilter(key, val) {
  _archFilter[key] = val;
  if (key === 'college_id') _archFilter.dept_id = '';
  _drawArchives();
}
let _searchTimer;
function setArchFilterSearch(val) {
  _archFilter.search = val;
  clearTimeout(_searchTimer);
  _searchTimer = setTimeout(_drawArchives, 300);
}
function clearArchFilters() {
  _archFilter = { college_id: '', dept_id: '', year: '', search: '' };
  _drawArchives();
}

/* ── Add Graduate Modal (Registrar only) ── */
async function showAddGraduateModal() {
  const allGrads = await api.getGraduates().catch(() => []);
  const colSet = {}, depSet = {};
  allGrads.forEach(g => {
    colSet[g.college_id] = g.college_name;
    if (!depSet[g.college_id]) depSet[g.college_id] = [];
    if (!depSet[g.college_id].find(d => d.id === g.dept_id))
      depSet[g.college_id].push({ id: g.dept_id, name: g.dept_name });
  });
  const colleges = Object.entries(colSet).map(([id, name]) => ({ id: parseInt(id), name }));
  window._agDepts = depSet;

  showModal('Add Graduate Record', `
    <div class="grid-2">
      <div class="field-wrap">
        <label class="field-label">Student ID</label>
        <input id="ag-id" class="field-input" placeholder="e.g. 240001" />
      </div>
      <div class="field-wrap">
        <label class="field-label">Full Name</label>
        <input id="ag-name" class="field-input" placeholder="Full name" />
      </div>
    </div>
    <div class="grid-2">
      <div class="field-wrap">
        <label class="field-label">College</label>
        <select id="ag-col" class="field-select" onchange="updateAgDept()">
          <option value="">— Select —</option>
          ${colleges.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}
        </select>
      </div>
      <div class="field-wrap">
        <label class="field-label">Department</label>
        <select id="ag-dept" class="field-select">
          <option value="">— Select college first —</option>
        </select>
      </div>
    </div>
    <div class="grid-2">
      <div class="field-wrap">
        <label class="field-label">Graduation Year (SY)</label>
        <input id="ag-year" class="field-input" placeholder="e.g. 2024-2025" />
      </div>
      <div class="field-wrap">
        <label class="field-label">Final GPA</label>
        <input id="ag-gpa" class="field-input" type="number" step="0.01" min="1" max="5" placeholder="e.g. 1.75" />
      </div>
    </div>
    <div class="field-wrap">
      <label class="field-label">Latin Honors</label>
      <select id="ag-honors" class="field-select">
        <option value="">None</option>
        <option value="Cum Laude">Cum Laude</option>
        <option value="Magna Cum Laude">Magna Cum Laude</option>
        <option value="Summa Cum Laude">Summa Cum Laude</option>
      </select>
    </div>
    <button class="btn btn-primary btn-full" onclick="doAddGraduate()">Save Graduate Record</button>
  `);
}

function updateAgDept() {
  const colId = parseInt(document.getElementById('ag-col').value);
  const sel   = document.getElementById('ag-dept');
  const depts = (window._agDepts || {})[colId] || [];
  sel.innerHTML = `<option value="">— Select —</option>`
    + depts.map(d => `<option value="${d.id}">${esc(d.name)}</option>`).join('');
}

async function doAddGraduate() {
  const id     = document.getElementById('ag-id').value.trim();
  const name   = document.getElementById('ag-name').value.trim();
  const colId  = parseInt(document.getElementById('ag-col').value)    || 0;
  const deptId = parseInt(document.getElementById('ag-dept').value)   || 0;
  const year   = document.getElementById('ag-year').value.trim();
  const gpa    = parseFloat(document.getElementById('ag-gpa').value);
  const honors = document.getElementById('ag-honors').value;

  if (!id || !name || !colId || !deptId || !year || isNaN(gpa)) {
    toast('Please fill in all required fields.', 'error'); return;
  }
  try {
    await api.createGraduate({ id, name, college_id: colId, dept_id: deptId, graduation_year: year, honors, gpa });
    toast('Graduate record saved.', 'success');
    closeModal();
    _drawArchives();
  } catch (err) { apiErr(err); }
}