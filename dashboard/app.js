/**
 * RaceBox EzzTech Dashboard - Main Application Logic
 */

const App = (() => {
  const STORAGE_KEY = 'racebox_runs';

  let runs = [];
  let sortColumn = 'date';
  let sortDirection = 'desc';
  let selectedRunIds = new Set();
  let tagModalTargetIds = [];

  // ---- Initialization ----

  function init() {
    loadFromStorage();
    bindEvents();
    if (runs.length > 0) {
      showDashboard();
    }
  }

  function bindEvents() {
    // File upload
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');

    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
      handleFiles(e.dataTransfer.files);
    });

    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => handleFiles(e.target.files));

    // Demo data
    document.getElementById('load-demo-btn').addEventListener('click', loadDemoData);

    // Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // Compare
    document.getElementById('compare-btn').addEventListener('click', compareSelected);

    // Trends
    document.getElementById('trend-metric').addEventListener('change', renderTrends);
    document.getElementById('trend-tag-filter').addEventListener('change', renderTrends);

    // History
    document.getElementById('history-search').addEventListener('input', renderHistory);
    document.getElementById('select-all').addEventListener('change', toggleSelectAll);
    document.getElementById('tag-selected-btn').addEventListener('click', openTagModal);
    document.getElementById('delete-selected-btn').addEventListener('click', deleteSelected);

    // Sort
    document.querySelectorAll('.sortable').forEach(th => {
      th.addEventListener('click', () => {
        const col = th.dataset.sort;
        if (sortColumn === col) {
          sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
          sortColumn = col;
          sortDirection = 'asc';
        }
        renderHistory();
      });
    });

    // Tag modal
    document.getElementById('tag-save-btn').addEventListener('click', saveTags);
    document.getElementById('tag-cancel-btn').addEventListener('click', closeTagModal);
  }

  // ---- File Handling ----

  function handleFiles(fileList) {
    Array.from(fileList).forEach(file => {
      if (!file.name.endsWith('.csv')) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        const parsed = CSVParser.parse(e.target.result, file.name);
        if (parsed.length > 0) {
          runs.push(...parsed);
          saveToStorage();
          showDashboard();
          addFileChip(file.name, parsed.length);
        }
      };
      reader.readAsText(file);
    });
  }

  function addFileChip(name, count) {
    const list = document.getElementById('file-list');
    const chip = document.createElement('div');
    chip.className = 'file-chip';
    chip.innerHTML = `${name} (${count} run${count > 1 ? 's' : ''}) <span class="remove">&times;</span>`;
    list.appendChild(chip);
  }

  function loadDemoData() {
    const demoRuns = CSVParser.generateDemoData(12);
    runs.push(...demoRuns);
    saveToStorage();
    showDashboard();
    addFileChip('Demo Data', demoRuns.length);
  }

  // ---- Storage ----

  function saveToStorage() {
    try {
      const data = runs.map(r => ({
        ...r,
        date: r.date ? r.date.toISOString() : null,
        trace: r.trace ? 'HAS_TRACE' : null,
      }));
      // Store traces separately to avoid localStorage limits
      const traces = {};
      runs.forEach(r => {
        if (r.trace) traces[r.id] = r.trace;
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      localStorage.setItem(STORAGE_KEY + '_traces', JSON.stringify(traces));
    } catch (e) {
      console.warn('Storage full, traces not saved:', e);
      const data = runs.map(r => ({
        ...r,
        date: r.date ? r.date.toISOString() : null,
        trace: null,
      }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
  }

  function loadFromStorage() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) return;

      const parsed = JSON.parse(data);
      const traces = JSON.parse(localStorage.getItem(STORAGE_KEY + '_traces') || '{}');

      runs = parsed.map(r => ({
        ...r,
        date: r.date ? new Date(r.date) : null,
        trace: r.trace === 'HAS_TRACE' ? (traces[r.id] || null) : null,
      }));
    } catch (e) {
      console.warn('Failed to load stored data:', e);
    }
  }

  // ---- Tab Navigation ----

  function switchTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    document.querySelectorAll('.tab-content').forEach(sec => {
      sec.classList.add('hidden');
    });
    document.getElementById('tab-' + tabName).classList.remove('hidden');

    if (tabName === 'overview') renderOverview();
    if (tabName === 'compare') renderCompare();
    if (tabName === 'trends') renderTrends();
    if (tabName === 'history') renderHistory();
  }

  function showDashboard() {
    document.getElementById('tab-nav').classList.remove('hidden');
    switchTab('overview');
  }

  // ---- Overview ----

  function renderOverview() {
    const total = runs.length;
    const best = (key, lower) => {
      const vals = runs.filter(r => r[key] != null).map(r => r[key]);
      if (vals.length === 0) return '--';
      const v = lower ? Math.min(...vals) : Math.max(...vals);
      return v.toFixed(3);
    };

    document.getElementById('stat-total-runs').textContent = total;
    document.getElementById('stat-best-0-100').textContent = best('time_0_100', true) + (best('time_0_100', true) !== '--' ? 's' : '');
    document.getElementById('stat-best-0-60').textContent = best('time_0_60', true) + (best('time_0_60', true) !== '--' ? 's' : '');
    document.getElementById('stat-best-402').textContent = best('time_402m', true) + (best('time_402m', true) !== '--' ? 's' : '');
    document.getElementById('stat-best-201').textContent = best('time_201m', true) + (best('time_201m', true) !== '--' ? 's' : '');
    document.getElementById('stat-top-speed').textContent = best('top_speed', false) + (best('top_speed', false) !== '--' ? ' km/h' : '');

    // Avg reaction time
    const reactionTimes = runs.filter(r => r.reaction_time != null).map(r => r.reaction_time);
    const avgReaction = reactionTimes.length > 0
      ? (reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length).toFixed(3) + 's'
      : '--';
    document.getElementById('stat-avg-reaction').textContent = avgReaction;

    // Consistency score (lower StdDev of 0-100 = more consistent)
    const times100 = runs.filter(r => r.time_0_100 != null).map(r => r.time_0_100);
    if (times100.length >= 3) {
      const mean = times100.reduce((a, b) => a + b, 0) / times100.length;
      const variance = times100.reduce((a, b) => a + (b - mean) ** 2, 0) / times100.length;
      const stdDev = Math.sqrt(variance);
      const score = Math.max(0, 100 - stdDev * 50);
      document.getElementById('stat-consistency').textContent = score.toFixed(0) + '%';
    } else {
      document.getElementById('stat-consistency').textContent = '--';
    }

    // Charts
    const latestRun = [...runs].sort((a, b) => (b.date || 0) - (a.date || 0))[0];
    Charts.renderLatestRun('chart-latest-run', latestRun);
    Charts.renderPersonalBests('chart-personal-bests', runs);
  }

  // ---- Compare ----

  function renderCompare() {
    const container = document.getElementById('run-checkboxes');
    container.innerHTML = '';

    const sortedRuns = [...runs].sort((a, b) => (b.date || 0) - (a.date || 0));
    sortedRuns.forEach((run, i) => {
      const color = Charts.COLORS[i % Charts.COLORS.length];
      const label = formatRunLabel(run);
      const div = document.createElement('label');
      div.className = 'run-checkbox-item';
      div.innerHTML = `
        <input type="checkbox" value="${run.id}" class="compare-check">
        <span class="color-dot" style="background: ${color}"></span>
        ${label}
      `;
      container.appendChild(div);
    });
  }

  function compareSelected() {
    const checked = Array.from(document.querySelectorAll('.compare-check:checked'));
    const selectedIds = checked.map(cb => cb.value);
    const selectedRuns = runs.filter(r => selectedIds.includes(r.id));

    if (selectedRuns.length < 2) {
      alert('Please select at least 2 runs to compare.');
      return;
    }

    Charts.renderCompareSpeed('chart-compare-speed', selectedRuns);
    Charts.renderCompareAccel('chart-compare-accel', selectedRuns);

    // Comparison table
    renderComparisonTable(selectedRuns);
  }

  function renderComparisonTable(selectedRuns) {
    const container = document.getElementById('compare-table-container');
    const statsDiv = document.getElementById('compare-stats');
    statsDiv.classList.remove('hidden');

    const metrics = [
      { key: 'time_0_30', label: '0-30 km/h', unit: 's' },
      { key: 'time_0_60', label: '0-60 km/h', unit: 's' },
      { key: 'time_0_100', label: '0-100 km/h', unit: 's' },
      { key: 'time_201m', label: '201m', unit: 's' },
      { key: 'time_402m', label: '402m', unit: 's' },
      { key: 'top_speed', label: 'Top Speed', unit: 'km/h' },
      { key: 'reaction_time', label: 'Reaction', unit: 's' },
    ];

    let html = '<table><thead><tr><th>Metric</th>';
    selectedRuns.forEach((r, i) => {
      html += `<th style="color: ${Charts.COLORS[i % Charts.COLORS.length]}">${formatRunLabel(r)}</th>`;
    });
    html += '<th>Diff</th></tr></thead><tbody>';

    metrics.forEach(m => {
      const values = selectedRuns.map(r => r[m.key]);
      const validValues = values.filter(v => v != null);
      if (validValues.length === 0) return;

      html += `<tr><td><strong>${m.label}</strong></td>`;
      const isLowerBetter = m.key !== 'top_speed';
      const best = isLowerBetter ? Math.min(...validValues) : Math.max(...validValues);

      values.forEach(v => {
        if (v == null) {
          html += '<td>—</td>';
        } else {
          const isBest = v === best;
          html += `<td class="${isBest ? 'best-value' : ''}">${v.toFixed(3)} ${m.unit}</td>`;
        }
      });

      // Diff column (first vs second)
      if (validValues.length >= 2 && values[0] != null && values[1] != null) {
        const diff = values[0] - values[1];
        const sign = diff > 0 ? '+' : '';
        const color = (isLowerBetter ? diff < 0 : diff > 0) ? 'var(--success)' : 'var(--danger)';
        html += `<td style="color: ${color}">${sign}${diff.toFixed(3)} ${m.unit}</td>`;
      } else {
        html += '<td>—</td>';
      }

      html += '</tr>';
    });

    html += '</tbody></table>';
    container.innerHTML = html;
  }

  // ---- Trends ----

  function renderTrends() {
    const metric = document.getElementById('trend-metric').value;
    const tagFilter = document.getElementById('trend-tag-filter').value;

    let filteredRuns = runs;
    if (tagFilter) {
      filteredRuns = runs.filter(r => r.tags && r.tags.includes(tagFilter));
    }

    const metricLabels = {
      time_0_100: '0-100 km/h Time',
      time_0_60: '0-60 km/h Time',
      time_0_30: '0-30 km/h Time',
      time_201m: '201m Time',
      time_402m: '402m Time',
      top_speed: 'Top Speed',
      reaction_time: 'Reaction Time',
    };

    document.getElementById('trend-chart-title').textContent =
      (metricLabels[metric] || metric) + ' Over Time';

    Charts.renderTrend('chart-trend', filteredRuns, metric, metricLabels[metric]);
    updateTagFilter();
  }

  function updateTagFilter() {
    const select = document.getElementById('trend-tag-filter');
    const currentValue = select.value;
    const allTags = new Set();
    runs.forEach(r => {
      if (r.tags) r.tags.forEach(t => allTags.add(t));
    });

    select.innerHTML = '<option value="">All runs</option>';
    Array.from(allTags).sort().forEach(tag => {
      const opt = document.createElement('option');
      opt.value = tag;
      opt.textContent = tag;
      if (tag === currentValue) opt.selected = true;
      select.appendChild(opt);
    });
  }

  // ---- History ----

  function renderHistory() {
    const searchTerm = document.getElementById('history-search').value.toLowerCase();
    const tbody = document.getElementById('history-body');

    let filtered = runs;
    if (searchTerm) {
      filtered = runs.filter(r => {
        const dateStr = r.date ? formatDate(r.date) : '';
        const tags = (r.tags || []).join(' ');
        const source = r.source || '';
        return (dateStr + tags + source).toLowerCase().includes(searchTerm);
      });
    }

    // Sort
    filtered = [...filtered].sort((a, b) => {
      let va = a[sortColumn];
      let vb = b[sortColumn];

      if (sortColumn === 'date') {
        va = va ? va.getTime() : 0;
        vb = vb ? vb.getTime() : 0;
      }

      if (va == null) va = Infinity;
      if (vb == null) vb = Infinity;

      return sortDirection === 'asc' ? va - vb : vb - va;
    });

    // Update sort headers
    document.querySelectorAll('.sortable').forEach(th => {
      th.classList.remove('sorted-asc', 'sorted-desc');
      if (th.dataset.sort === sortColumn) {
        th.classList.add(sortDirection === 'asc' ? 'sorted-asc' : 'sorted-desc');
      }
    });

    // Find bests
    const bests = {};
    ['time_0_60', 'time_0_100', 'time_201m', 'time_402m', 'reaction_time'].forEach(key => {
      const vals = runs.filter(r => r[key] != null).map(r => r[key]);
      bests[key] = vals.length > 0 ? Math.min(...vals) : null;
    });
    const topSpeedVals = runs.filter(r => r.top_speed != null).map(r => r.top_speed);
    bests.top_speed = topSpeedVals.length > 0 ? Math.max(...topSpeedVals) : null;

    tbody.innerHTML = '';

    filtered.forEach(run => {
      const tr = document.createElement('tr');
      const isSelected = selectedRunIds.has(run.id);

      const formatVal = (key, unit) => {
        if (run[key] == null) return '—';
        const isBest = run[key] === bests[key];
        const cls = isBest ? 'best-value' : '';
        return `<span class="${cls}">${run[key].toFixed(3)}${unit}</span>`;
      };

      const tagsHtml = (run.tags || []).map(t =>
        `<span class="tag tag-removable" data-run-id="${run.id}" data-tag="${t}">${t} &times;</span>`
      ).join(' ');

      tr.innerHTML = `
        <td><input type="checkbox" class="row-check" value="${run.id}" ${isSelected ? 'checked' : ''}></td>
        <td>${run.date ? formatDate(run.date) : '—'}</td>
        <td>${formatVal('time_0_60', 's')}</td>
        <td>${formatVal('time_0_100', 's')}</td>
        <td>${formatVal('time_201m', 's')}</td>
        <td>${formatVal('time_402m', 's')}</td>
        <td>${formatVal('top_speed', ' km/h')}</td>
        <td>${formatVal('reaction_time', 's')}</td>
        <td>${tagsHtml}</td>
        <td>
          <button class="action-btn tag-btn" data-id="${run.id}" title="Add tags">&#127991;</button>
          <button class="action-btn del-btn" data-id="${run.id}" title="Delete">&#128465;</button>
        </td>
      `;

      tbody.appendChild(tr);
    });

    // Bind row events
    tbody.querySelectorAll('.row-check').forEach(cb => {
      cb.addEventListener('change', () => {
        if (cb.checked) selectedRunIds.add(cb.value);
        else selectedRunIds.delete(cb.value);
      });
    });

    tbody.querySelectorAll('.tag-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        tagModalTargetIds = [btn.dataset.id];
        openTagModalDirect();
      });
    });

    tbody.querySelectorAll('.del-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (confirm('Delete this run?')) {
          runs = runs.filter(r => r.id !== btn.dataset.id);
          saveToStorage();
          renderHistory();
        }
      });
    });

    tbody.querySelectorAll('.tag-removable').forEach(el => {
      el.addEventListener('click', () => {
        const runId = el.dataset.runId;
        const tag = el.dataset.tag;
        const run = runs.find(r => r.id === runId);
        if (run) {
          run.tags = run.tags.filter(t => t !== tag);
          saveToStorage();
          renderHistory();
        }
      });
    });
  }

  // ---- Tagging ----

  function toggleSelectAll() {
    const checked = document.getElementById('select-all').checked;
    document.querySelectorAll('.row-check').forEach(cb => {
      cb.checked = checked;
      if (checked) selectedRunIds.add(cb.value);
      else selectedRunIds.delete(cb.value);
    });
  }

  function openTagModal() {
    if (selectedRunIds.size === 0) {
      alert('Select runs first.');
      return;
    }
    tagModalTargetIds = Array.from(selectedRunIds);
    openTagModalDirect();
  }

  function openTagModalDirect() {
    document.getElementById('tag-modal').classList.remove('hidden');
    document.getElementById('tag-input').value = '';
    document.getElementById('tag-input').focus();
  }

  function closeTagModal() {
    document.getElementById('tag-modal').classList.add('hidden');
    tagModalTargetIds = [];
  }

  function saveTags() {
    const input = document.getElementById('tag-input').value;
    const newTags = input.split(',').map(t => t.trim()).filter(t => t.length > 0);

    if (newTags.length === 0) {
      closeTagModal();
      return;
    }

    tagModalTargetIds.forEach(id => {
      const run = runs.find(r => r.id === id);
      if (run) {
        if (!run.tags) run.tags = [];
        newTags.forEach(tag => {
          if (!run.tags.includes(tag)) run.tags.push(tag);
        });
      }
    });

    saveToStorage();
    closeTagModal();
    renderHistory();
    updateTagFilter();
  }

  function deleteSelected() {
    if (selectedRunIds.size === 0) {
      alert('Select runs first.');
      return;
    }
    if (!confirm(`Delete ${selectedRunIds.size} selected run(s)?`)) return;

    runs = runs.filter(r => !selectedRunIds.has(r.id));
    selectedRunIds.clear();
    saveToStorage();
    renderHistory();
  }

  // ---- Helpers ----

  function formatRunLabel(run) {
    const date = run.date ? formatDate(run.date) : 'Unknown';
    const tags = run.tags && run.tags.length > 0 ? ' [' + run.tags.join(', ') + ']' : '';
    return date + tags;
  }

  function formatDate(date) {
    if (!date) return '—';
    return date.toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  }

  // Boot
  document.addEventListener('DOMContentLoaded', init);

  return { init };
})();
