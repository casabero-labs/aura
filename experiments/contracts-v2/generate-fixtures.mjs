import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATASET_PATH = path.join(__dirname, '../datasets/titanic.csv');
const DATASET_FULL = '/Users/casabero/Documents/GitHub/aura/experiments/datasets/titanic.csv';

// Simple CSV parser (no external deps)
function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
  const data = [];
  
  // Handle quoted fields with commas
  for (let i = 1; i < lines.length; i++) {
    const values = [];
    let current = '';
    let inQuotes = false;
    for (const char of lines[i]) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    
    const row = {};
    headers.forEach((h, idx) => {
      let val = values[idx] || '';
      // Try to parse as number
      const num = parseFloat(val);
      row[h] = (val !== '' && !isNaN(num) && val !== '') ? num : val;
    });
    data.push(row);
  }
  return { data, headers };
}

// Build audit report from data
function runAudit(data, fields, delimiter) {
  const TOXIC_PLACEHOLDERS = ['nan', 'null', 'n/a', '?', 'undefined', 'none', 'nil', 'sin dato', 'no data', '999', 'unknown', '..'];
  
  const colStats = {};
  const rowCount = data.length;
  
  fields.forEach(field => {
    const values = data.map(row => row[field]);
    const nonNulls = values.filter(v => 
      v !== null && v !== undefined && v !== '' && 
      !TOXIC_PLACEHOLDERS.includes(String(v).toLowerCase().trim())
    );
    const numValues = nonNulls.filter(v => typeof v === 'number').map(Number);
    const strValues = nonNulls.filter(v => typeof v === 'string').map(String);
    
    // Frequencies
    const freqMap = new Map();
    nonNulls.forEach(v => {
      const s = String(v);
      freqMap.set(s, (freqMap.get(s) || 0) + 1);
    });
    const sortedFreq = Array.from(freqMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([value, count]) => ({ value, count }));
    
    const sampleIndices = [0, Math.floor(values.length / 2), values.length - 1].filter(i => i >= 0 && i < values.length);
    const sampleValues = sampleIndices.map(i => values[i]).filter(v => v !== null && v !== undefined).slice(0, 3);
    
    let inferredType = 'string';
    if (nonNulls.length > 0) {
      const numPct = numValues.length / nonNulls.length;
      const strPct = strValues.length / nonNulls.length;
      if (numPct > 0.9) inferredType = 'number';
      else if (nonNulls.every(v => typeof v === 'boolean')) inferredType = 'boolean';
      else if (numPct > 0.1 && strPct > 0.1) inferredType = 'mixed';
    }
    
    colStats[field] = {
      name: field,
      inferredType,
      semanticType: undefined,
      nullCount: values.length - nonNulls.length,
      uniqueCount: freqMap.size,
      topFreq: sortedFreq,
      zeros: numValues.filter(n => n === 0).length,
      sampleValues: sampleValues
    };
    
    // Numeric stats
    if (inferredType === 'number' && numValues.length > 0) {
      colStats[field].min = Math.min(...numValues);
      colStats[field].max = Math.max(...numValues);
      const sum = numValues.reduce((a, b) => a + b, 0);
      colStats[field].mean = sum / numValues.length;
      
      const sorted = [...numValues].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      colStats[field].median = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
      
      const variance = numValues.reduce((acc, val) => acc + Math.pow(val - colStats[field].mean, 2), 0) / numValues.length;
      colStats[field].std = Math.sqrt(variance);
      
      if (colStats[field].mean !== 0) {
        colStats[field].cv = colStats[field].std / Math.abs(colStats[field].mean);
      }
      
      // IQR
      const q1 = sorted[Math.floor(sorted.length * 0.25)];
      const q3 = sorted[Math.floor(sorted.length * 0.75)];
      const iqr = q3 - q1;
      colStats[field].q1 = q1;
      colStats[field].q3 = q3;
      colStats[field].iqr = iqr;
      colStats[field].lowerFence = q1 - 3 * iqr;
      colStats[field].upperFence = q3 + 3 * iqr;
      colStats[field].lowerFenceTukey = q1 - 1.5 * iqr;
      colStats[field].upperFenceTukey = q3 + 1.5 * iqr;
      
      const outlierCount = numValues.filter(n => n < colStats[field].lowerFence || n > colStats[field].upperFence).length;
      const outlierCountTukey = numValues.filter(n => n < colStats[field].lowerFenceTukey || n > colStats[field].upperFenceTukey).length;
      colStats[field].outlierCount = outlierCount;
      colStats[field].outlierCountTukey = outlierCountTukey;
      colStats[field].outlierSeverity = outlierCount > 0 ? 'WARNING' : undefined;
    }
  });
  
  // Detect issues
  const issues = [];
  
  // Ghost spaces in Name
  let ghostSpaceCount = 0;
  const ghostSamples = [];
  data.forEach(row => {
    const val = row['Name'];
    if (typeof val === 'string' && val.trim().length !== val.length) {
      ghostSpaceCount++;
      if (ghostSamples.length < 3) ghostSamples.push(val);
    }
  });
  if (ghostSpaceCount > 0) {
    issues.push({
      id: 'hygiene-ghost-Name',
      column: 'Name',
      ruleName: 'Espacios Fantasma (Trim)',
      category: 'Higiene de Texto',
      description: 'Textos con espacios invisibles al inicio/final.',
      severity: 'info',
      count: ghostSpaceCount,
      affectedPercentage: (ghostSpaceCount / rowCount) * 100,
      sampleValues: ghostSamples
    });
  }
  
  // Nulls in Age
  const ageNulls = colStats['Age']?.nullCount || 0;
  if (ageNulls > rowCount * 0.05) {
    issues.push({
      id: 'integrity-null-Age',
      column: 'Age',
      ruleName: 'Valores Nulos / Vacíos',
      category: 'Integridad y Estructura',
      description: ageNulls > rowCount * 0.2 ? `Crítico: ${((ageNulls / rowCount) * 100).toFixed(1)}% de datos faltantes.` : 'Advertencia: Faltan datos.',
      severity: ageNulls > rowCount * 0.2 ? 'critical' : 'warning',
      count: ageNulls,
      affectedPercentage: (ageNulls / rowCount) * 100,
      sampleValues: []
    });
  }
  
  // Nulls in Cabin
  const cabinNulls = colStats['Cabin']?.nullCount || 0;
  if (cabinNulls > rowCount * 0.05) {
    issues.push({
      id: 'integrity-null-Cabin',
      column: 'Cabin',
      ruleName: 'Valores Nulos / Vacíos',
      category: 'Integridad y Estructura',
      description: cabinNulls > rowCount * 0.2 ? `Crítico: ${((cabinNulls / rowCount) * 100).toFixed(1)}% de datos faltantes.` : 'Advertencia: Faltan datos.',
      severity: cabinNulls > rowCount * 0.2 ? 'critical' : 'warning',
      count: cabinNulls,
      affectedPercentage: (cabinNulls / rowCount) * 100,
      sampleValues: []
    });
  }
  
  // Outliers in Age
  if (colStats['Age']?.outlierCount > 0) {
    issues.push({
      id: 'logic-outlier-Age',
      column: 'Age',
      ruleName: 'Outliers Extremos (IQR 3×)',
      category: 'Validez y Lógica de Negocio',
      description: 'Valores desviados > 3× del rango intercuartílico.',
      severity: 'warning',
      count: colStats['Age'].outlierCount,
      affectedPercentage: (colStats['Age'].outlierCount / rowCount) * 100,
      sampleValues: data.filter(row => {
        const age = row['Age'];
        return typeof age === 'number' && (age < colStats['Age'].lowerFence || age > colStats['Age'].upperFence);
      }).slice(0, 3).map(r => r['Age'])
    });
  }
  
  // Outliers in SibSp
  if (colStats['SibSp']?.outlierCount > 0) {
    issues.push({
      id: 'logic-outlier-SibSp',
      column: 'SibSp',
      ruleName: 'Outliers Extremos (IQR 3×)',
      category: 'Validez y Lógica de Negocio',
      description: 'Valores desviados > 3× del rango intercuartílico.',
      severity: 'warning',
      count: colStats['SibSp'].outlierCount,
      affectedPercentage: (colStats['SibSp'].outlierCount / rowCount) * 100,
      sampleValues: data.filter(row => {
        const v = row['SibSp'];
        return typeof v === 'number' && (v < colStats['SibSp'].lowerFence || v > colStats['SibSp'].upperFence);
      }).slice(0, 3).map(r => r['SibSp'])
    });
  }
  
  // Outliers in Fare
  if (colStats['Fare']?.outlierCount > 0) {
    issues.push({
      id: 'logic-outlier-Fare',
      column: 'Fare',
      ruleName: 'Outliers Extremos (IQR 3×)',
      category: 'Validez y Lógica de Negocio',
      description: 'Valores desviados > 3× del rango intercuartílico.',
      severity: 'warning',
      count: colStats['Fare'].outlierCount,
      affectedPercentage: (colStats['Fare'].outlierCount / rowCount) * 100,
      sampleValues: data.filter(row => {
        const v = row['Fare'];
        return typeof v === 'number' && (v < colStats['Fare'].lowerFence || v > colStats['Fare'].upperFence);
      }).slice(0, 3).map(r => r['Fare'])
    });
  }
  
  // Long tail in Name (categorical)
  const nameUniqueCount = colStats['Name']?.uniqueCount || 0;
  const nameCardinalityRatio = nameUniqueCount / rowCount;
  if (rowCount >= 30 && nameUniqueCount >= 20 && nameCardinalityRatio >= 0.35) {
    issues.push({
      id: 'semantic-long-tail-Name',
      column: 'Name',
      category: 'Semántica y Seguridad',
      ruleName: 'Cola Larga Categórica',
      description: 'La columna tiene alta dispersión de categorías y baja concentración en los valores principales. Puede necesitar agrupación o macro-categorías antes del análisis.',
      severity: 'info',
      count: nameUniqueCount,
      affectedPercentage: nameCardinalityRatio * 100,
      sampleValues: colStats['Name']?.topFreq?.map(item => item.value) || []
    });
  }
  
  // Duplicates
  const hashSet = new Set();
  let duplicateCount = 0;
  data.forEach(row => {
    const h = JSON.stringify(row);
    if (hashSet.has(h)) duplicateCount++;
    else hashSet.add(h);
  });
  
  let penaltyPoints = 0;
  if (duplicateCount > 0) {
    const pct = (duplicateCount / rowCount) * 100;
    const points = Math.min(15, Math.ceil(pct));
    penaltyPoints += points;
  }
  
  // Calculate score
  let normalizedPenalty = penaltyPoints;
  if (rowCount < 100) normalizedPenalty = penaltyPoints * 1.5;
  else if (rowCount > 10000) normalizedPenalty = penaltyPoints / 2;
  const totalScore = Math.max(0, Math.min(100, Math.round(100 - normalizedPenalty)));
  
  return {
    score: totalScore,
    rowCount,
    colCount: fields.length,
    duplicateRows: duplicateCount,
    issues,
    columnStats: colStats,
    scoreBreakdown: [],
    delimiterDetected: delimiter,
    datasetProfile: {
      totalRows: rowCount,
      totalColumns: fields.length,
      columns: fields.map(name => ({
        name,
        cardinality: nameUniqueCount === 1 ? 'constant' : (nameUniqueCount / rowCount < 0.05 ? 'low' : 'high'),
        uniqueRatio: nameUniqueCount / rowCount,
        sparsity: (colStats[name]?.nullCount || 0) / rowCount,
        inferredType: colStats[name]?.inferredType || 'string',
        semanticType: colStats[name]?.semanticType,
        isCandidateForCoalescence: false,
        pruneRecommendation: 'keep'
      })),
      coalescencePairs: [],
      pruningCandidates: [],
      generatedAt: new Date().toISOString()
    }
  };
}

// Generate fingerprint
function generateFingerprint(data, headers) {
  const content = JSON.stringify({ headers, rowCount: data.length, sample: data.slice(0, 5) });
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `fp_${Math.abs(hash).toString(16)}`;
}

// Main
console.log('Loading Titanic dataset from:', DATASET_FULL);
const { data, headers } = parseCSV(DATASET_FULL);
console.log(`Loaded ${data.length} rows, ${headers.length} columns`);

const report = runAudit(data, headers, ',');
const fingerprint = generateFingerprint(data, headers);

// Save AuditReport fixture
const fixtureDir = path.join(__dirname, 'fixtures');
fs.mkdirSync(fixtureDir, { recursive: true });

fs.writeFileSync(
  path.join(fixtureDir, 'titanic-audit-report.json'),
  JSON.stringify(report, null, 2)
);
console.log('Saved: titanic-audit-report.json');

// Save metadata
const metadata = {
  nombre: 'titanic',
  filas: data.length,
  columnas: headers.length,
  fingerprint,
  fechaDeGeneracion: new Date().toISOString(),
  commitSha: fs.existsSync(path.join(__dirname, '../../.git/HEAD')) 
    ? fs.readFileSync(path.join(__dirname, '../../.git/HEAD'), 'utf-8').trim()
    : 'unknown',
  versionDelFixture: '1.0.0',
  origenDataset: 'https://raw.githubusercontent.com/datasciencedojo/datasets/master/titanic.csv'
};

fs.writeFileSync(
  path.join(fixtureDir, 'titanic-dataset-metadata.json'),
  JSON.stringify(metadata, null, 2)
);
console.log('Saved: titanic-dataset-metadata.json');
console.log('Fingerprint:', fingerprint);
console.log('Done!');
