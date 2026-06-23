/**
 * Baseline vs After Comparator
 * 
 * Compares baseline-summary.json against after-summary.json to measure
 * improvements from Contratos v2 implementation.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONTRACTS_V2_DIR = path.join(__dirname, '..');

export function compareSummaries(baselinePath, afterPath) {
  const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf-8'));
  const after = JSON.parse(fs.readFileSync(afterPath, 'utf-8'));

  const comparison = {
    generatedAt: new Date().toISOString(),
    baselineVersion: baseline.groundTruthVersion,
    afterVersion: after.groundTruthVersion,
    metrics: []
  };

  const metricsToCompare = [
    { key: 'automaticActionPrecision', label: 'Automatic Action Precision', direction: 'higher', unit: 'rate' },
    { key: 'unsafeAutomationRate', label: 'Unsafe Automation Rate', direction: 'lower', unit: 'rate' },
    { key: 'reviewRetentionRecall', label: 'Review Retention Recall', direction: 'higher', unit: 'rate' },
    { key: 'exactCitationRate', label: 'Exact Citation Rate', direction: 'higher', unit: 'rate' },
    { key: 'alteredCitationRate', label: 'Altered Citation Rate', direction: 'lower', unit: 'rate' },
    { key: 'phantomColumnRate', label: 'Phantom Column Rate', direction: 'lower', unit: 'rate' },
    { key: 'destructiveOperationRate', label: 'Destructive Operation Rate', direction: 'lower', unit: 'rate' },
    { key: 'scriptParseSuccessRate', label: 'Script Parse Success Rate', direction: 'higher', unit: 'rate' },
  ];

  const latencyStats = ['mean', 'stdDev', 'min', 'max'];
  const tokenStats = ['mean', 'stdDev', 'min', 'max'];

  // Compare main metrics
  metricsToCompare.forEach(({ key, label, direction, unit }) => {
    const baselineVal = baseline.evaluation[key] ?? 0;
    const afterVal = after.evaluation[key] ?? 0;
    const delta = afterVal - baselineVal;
    const deltaPercent = baselineVal !== 0 ? (delta / baselineVal) * 100 : (afterVal > 0 ? 100 : 0);

    let verdict;
    if (direction === 'higher') {
      verdict = delta > 0 ? 'improvement' : delta < 0 ? 'regression' : 'no_change';
    } else {
      verdict = delta < 0 ? 'improvement' : delta > 0 ? 'regression' : 'no_change';
    }

    comparison.metrics.push({
      metric: key,
      label,
      baseline: baselineVal,
      after: afterVal,
      delta: Math.round(delta * 10000) / 10000,
      deltaPercent: Math.round(deltaPercent * 100) / 100,
      unit,
      verdict
    });
  });

  // Compare latency
  if (baseline.evaluation.latencyStats && after.evaluation.latencyStats) {
    const latencyComparison = {
      metric: 'latency',
      label: 'Latency',
      unit: 'ms',
      baseline: {},
      after: {},
      verdict: 'no_change'
    };

    latencyStats.forEach(stat => {
      latencyComparison.baseline[stat] = baseline.evaluation.latencyStats[stat] || 0;
      latencyComparison.after[stat] = after.evaluation.latencyStats[stat] || 0;
    });

    const delta = latencyComparison.after.mean - latencyComparison.baseline.mean;
    latencyComparison.delta = Math.round(delta);
    latencyComparison.deltaPercent = latencyComparison.baseline.mean !== 0 
      ? Math.round((delta / latencyComparison.baseline.mean) * 10000) / 100
      : 0;
    latencyComparison.verdict = delta < 0 ? 'improvement' : delta > 0 ? 'regression' : 'no_change';

    comparison.metrics.push(latencyComparison);
  }

  // Compare tokens
  if (baseline.evaluation.tokenStats && after.evaluation.tokenStats) {
    const tokenComparison = {
      metric: 'tokens',
      label: 'Token Usage',
      unit: 'tokens',
      baseline: {},
      after: {},
      verdict: 'no_change'
    };

    tokenStats.forEach(stat => {
      tokenComparison.baseline[stat] = baseline.evaluation.tokenStats[stat] || 0;
      tokenComparison.after[stat] = after.evaluation.tokenStats[stat] || 0;
    });

    const delta = tokenComparison.after.mean - tokenComparison.baseline.mean;
    tokenComparison.delta = Math.round(delta);
    tokenComparison.deltaPercent = tokenComparison.baseline.mean !== 0
      ? Math.round((delta / tokenComparison.baseline.mean) * 10000) / 100
      : 0;
    tokenComparison.verdict = delta < 0 ? 'improvement' : delta > 0 ? 'regression' : 'no_change';

    comparison.metrics.push(tokenComparison);
  }

  // Summary
  const improvements = comparison.metrics.filter(m => m.verdict === 'improvement').length;
  const regressions = comparison.metrics.filter(m => m.verdict === 'regression').length;
  const noChange = comparison.metrics.filter(m => m.verdict === 'no_change').length;

  comparison.summary = {
    totalMetrics: comparison.metrics.length,
    improvements,
    regressions,
    noChange,
    overallVerdict: improvements > regressions ? 'improvement' : improvements < regressions ? 'regression' : 'no_change'
  };

  return comparison;
}

export function generateMarkdownReport(comparison) {
  let md = '# Baseline vs After Comparison\n\n';
  md += `Generated: ${comparison.generatedAt}\n\n`;
  md += `Baseline version: ${comparison.baselineVersion}\n`;
  md += `After version: ${comparison.afterVersion}\n\n`;

  md += '## Summary\n\n';
  md += `- Total metrics: ${comparison.summary.totalMetrics}\n`;
  md += `- Improvements: ${comparison.summary.improvements}\n`;
  md += `- Regressions: ${comparison.summary.regressions}\n`;
  md += `- No change: ${comparison.summary.noChange}\n`;
  md += `- **Overall verdict: ${comparison.summary.overallVerdict}**\n\n`;

  md += '## Metrics Comparison\n\n';
  md += '| Metric | Baseline | After | Delta | % Change | Verdict |\n';
  md += '|--------|----------|-------|-------|----------|--------|\n';

  comparison.metrics.forEach(m => {
    if (m.metric === 'latency' || m.metric === 'tokens') {
      md += `| ${m.label} | ${m.baseline.mean} ± ${m.baseline.stdDev} | ${m.after.mean} ± ${m.after.stdDev} | ${m.delta} | ${m.deltaPercent}% | ${m.verdict} |\n`;
    } else {
      md += `| ${m.label} | ${(m.baseline * 100).toFixed(1)}% | ${(m.after * 100).toFixed(1)}% | ${(m.delta * 100).toFixed(1)}% | ${m.deltaPercent}% | ${m.verdict} |\n`;
    }
  });

  return md;
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const baselinePath = process.argv[2] || path.join(CONTRACTS_V2_DIR, 'baseline', 'baseline-summary.json');
  const afterPath = process.argv[3] || path.join(CONTRACTS_V2_DIR, 'after', 'after-summary.json');

  // Check if after summary exists
  if (!fs.existsSync(afterPath)) {
    console.error(`After summary not found at: ${afterPath}`);
    console.error('This is expected in the baseline phase. The comparator will be ready for future comparison.');
    console.error('\nUsage: node compare-baseline.mjs [baseline-path] [after-path]');
    process.exit(0);
  }

  const comparison = compareSummaries(baselinePath, afterPath);
  
  // Save JSON comparison
  const comparisonPath = path.join(CONTRACTS_V2_DIR, 'baseline', 'comparison.json');
  fs.writeFileSync(comparisonPath, JSON.stringify(comparison, null, 2));
  console.log(`Comparison saved to: ${comparisonPath}`);

  // Save markdown report
  const markdown = generateMarkdownReport(comparison);
  const mdPath = path.join(CONTRACTS_V2_DIR, 'baseline', 'comparison.md');
  fs.writeFileSync(mdPath, markdown);
  console.log(`Markdown report saved to: ${mdPath}`);

  console.log('\n' + markdown);
}
