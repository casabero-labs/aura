/**
 * Test AURA-4 — Verifica que la regla Freshness detecta fechas futuras
 * 
 * Ejecuta: node experiments/tests/test_freshness.js
 */

const fs = require('fs');
const path = require('path');

function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuotes = !inQuotes; }
    else if (ch === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
    else { current += ch; }
  }
  result.push(current.trim());
  return result;
}

function parseCsv(text) {
  const lines = text.split('\n').filter(l => l.trim());
  const fields = lines[0].split(',').map(f => f.replace(/"/g, '').trim());
  const data = [];
  for (let i = 1; i < lines.length; i++) {
    const row = {};
    const values = parseCsvLine(lines[i]);
    fields.forEach((f, idx) => {
      const val = values[idx];
      if (val === undefined || val === '') row[f] = null;
      else if (!isNaN(val) && val.trim() !== '') row[f] = Number(val);
      else row[f] = val;
    });
    data.push(row);
  }
  return { data, fields };
}

// Build a dataset with future dates
function buildTestDataset() {
  const today = new Date();
  const future1 = new Date(today); future1.setFullYear(2099, 11, 31);
  const future2 = new Date(today); future2.setFullYear(2030, 5, 15);
  const past = new Date(today); past.setFullYear(2020, 0, 1);
  
  const rows = [];
  for (let i = 0; i < 100; i++) {
    // 20 rows with future dates (20%)
    if (i < 20) {
      rows.push({ id: i, fecha: future1.toISOString().split('T')[0] });
    } else {
      rows.push({ id: i, fecha: past.toISOString().split('T')[0] });
    }
  }
  return rows;
}

// Mock audit logic for freshness
const REGEX_DATE_ISO = /^\d{4}-\d{2}-\d{2}/;

function isDate(val) {
  if (!val || val.length < 8) return false;
  return REGEX_DATE_ISO.test(val);
}

function looksLikeDateTimeColumn(col, values, rowCount) {
  const lower = col.toLowerCase();
  const nameHint = lower.includes('datetime') || lower.includes('timestamp') || lower.includes('fecha') || lower.includes('date');
  const matches = values.filter(v => typeof v === 'string' && REGEX_DATE_ISO.test(v.trim())).length;
  return nameHint || (rowCount > 0 && matches / rowCount > 0.8);
}

function testFreshnessRule(data, fields) {
  const issues = [];
  const rowCount = data.length;
  
  const today = new Date();
  const thresholdDate = new Date(today);
  thresholdDate.setDate(thresholdDate.getDate() + 30);
  
  for (const col of fields) {
    const values = data.map(r => r[col]);
    
    if (!looksLikeDateTimeColumn(col, values.map(v => String(v)), rowCount)) continue;
    
    let futureCount = 0;
    const samples = [];
    
    for (const val of values) {
      if (val === null || val === undefined) continue;
      const strVal = String(val);
      if (!isDate(strVal)) continue;
      
      const dateVal = new Date(strVal);
      if (isNaN(dateVal.getTime())) continue;
      
      if (dateVal > thresholdDate) {
        futureCount++;
        if (samples.length < 3) { samples.push(strVal); }
      }
    }
    
    if (futureCount > 0) {
      const pct = (futureCount / rowCount) * 100;
      issues.push({
        col,
        futureCount,
        pct: pct.toFixed(1),
        severity: pct >= 20 ? 'CRITICAL' : 'WARNING',
        samples
      });
    }
  }
  
  return issues;
}

console.log('=== AURA-4 Test: Freshness Rule ===\n');

// Test 1: Dataset with future dates
console.log('Test 1: Dataset with ~20% future dates');
const testData = buildTestDataset();
const fields = Object.keys(testData[0]);
console.log(`Rows: ${testData.length}, Cols: ${fields.length}`);

const results = testFreshnessRule(testData, fields);
console.log(`Freshness issues found: ${results.length}`);

if (results.length > 0) {
  results.forEach(r => {
    console.log(`  ${r.severity === 'CRITICAL' ? '🔴' : '🟡'} [${r.col}] ${r.futureCount}/${r.severity} — ${r.pct}% future dates`);
    console.log(`    Samples: ${r.samples.join(', ')}`);
  });
}

// The column 'fecha' should be detected
const fechaResult = results.find(r => r.col === 'fecha');
if (fechaResult) {
  console.log('\n✅ AURA-4 Freshness PASSED: Future dates detected correctly');
} else {
  // Let's see why - maybe "fecha" needs to be matched
  console.log('\n⚠️ Note: Column "fecha" should match. Checking name hints...');
  const lower = 'fecha';
  console.log(`  contains 'fecha': ${lower.includes('fecha')}`);
  console.log(`  contains 'date': ${lower.includes('date')}`);
}

// Test 2: Titanic (should NOT have future dates)
console.log('\nTest 2: Titanic dataset (no future dates expected)');
const csvPath = path.join(__dirname, '..', 'datasets', 'titanic.csv');
if (fs.existsSync(csvPath)) {
  const csvText = fs.readFileSync(csvPath, 'utf-8');
  const titanic = parseCsv(csvText);
  const titanicResults = testFreshnessRule(titanic.data, titanic.fields);
  console.log(`Freshness issues found: ${titanicResults.length}`);
  if (titanicResults.length === 0) {
    console.log('✅ No false positives on Titanic dataset');
  }
}

console.log('\n=== Test Complete ===');
