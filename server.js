const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const math = require('mathjs');

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_DIR = path.join(__dirname, 'data');
const DATASETS_FILE = path.join(DATA_DIR, 'datasets.json');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

function ensureDataFiles() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DATASETS_FILE)) {
    fs.writeFileSync(DATASETS_FILE, JSON.stringify([], null, 2));
  }
  if (!fs.existsSync(HISTORY_FILE)) {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify([], null, 2));
  }
}
ensureDataFiles();

function readJsonFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (e) {
    return [];
  }
}

function writeJsonFile(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

function sanitizeAndNormalizePoints(points) {
  if (!Array.isArray(points)) return [];
  const parsed = points
    .map(p => {
      if (!p || typeof p !== 'object') return null;
      let x = p.x, y = p.y;
      if (typeof x === 'string') x = x.trim();
      if (typeof y === 'string') y = y.trim();
      const nx = Number(x);
      const ny = Number(y);
      if (isNaN(nx) || isNaN(ny)) return null;
      if (!isFinite(nx) || !isFinite(ny)) return null;
      return { x: nx, y: ny };
    })
    .filter(Boolean);

  if (parsed.length >= 4) {
    const ys = parsed.map(p => p.y).sort((a, b) => a - b);
    const q1 = ys[Math.floor(ys.length * 0.25)];
    const q3 = ys[Math.floor(ys.length * 0.75)];
    const iqr = q3 - q1;
    const lower = q1 - 10 * iqr;
    const upper = q3 + 10 * iqr;
    const filtered = parsed.filter(p => p.y >= lower && p.y <= upper);
    if (filtered.length !== parsed.length) {
      console.log(`[数据清洗] 过滤 ${parsed.length - filtered.length} 个极端异常Y值点 (IQR×10 范围外)`);
      return filtered;
    }
  }
  return parsed;
}

function sanitizeAndNormalizeWeights(weights, pointsLen) {
  if (!Array.isArray(weights) || weights.length !== pointsLen) {
    return null;
  }
  const normalized = weights.map(w => {
    const n = Number(w);
    if (isNaN(n) || !isFinite(n) || n < 0) return 1;
    return n;
  });
  const allOne = normalized.every(v => Math.abs(v - 1) < 1e-9);
  return allOne ? null : normalized;
}

function sanitizeStoredData() {
  try {
    const datasets = readJsonFile(DATASETS_FILE);
    if (Array.isArray(datasets) && datasets.length > 0) {
      let changed = false;
      const cleanDatasets = datasets.map(d => {
        if (!d || typeof d !== 'object') { changed = true; return null; }
        const cleanPoints = sanitizeAndNormalizePoints(d.points);
        if (cleanPoints.length !== (Array.isArray(d.points) ? d.points.length : 0)) {
          changed = true;
        }
        const cleanWeights = sanitizeAndNormalizeWeights(d.weights, cleanPoints.length);
        if ((cleanWeights === null) !== (d.weights === null || d.weights === undefined)) {
          changed = true;
        }
        return {
          id: d.id || generateId(),
          name: typeof d.name === 'string' && d.name.trim() ? d.name : '未命名数据集',
          points: cleanPoints,
          weights: cleanWeights,
          createdAt: d.createdAt || new Date().toISOString(),
          updatedAt: d.updatedAt || undefined
        };
      }).filter(Boolean);
      if (changed || cleanDatasets.length !== datasets.length) {
        writeJsonFile(DATASETS_FILE, cleanDatasets);
        console.log(`[数据清洗] 数据集已清理：${datasets.length} → ${cleanDatasets.length}`);
      }
    }

    const history = readJsonFile(HISTORY_FILE);
    if (Array.isArray(history) && history.length > 0) {
      let changed = false;
      const cleanHistory = history.map(h => {
        if (!h || typeof h !== 'object') { changed = true; return null; }
        const cleanPoints = sanitizeAndNormalizePoints(h.points);
        if (cleanPoints.length !== (Array.isArray(h.points) ? h.points.length : 0)) {
          changed = true;
        }
        const cleanWeights = sanitizeAndNormalizeWeights(h.weights, cleanPoints.length);
        if ((cleanWeights === null) !== (h.weights === null || h.weights === undefined)) {
          changed = true;
        }
        const unweighted = h.unweighted && typeof h.unweighted === 'object' ? h.unweighted : null;
        const weighted = h.weighted && typeof h.weighted === 'object' ? h.weighted : null;
        if (!unweighted || !weighted) {
          changed = true;
        }
        return {
          id: h.id || generateId(),
          datasetId: h.datasetId || null,
          datasetName: typeof h.datasetName === 'string' && h.datasetName.trim() ? h.datasetName : '未命名数据集',
          modelType: h.modelType || 'linear',
          points: cleanPoints,
          weights: cleanWeights,
          params: h.params || null,
          modelEquation: h.modelEquation || '',
          metrics: h.metrics || null,
          residuals: Array.isArray(h.residuals) ? h.residuals : [],
          outliers: Array.isArray(h.outliers) ? h.outliers : [],
          curvePoints: Array.isArray(h.curvePoints) ? h.curvePoints : [],
          unweighted: unweighted || {
            params: h.params || null,
            modelEquation: h.modelEquation || '',
            metrics: h.metrics || null,
            residuals: Array.isArray(h.residuals) ? h.residuals : [],
            outliers: Array.isArray(h.outliers) ? h.outliers : [],
            curvePoints: Array.isArray(h.curvePoints) ? h.curvePoints : []
          },
          weighted: weighted || {
            params: h.params || null,
            modelEquation: h.modelEquation || '',
            metrics: h.metrics || null,
            residuals: Array.isArray(h.residuals) ? h.residuals : [],
            outliers: Array.isArray(h.outliers) ? h.outliers : [],
            curvePoints: Array.isArray(h.curvePoints) ? h.curvePoints : []
          },
          createdAt: h.createdAt || new Date().toISOString()
        };
      }).filter(Boolean);
      if (changed || cleanHistory.length !== history.length) {
        writeJsonFile(HISTORY_FILE, cleanHistory);
        console.log(`[数据清洗] 历史记录已清理：${history.length} → ${cleanHistory.length}`);
      }
    }
  } catch (e) {
    console.error('[数据清洗] 失败:', e.message);
  }
}
sanitizeStoredData();

function linearRegression(points) {
  const n = points.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  points.forEach(p => {
    sumX += p.x;
    sumY += p.y;
    sumXY += p.x * p.y;
    sumXX += p.x * p.x;
  });
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  return { a: slope, b: intercept };
}

function exponentialRegression(points) {
  const invalidPoints = points.filter(p => p.y <= 0);
  if (invalidPoints.length > 0) {
    const indices = invalidPoints.map((_, i) => {
      const idx = points.indexOf(invalidPoints[i]) + 1;
      return `#${idx}(y=${invalidPoints[i].y})`;
    }).join(', ');
    throw new Error(`指数拟合要求所有Y值必须大于0，存在非法点: ${indices}`);
  }
  const n = points.length;
  const logPoints = points.map(p => ({ x: p.x, y: Math.log(p.y) }));
  const linearResult = linearRegression(logPoints);
  return { a: Math.exp(linearResult.b), b: linearResult.a };
}

function quadraticRegression(points) {
  const n = points.length;
  const rows = points.map(p => [p.x * p.x, p.x, 1]);
  const A = math.matrix(rows);
  const b = math.matrix(points.map(p => p.y));
  const AT = math.transpose(A);
  const ATA = math.multiply(AT, A);
  const ATb = math.multiply(AT, b);
  try {
    const ATAInv = math.inv(ATA);
    const x = math.multiply(ATAInv, ATb);
    const result = x.toArray();
    return { a: result[0], b: result[1], c: result[2] };
  } catch (e) {
    throw new Error('二次曲线拟合失败：系数矩阵奇异，数据可能共线或点不足');
  }
}

function weightedLinearRegression(points, weights) {
  const n = points.length;
  let sumW = 0, sumWX = 0, sumWY = 0, sumWXY = 0, sumWXX = 0;
  for (let i = 0; i < n; i++) {
    const w = weights[i] > 0 ? weights[i] : 0;
    const p = points[i];
    sumW += w;
    sumWX += w * p.x;
    sumWY += w * p.y;
    sumWXY += w * p.x * p.y;
    sumWXX += w * p.x * p.x;
  }
  if (sumW <= 0) {
    return linearRegression(points);
  }
  const denom = sumW * sumWXX - sumWX * sumWX;
  if (Math.abs(denom) < 1e-15) {
    return linearRegression(points);
  }
  const slope = (sumW * sumWXY - sumWX * sumWY) / denom;
  const intercept = (sumWY - slope * sumWX) / sumW;
  return { a: slope, b: intercept };
}

function weightedExponentialRegression(points, weights) {
  const invalidPoints = points.filter(p => p.y <= 0);
  if (invalidPoints.length > 0) {
    const indices = invalidPoints.map((_, i) => {
      const idx = points.indexOf(invalidPoints[i]) + 1;
      return `#${idx}(y=${invalidPoints[i].y})`;
    }).join(', ');
    throw new Error(`指数拟合要求所有Y值必须大于0，存在非法点: ${indices}`);
  }
  const n = points.length;
  const logPoints = points.map(p => ({ x: p.x, y: Math.log(p.y) }));
  const linearResult = weightedLinearRegression(logPoints, weights);
  return { a: Math.exp(linearResult.b), b: linearResult.a };
}

function weightedQuadraticRegression(points, weights) {
  const n = points.length;
  const hasEffectiveWeight = weights.some(w => w > 0);
  if (!hasEffectiveWeight) {
    return quadraticRegression(points);
  }
  const sqrtWeights = weights.map(w => Math.sqrt(Math.max(w, 0)));
  const rows = points.map((p, i) => [
    sqrtWeights[i] * p.x * p.x,
    sqrtWeights[i] * p.x,
    sqrtWeights[i]
  ]);
  const A = math.matrix(rows);
  const b = math.matrix(points.map((p, i) => sqrtWeights[i] * p.y));
  const AT = math.transpose(A);
  const ATA = math.multiply(AT, A);
  const ATb = math.multiply(AT, b);
  try {
    const ATAInv = math.inv(ATA);
    const x = math.multiply(ATAInv, ATb);
    const result = x.toArray();
    return { a: result[0], b: result[1], c: result[2] };
  } catch (e) {
    throw new Error('加权二次曲线拟合失败：系数矩阵奇异，数据可能共线或权重配置异常');
  }
}

function calculateWeightedMetrics(points, weights, modelType, params) {
  const n = points.length;
  let yMean = 0;
  let totalW = 0;
  for (let i = 0; i < n; i++) {
    const w = weights[i] > 0 ? weights[i] : 0;
    yMean += w * points[i].y;
    totalW += w;
  }
  if (totalW > 0) {
    yMean /= totalW;
  } else {
    points.forEach(p => yMean += p.y);
    yMean /= n;
  }

  let ssTotal = 0;
  let ssResidual = 0;
  const residuals = [];
  let maeSum = 0;
  let rmseSum = 0;
  let effectiveCount = 0;

  for (let i = 0; i < n; i++) {
    const p = points[i];
    const w = weights[i] > 0 ? weights[i] : 0;
    let predicted;
    switch (modelType) {
      case 'linear':
        predicted = params.a * p.x + params.b;
        break;
      case 'exponential':
        predicted = params.a * Math.exp(params.b * p.x);
        break;
      case 'quadratic':
        predicted = params.a * p.x * p.x + params.b * p.x + params.c;
        break;
    }
    const residual = p.y - predicted;
    residuals.push(residual);
    ssResidual += w * residual * residual;
    ssTotal += w * (p.y - yMean) * (p.y - yMean);
    maeSum += w * Math.abs(residual);
    rmseSum += w * residual * residual;
    if (w > 0) effectiveCount += w;
  }

  const denom = totalW > 0 ? totalW : n;
  const effDenom = effectiveCount > 0 ? effectiveCount : n;

  const rSquared = ssTotal > 0 ? 1 - (ssResidual / ssTotal) : 0;
  const mse = ssResidual / denom;
  const rmse = Math.sqrt(rmseSum / denom);
  const mae = maeSum / effDenom;

  const residualStd = math.std(residuals);

  const outliers = residuals.map((r, i) => {
    const zScore = Math.abs(r - math.mean(residuals)) / (residualStd || 1);
    return { index: i, isOutlier: zScore > 2, zScore: zScore, residual: r };
  });

  return { rSquared, mse, rmse, mae, residuals, outliers };
}

function calculateMetrics(points, modelType, params) {
  const n = points.length;
  let yMean = 0;
  points.forEach(p => yMean += p.y);
  yMean /= n;

  let ssTotal = 0;
  let ssResidual = 0;
  const residuals = [];
  let maeSum = 0;
  let rmseSum = 0;

  points.forEach(p => {
    let predicted;
    switch (modelType) {
      case 'linear':
        predicted = params.a * p.x + params.b;
        break;
      case 'exponential':
        predicted = params.a * Math.exp(params.b * p.x);
        break;
      case 'quadratic':
        predicted = params.a * p.x * p.x + params.b * p.x + params.c;
        break;
    }
    const residual = p.y - predicted;
    residuals.push(residual);
    ssResidual += residual * residual;
    ssTotal += (p.y - yMean) * (p.y - yMean);
    maeSum += Math.abs(residual);
    rmseSum += residual * residual;
  });

  const rSquared = 1 - (ssResidual / ssTotal);
  const mse = ssResidual / n;
  const rmse = Math.sqrt(rmseSum / n);
  const mae = maeSum / n;

  const residualStd = math.std(residuals);

  const outliers = residuals.map((r, i) => {
    const zScore = Math.abs(r - math.mean(residuals)) / residualStd;
    return { index: i, isOutlier: zScore > 2, zScore: zScore, residual: r };
  });

  return { rSquared, mse, rmse, mae, residuals, outliers };
}

function generateCurvePoints(points, modelType, params, numPoints = 100) {
  const xs = points.map(p => p.x);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const range = maxX - minX || 1;
  const extendedMin = minX - range * 0.1;
  const extendedMax = maxX + range * 0.1;
  const step = (extendedMax - extendedMin) / (numPoints - 1);
  const curvePoints = [];
  for (let i = 0; i < numPoints; i++) {
    const x = extendedMin + i * step;
    let y;
    switch (modelType) {
      case 'linear':
        y = params.a * x + params.b;
        break;
      case 'exponential':
        y = params.a * Math.exp(params.b * x);
        break;
      case 'quadratic':
        y = params.a * x * x + params.b * x + params.c;
        break;
    }
    curvePoints.push({ x, y });
  }
  return curvePoints;
}

app.get('/api/datasets', (req, res) => {
  const datasets = readJsonFile(DATASETS_FILE);
  res.json(datasets);
});

app.post('/api/datasets', (req, res) => {
  const { name, points, weights } = req.body;
  if (!name || !points || !Array.isArray(points)) {
    return res.status(400).json({ error: '缺少必要参数' });
  }
  const datasets = readJsonFile(DATASETS_FILE);
  const dataset = {
    id: generateId(),
    name,
    points,
    weights: weights || null,
    createdAt: new Date().toISOString()
  };
  datasets.push(dataset);
  writeJsonFile(DATASETS_FILE, datasets);
  res.json(dataset);
});

app.put('/api/datasets/:id', (req, res) => {
  const { id } = req.params;
  const { name, points, weights } = req.body;
  const datasets = readJsonFile(DATASETS_FILE);
  const index = datasets.findIndex(d => d.id === id);
  if (index === -1) {
    return res.status(404).json({ error: '数据集不存在' });
  }
  datasets[index].name = name || datasets[index].name;
  datasets[index].points = points || datasets[index].points;
  if (weights !== undefined) {
    datasets[index].weights = weights;
  }
  datasets[index].updatedAt = new Date().toISOString();
  writeJsonFile(DATASETS_FILE, datasets);
  res.json(datasets[index]);
});

app.delete('/api/datasets/:id', (req, res) => {
  const { id } = req.params;
  let datasets = readJsonFile(DATASETS_FILE);
  const initialLength = datasets.length;
  datasets = datasets.filter(d => d.id !== id);
  if (datasets.length === initialLength) {
    return res.status(404).json({ error: '数据集不存在' });
  }
  writeJsonFile(DATASETS_FILE, datasets);
  res.json({ success: true });
});

app.post('/api/fit', (req, res) => {
  const { datasetId, points, weights: rawWeights, modelType, datasetName } = req.body;
  if (!points || !Array.isArray(points) || points.length < 2) {
    return res.status(400).json({ error: '至少需要2个数据点' });
  }
  if (!modelType) {
    return res.status(400).json({ error: '请选择拟合模型' });
  }

  const weights = (rawWeights && Array.isArray(rawWeights) && rawWeights.length === points.length)
    ? rawWeights.map(w => {
        const num = parseFloat(w);
        return (!isNaN(num) && num >= 0) ? num : 1;
      })
    : points.map(() => 1);

  function buildEquation(modelType, params) {
    switch (modelType) {
      case 'linear':
        return `y = ${params.a.toFixed(6)}x + ${params.b.toFixed(6)}`;
      case 'exponential':
        return `y = ${params.a.toFixed(6)} · e^(${params.b.toFixed(6)}x)`;
      case 'quadratic':
        return `y = ${params.a.toFixed(6)}x² + ${params.b.toFixed(6)}x + ${params.c.toFixed(6)}`;
      default:
        return '';
    }
  }

  let unweightedParams, weightedParams;
  let unweightedEquation, weightedEquation;

  try {
    switch (modelType) {
      case 'linear':
        unweightedParams = linearRegression(points);
        weightedParams = weightedLinearRegression(points, weights);
        break;
      case 'exponential':
        unweightedParams = exponentialRegression(points);
        weightedParams = weightedExponentialRegression(points, weights);
        break;
      case 'quadratic':
        unweightedParams = quadraticRegression(points);
        weightedParams = weightedQuadraticRegression(points, weights);
        break;
      default:
        return res.status(400).json({ error: '不支持的模型类型' });
    }
    unweightedEquation = buildEquation(modelType, unweightedParams);
    weightedEquation = buildEquation(modelType, weightedParams);
  } catch (e) {
    return res.status(400).json({ error: '拟合计算失败: ' + e.message });
  }

  const unweightedMetrics = calculateMetrics(points, modelType, unweightedParams);
  const weightedMetrics = calculateWeightedMetrics(points, weights, modelType, weightedParams);

  const unweightedCurvePoints = generateCurvePoints(points, modelType, unweightedParams);
  const weightedCurvePoints = generateCurvePoints(points, modelType, weightedParams);

  const result = {
    id: generateId(),
    datasetId: datasetId || null,
    datasetName: datasetName || '未命名数据集',
    modelType,
    points,
    weights,
    unweighted: {
      params: unweightedParams,
      modelEquation: unweightedEquation,
      metrics: {
        rSquared: unweightedMetrics.rSquared,
        mse: unweightedMetrics.mse,
        rmse: unweightedMetrics.rmse,
        mae: unweightedMetrics.mae
      },
      residuals: unweightedMetrics.residuals,
      outliers: unweightedMetrics.outliers,
      curvePoints: unweightedCurvePoints
    },
    weighted: {
      params: weightedParams,
      modelEquation: weightedEquation,
      metrics: {
        rSquared: weightedMetrics.rSquared,
        mse: weightedMetrics.mse,
        rmse: weightedMetrics.rmse,
        mae: weightedMetrics.mae
      },
      residuals: weightedMetrics.residuals,
      outliers: weightedMetrics.outliers,
      curvePoints: weightedCurvePoints
    },
    modelEquation: weightedEquation,
    params: weightedParams,
    metrics: {
      rSquared: weightedMetrics.rSquared,
      mse: weightedMetrics.mse,
      rmse: weightedMetrics.rmse,
      mae: weightedMetrics.mae
    },
    residuals: weightedMetrics.residuals,
    outliers: weightedMetrics.outliers,
    curvePoints: weightedCurvePoints,
    createdAt: new Date().toISOString()
  };

  const history = readJsonFile(HISTORY_FILE);
  history.unshift(result);
  if (history.length > 50) {
    history.length = 50;
  }
  writeJsonFile(HISTORY_FILE, history);

  res.json(result);
});

app.get('/api/history', (req, res) => {
  const history = readJsonFile(HISTORY_FILE);
  const summaries = history.map(h => {
    const uw = h.unweighted || { metrics: h.metrics, modelEquation: h.modelEquation };
    const ww = h.weighted || { metrics: h.metrics, modelEquation: h.modelEquation };
    const weightsArr = Array.isArray(h.weights) ? h.weights : null;
    const hasEffectiveWeights = weightsArr && weightsArr.length > 0 &&
      weightsArr.some(w => {
        const n = Number(w);
        return !isNaN(n) && Math.abs(n - 1) > 1e-9;
      });
    return {
      id: h.id,
      datasetId: h.datasetId,
      datasetName: h.datasetName,
      modelType: h.modelType,
      modelEquation: h.modelEquation,
      metrics: h.metrics,
      unweighted: {
        metrics: uw.metrics,
        modelEquation: uw.modelEquation
      },
      weighted: {
        metrics: ww.metrics,
        modelEquation: ww.modelEquation
      },
      weights: weightsArr,
      hasEffectiveWeights: !!hasEffectiveWeights,
      pointsCount: h.points.length,
      createdAt: h.createdAt
    };
  });
  res.json(summaries);
});

app.get('/api/history/:id', (req, res) => {
  const { id } = req.params;
  const history = readJsonFile(HISTORY_FILE);
  const result = history.find(h => h.id === id);
  if (!result) {
    return res.status(404).json({ error: '记录不存在' });
  }
  res.json(result);
});

app.delete('/api/history/:id', (req, res) => {
  const { id } = req.params;
  let history = readJsonFile(HISTORY_FILE);
  const initialLength = history.length;
  history = history.filter(h => h.id !== id);
  if (history.length === initialLength) {
    return res.status(404).json({ error: '记录不存在' });
  }
  writeJsonFile(HISTORY_FILE, history);
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`实验曲线拟合台 服务器已启动: http://localhost:${PORT}`);
});
