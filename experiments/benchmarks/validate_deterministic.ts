import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';
import { runAudit } from '../../src/services/auditEngine';
import { AuditReport, QualityIssue } from '../../src/types';

// Leer archivos
const datasetPath = path.join(__dirname, '../datasets/synthetic_ground_truth.csv');
const truthPath = path.join(__dirname, '../datasets/synthetic_ground_truth.json');

const csvContent = fs.readFileSync(datasetPath, 'utf8');
const truthContent = JSON.parse(fs.readFileSync(truthPath, 'utf8'));

// Parsear CSV usando la misma lógica que AURA Frontend
const parsed = Papa.parse(csvContent, {
  header: true,
  dynamicTyping: true,
  skipEmptyLines: true,
});

const data = parsed.data as Record<string, any>[];
const fields = parsed.meta.fields || [];
const delimiter = parsed.meta.delimiter || ',';

console.log(`\n🚀 Iniciando Validación de Capa 1: Motor Determinista`);
console.log(`Dataset: ${truthContent.dataset} (${data.length} filas)`);
console.log(`------------------------------------------------------`);

// Ejecutar Motor Determinista
const report: AuditReport = runAudit(data, fields, delimiter);

// Mapeo de nombres de reglas (Ground Truth vs Motor)
const ruleMapping: Record<string, string> = {
  "R01_duplicados_exactos": "Filas Duplicadas",
  "R02_nulos_criticos": "Valores Nulos / Vacíos",
  "R03_formato_email": "Formato Email Inválido",
  "R06_mojibake_encoding": "Mojibake / Encoding Roto",
  "R08_placeholders_toxicos": "Placeholders Tóxicos",
  "R14_numeros_negativos_imposibles": "Negativos Imposibles",
  "R15_outliers_iqr": "Outliers Extremos (IQR)",
  "R19_pii_detectado": "Datos Sensibles (PII)",
  "R12_formatos_fecha_mixtos": "Formatos de Fecha Mixtos" // Si existe
};

let truePositives = 0;
let falseNegatives = 0;
let falsePositives = 0; // Reglas que saltaron y no debían

const results: any = {};

// 1. Verificar si el motor detectó lo que debía detectar (TP / FN)
for (const [truthKey, truthData] of Object.entries(truthContent.injected_issues) as any[]) {
  const engineRuleName = ruleMapping[truthKey];
  
  // Buscar si el motor reportó esta regla
  const detectedIssue = report.issues.find(i => 
    i.ruleName === engineRuleName && 
    (!truthData.column || i.column === truthData.column)
  );

  const expected = truthData.expected_count;
  const detected = detectedIssue ? detectedIssue.count : 0;

  if (detected >= expected) {
    // True Positive
    truePositives += expected;
    // Si detectó más de la cuenta, esos extras son FP
    if (detected > expected) {
      falsePositives += (detected - expected);
    }
    results[truthKey] = { status: '✅ MATCH', expected, detected };
  } else if (detected > 0) {
    // Parcial
    truePositives += detected;
    falseNegatives += (expected - detected);
    results[truthKey] = { status: '⚠️ PARCIAL', expected, detected };
  } else {
    // False Negative
    falseNegatives += expected;
    results[truthKey] = { status: '❌ MISSED', expected, detected };
  }
}

// 2. Verificar si el motor detectó cosas que no existían (FP puros)
const expectedRuleNames = Object.values(ruleMapping);
for (const issue of report.issues) {
  if (!expectedRuleNames.includes(issue.ruleName)) {
    falsePositives += issue.count;
    results[`UNEXPECTED_${issue.ruleName}`] = { 
      status: '❌ FALSE POSITIVE', 
      expected: 0, 
      detected: issue.count 
    };
  }
}

// Imprimir reporte por regla
for (const [rule, res] of Object.entries(results) as any[]) {
  console.log(`${res.status.padEnd(20)} | ${rule.padEnd(35)} | Expected: ${res.expected} | Detected: ${res.detected}`);
}

// Calcular métricas finales
const precision = truePositives / (truePositives + falsePositives);
const recall = truePositives / (truePositives + falseNegatives);
const f1 = 2 * (precision * recall) / (precision + recall);

console.log(`\n📊 MÉTRICAS GLOBALES (Exact Match)`);
console.log(`------------------------------------------------------`);
console.log(`True Positives (TP) : ${truePositives}`);
console.log(`False Positives (FP): ${falsePositives}`);
console.log(`False Negatives (FN): ${falseNegatives}`);
console.log(`------------------------------------------------------`);
console.log(`Precision : ${(precision * 100).toFixed(2)}% (Qué % de lo detectado era realmente error)`);
console.log(`Recall    : ${(recall * 100).toFixed(2)}% (Qué % de los errores totales encontró)`);
console.log(`F1-Score  : ${(f1 * 100).toFixed(2)}%`);
console.log(`\nNota para Tesis: Si Precision y Recall = 100%, la afirmación "EM=1.00" del Cap. 3.3.3 es empíricamente cierta.\n`);

// Guardar resultados
const outputPath = path.join(__dirname, '../results/deterministic_validation.json');
fs.writeFileSync(outputPath, JSON.stringify({
  timestamp: new Date().toISOString(),
  metrics: { precision, recall, f1, truePositives, falsePositives, falseNegatives },
  details: results
}, null, 2));

console.log(`Resultados guardados en: experiments/results/deterministic_validation.json`);
