let fitChart = null;
let residualChart = null;
let currentResultId = null;
let currentDatasetId = null;
let isDirty = false;

const modelTypeLabels = {
  linear: '线性模型',
  exponential: '指数模型',
  quadratic: '二次曲线'
};

function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  toast.className = `toast ${type} show`;
  toast.textContent = message;
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

function updateDatasetButtons() {
  const updateBtn = document.getElementById('updateDatasetBtn');
  if (currentDatasetId) {
    updateBtn.style.display = 'block';
    if (isDirty) {
      updateBtn.textContent = '💾 更新当前数据集 *';
    } else {
      updateBtn.textContent = '💾 更新当前数据集';
    }
  } else {
    updateBtn.style.display = 'none';
  }
}

function markDirty() {
  isDirty = true;
  updateDatasetButtons();
}

function clearDirty() {
  isDirty = false;
  updateDatasetButtons();
}

function mapWeightToRadius(w, minR = 3, maxR = 15) {
  const val = Math.max(0, parseFloat(w) || 0);
  if (val <= 0) return 2;
  return Math.min(maxR, Math.max(minR, minR + Math.sqrt(val) * 3));
}

function initCharts() {
  const fitCtx = document.getElementById('fitChart').getContext('2d');
  const residualCtx = document.getElementById('residualChart').getContext('2d');

  fitChart = new Chart(fitCtx, {
    type: 'scatter',
    data: {
      datasets: [
        {
          label: '原始数据',
          data: [],
          backgroundColor: '#3b82f6',
          borderColor: '#1d4ed8',
          borderWidth: 1,
          pointRadius: [],
          pointHoverRadius: 10,
          showLine: false
        },
        {
          label: '普通拟合',
          data: [],
          borderColor: '#ef4444',
          backgroundColor: 'rgba(239, 68, 68, 0.05)',
          borderWidth: 2.5,
          pointRadius: 0,
          showLine: true,
          tension: 0.1,
          fill: false
        },
        {
          label: '加权拟合',
          data: [],
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.05)',
          borderWidth: 3,
          pointRadius: 0,
          showLine: true,
          tension: 0.1,
          fill: false,
          borderDash: []
        },
        {
          label: '异常点',
          data: [],
          backgroundColor: '#f59e0b',
          borderColor: '#d97706',
          pointRadius: [],
          pointStyle: 'triangle',
          showLine: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(30, 41, 59, 0.95)',
          titleFont: { size: 13 },
          bodyFont: { size: 12 },
          padding: 12,
          cornerRadius: 8,
          callbacks: {
            label: (context) => {
              const di = context.datasetIndex;
              if (di === 1 || di === 2) {
                const x = context.parsed.x?.toFixed(4) || 0;
                const y = context.parsed.y?.toFixed(4) || 0;
                return `(${x}, ${y})`;
              }
              const x = context.parsed.x?.toFixed(4) || 0;
              const y = context.parsed.y?.toFixed(4) || 0;
              const wi = context.dataIndex;
              const tbody = document.getElementById('dataTableBody');
              const wInputs = tbody.querySelectorAll('.w-input');
              let w = 1;
              if (wInputs[wi]) {
                const v = parseFloat(wInputs[wi].value);
                w = isNaN(v) ? 1 : v;
              }
              return `(${x}, ${y}) · 权重=${w}`;
            }
          }
        }
      },
      scales: {
        x: {
          type: 'linear',
          position: 'bottom',
          grid: { color: 'rgba(148, 163, 184, 0.2)' },
          ticks: { font: { size: 12 }, color: '#64748b' },
          title: { display: true, text: 'X 轴', font: { size: 13, weight: '600' }, color: '#475569' }
        },
        y: {
          grid: { color: 'rgba(148, 163, 184, 0.2)' },
          ticks: { font: { size: 12 }, color: '#64748b' },
          title: { display: true, text: 'Y 轴', font: { size: 13, weight: '600' }, color: '#475569' }
        }
      }
    }
  });

  residualChart = new Chart(residualCtx, {
    type: 'scatter',
    data: {
      datasets: [
        {
          label: '残差(加权)',
          data: [],
          backgroundColor: '#10b981',
          borderColor: '#059669',
          pointRadius: [],
          pointHoverRadius: 9,
          showLine: false
        },
        {
          label: '残差(普通)',
          data: [],
          backgroundColor: 'rgba(239, 68, 68, 0.55)',
          borderColor: '#ef4444',
          pointRadius: [],
          pointStyle: 'rectRot',
          showLine: false
        },
        {
          label: '零参考线',
          data: [],
          borderColor: '#64748b',
          borderWidth: 2,
          borderDash: [8, 4],
          pointRadius: 0,
          showLine: true,
          fill: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(30, 41, 59, 0.95)',
          titleFont: { size: 13 },
          bodyFont: { size: 12 },
          padding: 12,
          cornerRadius: 8,
          callbacks: {
            label: (context) => {
              if (context.datasetIndex === 2) return '';
              const name = context.dataset.label;
              const x = context.parsed.x?.toFixed(4) || 0;
              const y = context.parsed.y?.toFixed(6) || 0;
              return `${name}: x=${x}, 残差=${y}`;
            }
          }
        }
      },
      scales: {
        x: {
          type: 'linear',
          position: 'bottom',
          grid: { color: 'rgba(148, 163, 184, 0.2)' },
          ticks: { font: { size: 12 }, color: '#64748b' },
          title: { display: true, text: 'X 轴', font: { size: 13, weight: '600' }, color: '#475569' }
        },
        y: {
          grid: { color: 'rgba(148, 163, 184, 0.2)' },
          ticks: { font: { size: 12 }, color: '#64748b' },
          title: { display: true, text: '残差 (观测值 - 预测值)', font: { size: 13, weight: '600' }, color: '#475569' }
        }
      }
    }
  });
}

function addDataRow(x = '', y = '', w = 1) {
  const tbody = document.getElementById('dataTableBody');
  const rowIndex = tbody.children.length + 1;
  const wVal = (w === '' || w === null || w === undefined) ? 1 : w;
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td>${rowIndex}</td>
    <td><input type="number" step="any" class="x-input" value="${x}" placeholder="X"></td>
    <td><input type="number" step="any" class="y-input" value="${y}" placeholder="Y"></td>
    <td><input type="number" step="any" min="0" class="w-input" value="${wVal}" placeholder="W" title="测量权重，越大影响越大"></td>
    <td><button class="delete-row-btn" title="删除">✕</button></td>
  `;
  tr.querySelector('.delete-row-btn').addEventListener('click', () => {
    tr.remove();
    updateRowNumbers();
    markDirty();
  });
  tr.querySelectorAll('input').forEach(input => {
    input.addEventListener('input', markDirty);
  });
  tbody.appendChild(tr);
}

function updateRowNumbers() {
  const tbody = document.getElementById('dataTableBody');
  Array.from(tbody.children).forEach((tr, idx) => {
    tr.querySelector('td:first-child').textContent = idx + 1;
  });
}

function clearDataTable() {
  const tbody = document.getElementById('dataTableBody');
  tbody.innerHTML = '';
  for (let i = 0; i < 5; i++) {
    addDataRow();
  }
  currentDatasetId = null;
  currentResultId = null;
  clearDirty();
  resetDisplay();
}

function resetDisplay() {
  ['R2', 'MSE', 'RMSE', 'MAE'].forEach(k => {
    document.getElementById('metric' + k + '_unweighted').textContent = '—';
    document.getElementById('metric' + k + '_weighted').textContent = '—';
  });
  document.getElementById('eqFormula_unweighted').textContent = '等待拟合...';
  document.getElementById('eqFormula_weighted').textContent = '等待拟合...';
  document.getElementById('metricDiffRow').style.display = 'none';
  document.getElementById('weightSummary').style.display = 'none';
  document.getElementById('outliersSection').style.display = 'none';

  if (fitChart) {
    fitChart.data.datasets.forEach(ds => {
      ds.data = [];
      if (ds.pointRadius) ds.pointRadius = [];
    });
    fitChart.update();
  }
  if (residualChart) {
    residualChart.data.datasets.forEach(ds => {
      ds.data = [];
      if (ds.pointRadius) ds.pointRadius = [];
    });
    residualChart.update();
  }
}

function getTableData() {
  const tbody = document.getElementById('dataTableBody');
  const points = [];
  const weights = [];
  Array.from(tbody.children).forEach(tr => {
    const xInput = tr.querySelector('.x-input');
    const yInput = tr.querySelector('.y-input');
    const wInput = tr.querySelector('.w-input');
    const x = parseFloat(xInput.value);
    const y = parseFloat(yInput.value);
    let w = parseFloat(wInput.value);
    if (isNaN(w) || w < 0) w = 1;
    if (!isNaN(x) && !isNaN(y)) {
      points.push({ x, y });
      weights.push(w);
    }
  });
  return { points, weights };
}

function setTableData(points, weights) {
  const tbody = document.getElementById('dataTableBody');
  tbody.innerHTML = '';
  points.forEach((p, i) => {
    const w = (weights && weights[i] !== undefined) ? weights[i] : 1;
    addDataRow(p.x, p.y, w);
  });
}

function loadSampleData() {
  const samples = [
    { x: 1, y: 2.1 },
    { x: 2, y: 3.8 },
    { x: 3, y: 6.2 },
    { x: 4, y: 7.9 },
    { x: 5, y: 10.3 },
    { x: 6, y: 11.8 },
    { x: 7, y: 14.5 },
    { x: 8, y: 25.0 },
    { x: 9, y: 18.2 },
    { x: 10, y: 20.1 }
  ];
  const sampleWeights = [5, 5, 4, 4, 3, 3, 2, 1, 3, 4];
  setTableData(samples, sampleWeights);
  document.getElementById('datasetName').value = '示例实验数据';
  currentDatasetId = null;
  currentResultId = null;
  resetDisplay();
  clearDirty();
  showToast('已加载示例数据（附权重）', 'success');
}

function setAllWeights(value) {
  const tbody = document.getElementById('dataTableBody');
  tbody.querySelectorAll('.w-input').forEach(inp => {
    inp.value = value;
  });
  markDirty();
}

function setAscWeights() {
  const tbody = document.getElementById('dataTableBody');
  const rows = tbody.querySelectorAll('tr');
  const n = rows.length;
  rows.forEach((tr, i) => {
    const wInput = tr.querySelector('.w-input');
    if (wInput) wInput.value = (i + 1);
  });
  markDirty();
}

function setDescWeights() {
  const tbody = document.getElementById('dataTableBody');
  const rows = tbody.querySelectorAll('tr');
  const n = rows.length;
  rows.forEach((tr, i) => {
    const wInput = tr.querySelector('.w-input');
    if (wInput) wInput.value = (n - i);
  });
  markDirty();
}

async function performFit() {
  const { points, weights } = getTableData();
  if (points.length < 2) {
    showToast('请至少输入2个有效数据点', 'error');
    return;
  }

  const modelType = document.querySelector('input[name="modelType"]:checked').value;
  const datasetName = document.getElementById('datasetName').value || '未命名数据集';

  const fitBtn = document.getElementById('fitBtn');
  const originalText = fitBtn.textContent;
  fitBtn.textContent = '⏳ 计算中...';
  fitBtn.disabled = true;

  try {
    const res = await fetch('/api/fit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ points, weights, modelType, datasetName, datasetId: currentDatasetId })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '拟合失败');

    displayFitResult(data, weights);
    currentResultId = data.id;
    showToast('拟合完成！', 'success');
    loadHistory();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    fitBtn.textContent = originalText;
    fitBtn.disabled = false;
  }
}

function displayFitResult(result, weights) {
  const unweighted = result.unweighted || { metrics: result.metrics, modelEquation: result.modelEquation };
  const weighted = result.weighted || { metrics: result.metrics, modelEquation: result.modelEquation };

  const uw = unweighted.metrics;
  const ww = weighted.metrics;

  document.getElementById('metricR2_unweighted').textContent = uw.rSquared.toFixed(6);
  document.getElementById('metricMSE_unweighted').textContent = uw.mse.toFixed(6);
  document.getElementById('metricRMSE_unweighted').textContent = uw.rmse.toFixed(6);
  document.getElementById('metricMAE_unweighted').textContent = uw.mae.toFixed(6);

  document.getElementById('metricR2_weighted').textContent = ww.rSquared.toFixed(6);
  document.getElementById('metricMSE_weighted').textContent = ww.mse.toFixed(6);
  document.getElementById('metricRMSE_weighted').textContent = ww.rmse.toFixed(6);
  document.getElementById('metricMAE_weighted').textContent = ww.mae.toFixed(6);

  document.getElementById('eqFormula_unweighted').textContent = unweighted.modelEquation || '—';
  document.getElementById('eqFormula_weighted').textContent = weighted.modelEquation || '—';

  const r2Diff = ww.rSquared - uw.rSquared;
  const rmseDiff = ww.rmse - uw.rmse;
  const r2Pct = (r2Diff / Math.max(Math.abs(uw.rSquared), 1e-12)) * 100;
  const rmsePct = (rmseDiff / Math.max(Math.abs(uw.rmse), 1e-12)) * 100;
  const r2Sign = r2Diff >= 0 ? '+' : '';
  const rmseSign = rmseDiff <= 0 ? '' : '+';

  const diffR2El = document.getElementById('diffR2');
  const diffRMSEEl = document.getElementById('diffRMSE');
  diffR2El.textContent = `${r2Sign}${r2Diff.toFixed(6)} (${r2Sign}${r2Pct.toFixed(2)}%)`;
  diffRMSEEl.textContent = `${rmseSign}${rmseDiff.toFixed(6)} (${rmseSign}${rmsePct.toFixed(2)}%)`;
  diffR2El.className = r2Diff >= 0 ? 'diff-improved' : 'diff-worsened';
  diffRMSEEl.className = rmseDiff <= 0 ? 'diff-improved' : 'diff-worsened';
  document.getElementById('metricDiffRow').style.display = 'block';

  const displayWeights = result.weights || weights;
  if (displayWeights && displayWeights.length > 0) {
    const wArr = displayWeights.map(v => Number(v)).filter(v => !isNaN(v));
    const minW = Math.min(...wArr);
    const maxW = Math.max(...wArr);
    const sumW = wArr.reduce((a, b) => a + b, 0);
    const avgW = sumW / wArr.length;
    const nonUniform = wArr.some(v => Math.abs(v - wArr[0]) > 1e-9);
    document.getElementById('wsInfo').textContent =
      `共 ${wArr.length} 点 · 总和=${sumW.toFixed(2)} · 均值=${avgW.toFixed(2)} · 最小=${minW.toFixed(2)} · 最大=${maxW.toFixed(2)}${nonUniform ? ' · ⚡非均匀权重' : ' · 均匀权重'}`;
    document.getElementById('weightSummary').style.display = 'block';
  }

  const points = result.points;
  const currentWeights = displayWeights || points.map(() => 1);
  const pointRadii = currentWeights.map(w => mapWeightToRadius(w, 4, 16));

  const normalPoints = [];
  const outlierPoints = [];
  const normalRadii = [];
  const outlierRadii = [];

  const usedOutliers = weighted.outliers || result.outliers || [];
  const outlierIndices = new Set(usedOutliers.filter(o => o.isOutlier).map(o => o.index));

  points.forEach((p, i) => {
    if (outlierIndices.has(i)) {
      outlierPoints.push(p);
      outlierRadii.push(pointRadii[i] + 2);
    } else {
      normalPoints.push(p);
      normalRadii.push(pointRadii[i]);
    }
  });

  fitChart.data.datasets[0].data = normalPoints;
  fitChart.data.datasets[0].pointRadius = normalRadii;
  fitChart.data.datasets[1].data = (unweighted.curvePoints || []);
  fitChart.data.datasets[2].data = (weighted.curvePoints || []);
  fitChart.data.datasets[3].data = outlierPoints;
  fitChart.data.datasets[3].pointRadius = outlierRadii;
  fitChart.update();

  const weightedResidualData = points.map((p, i) => ({
    x: p.x,
    y: (weighted.residuals || result.residuals)[i]
  }));
  const unweightedResidualData = points.map((p, i) => ({
    x: p.x,
    y: (unweighted.residuals || result.residuals)[i]
  }));

  const xs = points.map(p => p.x);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const range = maxX - minX || 1;
  const zeroLine = [
    { x: minX - range * 0.1, y: 0 },
    { x: maxX + range * 0.1, y: 0 }
  ];

  residualChart.data.datasets[0].data = weightedResidualData;
  residualChart.data.datasets[0].pointRadius = currentWeights.map(w => mapWeightToRadius(w, 3, 12));
  residualChart.data.datasets[1].data = unweightedResidualData;
  residualChart.data.datasets[1].pointRadius = currentWeights.map(w => mapWeightToRadius(w, 2, 9));
  residualChart.data.datasets[2].data = zeroLine;
  residualChart.update();

  const outliersSection = document.getElementById('outliersSection');
  const outliersList = document.getElementById('outliersList');
  const actualOutliers = usedOutliers.filter(o => o.isOutlier);

  if (actualOutliers.length > 0) {
    outliersSection.style.display = 'block';
    outliersList.innerHTML = actualOutliers.map(o => {
      const p = points[o.index];
      const wt = currentWeights[o.index] || 1;
      return `
        <span class="outlier-badge">
          #${o.index + 1} (x=${p.x.toFixed(3)}, y=${p.y.toFixed(3)}, w=${wt})
          Z=${o.zScore.toFixed(2)}
        </span>
      `;
    }).join('');
  } else {
    outliersSection.style.display = 'none';
  }
}

async function loadHistory() {
  try {
    const res = await fetch('/api/history');
    const history = await res.json();
    const historyList = document.getElementById('historyList');

    if (history.length === 0) {
      historyList.innerHTML = '<div class="empty-state">暂无历史记录</div>';
      return;
    }

    historyList.innerHTML = history.map(h => {
      let hasWeight = false;
      if (typeof h.hasEffectiveWeights === 'boolean') {
        hasWeight = h.hasEffectiveWeights;
      } else {
        const weightsArr = Array.isArray(h.weights) ? h.weights : null;
        hasWeight = !!(weightsArr && weightsArr.length > 0 &&
          weightsArr.some(w => {
            const n = Number(w);
            return !isNaN(n) && Math.abs(n - 1) > 1e-9;
          }));
      }
      const wBadge = hasWeight ? '<span class="history-weight-badge">⚖带权重</span>' : '';
      const uwR2 = h.unweighted?.metrics?.rSquared ?? h.metrics?.rSquared ?? null;
      const wR2 = h.weighted?.metrics?.rSquared ?? h.metrics?.rSquared ?? null;
      const r2Text = (uwR2 !== null && wR2 !== null)
        ? `R²普=${uwR2.toFixed(3)} / R²加=${wR2.toFixed(3)}`
        : (uwR2 !== null ? `R²=${uwR2.toFixed(3)}` : '');
      return `
      <div class="history-item" data-id="${h.id}">
        <div class="history-title">${h.datasetName}${wBadge}</div>
        <span class="history-model">${modelTypeLabels[h.modelType] || h.modelType}</span>
        <div class="history-meta">
          <span>${h.pointsCount} 个点${r2Text ? ' · ' + r2Text : ''}</span>
          <span>${new Date(h.createdAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
        </div>
        <div class="history-actions">
          <button class="btn-load" onclick="loadHistoryItem('${h.id}')">查看</button>
          <button class="btn-delete" onclick="deleteHistoryItem('${h.id}')">删除</button>
        </div>
      </div>
    `}).join('');
  } catch (err) {
    console.error('加载历史失败:', err);
  }
}

async function loadHistoryItem(id) {
  try {
    const res = await fetch(`/api/history/${id}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    document.getElementById('datasetName').value = data.datasetName;
    document.querySelector(`input[name="modelType"][value="${data.modelType}"]`).checked = true;
    setTableData(data.points, data.weights);
    displayFitResult(data, data.weights);
    currentResultId = id;
    currentDatasetId = data.datasetId || null;
    clearDirty();
    showToast('已加载历史记录（含权重）', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteHistoryItem(id) {
  if (!confirm('确定删除这条历史记录吗？')) return;
  try {
    const res = await fetch(`/api/history/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('删除失败');
    if (currentResultId === id) {
      currentResultId = null;
    }
    showToast('已删除', 'success');
    loadHistory();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function loadDatasets() {
  try {
    const res = await fetch('/api/datasets');
    const datasets = await res.json();
    const datasetsList = document.getElementById('datasetsList');

    if (datasets.length === 0) {
      datasetsList.innerHTML = '<div class="empty-state">暂无保存的数据集</div>';
      return;
    }

    datasetsList.innerHTML = datasets.map(d => {
      const weightsArr = Array.isArray(d.weights) ? d.weights : null;
      const hasWeight = !!(weightsArr && weightsArr.length > 0 &&
        weightsArr.some(w => {
          const n = Number(w);
          return !isNaN(n) && Math.abs(n - 1) > 1e-9;
        }));
      const wBadge = hasWeight ? '<span class="history-weight-badge">⚖带权重</span>' : '';
      return `
      <div class="dataset-item" data-id="${d.id}">
        <div class="history-title">${d.name}${wBadge}</div>
        <div class="history-meta">
          <span>${d.points.length} 个点</span>
          <span>${new Date(d.createdAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
        </div>
        <div class="history-actions">
          <button class="btn-load" onclick="loadDataset('${d.id}')">加载</button>
          <button class="btn-delete" onclick="deleteDataset('${d.id}')">删除</button>
        </div>
      </div>
    `}).join('');
  } catch (err) {
    console.error('加载数据集失败:', err);
  }
}

async function saveCurrentDataset() {
  const { points, weights } = getTableData();
  const name = document.getElementById('datasetName').value || '未命名数据集';

  if (points.length < 2) {
    showToast('请至少输入2个有效数据点', 'error');
    return;
  }

  try {
    const res = await fetch('/api/datasets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, points, weights })
    });
    if (!res.ok) throw new Error('保存失败');
    const dataset = await res.json();
    currentDatasetId = dataset.id;
    clearDirty();
    showToast('已另存为新数据集（含权重）', 'success');
    loadDatasets();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function updateCurrentDataset() {
  if (!currentDatasetId) {
    showToast('没有可更新的数据集，请先加载或另存为', 'error');
    return;
  }

  const { points, weights } = getTableData();
  const name = document.getElementById('datasetName').value || '未命名数据集';

  if (points.length < 2) {
    showToast('请至少输入2个有效数据点', 'error');
    return;
  }

  try {
    const res = await fetch(`/api/datasets/${currentDatasetId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, points, weights })
    });
    if (!res.ok) throw new Error('更新失败');
    clearDirty();
    showToast('数据集已更新（含权重）', 'success');
    loadDatasets();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function loadDataset(id) {
  try {
    const res = await fetch('/api/datasets');
    const datasets = await res.json();
    const dataset = datasets.find(d => d.id === id);
    if (!dataset) throw new Error('数据集不存在');

    document.getElementById('datasetName').value = dataset.name;
    setTableData(dataset.points, dataset.weights);
    currentDatasetId = id;
    currentResultId = null;
    resetDisplay();
    clearDirty();
    showToast(dataset.weights ? '已加载数据集（含权重）' : '已加载数据集', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteDataset(id) {
  if (!confirm('确定删除这个数据集吗？')) return;
  try {
    const res = await fetch(`/api/datasets/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('删除失败');
    if (currentDatasetId === id) {
      currentDatasetId = null;
      updateDatasetButtons();
    }
    showToast('已删除', 'success');
    loadDatasets();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function initTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      tabBtns.forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
      document.getElementById('tab-history').style.display = tab === 'history' ? 'block' : 'none';
      document.getElementById('tab-datasets').style.display = tab === 'datasets' ? 'block' : 'none';
    });
  });
}

function initEventListeners() {
  document.getElementById('addRowBtn').addEventListener('click', () => {
    addDataRow();
    markDirty();
  });
  document.getElementById('clearDataBtn').addEventListener('click', () => {
    if (confirm('确定清空所有数据吗？')) clearDataTable();
  });
  document.getElementById('loadSampleBtn').addEventListener('click', loadSampleData);
  document.getElementById('weightAll1Btn').addEventListener('click', () => setAllWeights(1));
  document.getElementById('weightAscBtn').addEventListener('click', setAscWeights);
  document.getElementById('weightDescBtn').addEventListener('click', setDescWeights);
  document.getElementById('fitBtn').addEventListener('click', performFit);
  document.getElementById('saveDatasetBtn').addEventListener('click', saveCurrentDataset);
  document.getElementById('updateDatasetBtn').addEventListener('click', updateCurrentDataset);
  document.getElementById('datasetName').addEventListener('input', markDirty);
}

function init() {
  initCharts();
  initTabs();
  initEventListeners();
  clearDataTable();
  loadHistory();
  loadDatasets();
  updateDatasetButtons();
}

document.addEventListener('DOMContentLoaded', init);
