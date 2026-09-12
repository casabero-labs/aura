import { describe, expect, it } from 'vitest';
import Papa from 'papaparse';
import { runAudit } from '../services/auditEngine';
import { buildDiagnosticReport } from '../services/diagnosticReport';

describe('CSV markers versus missing cells', () => {
  it.each([
    ['codigo,otro\n100,a\n101,b\n999,c', 0],
    ['codigo,otro\n100,a\n101,b\n,c', 1],
    ['codigo,otro\n100,a\n999,b\n,c', 1],
  ])('counts only actual missing cells: %s', (csv, missing) => {
    const parsed = Papa.parse<Record<string, string>>(csv, {header:true, dynamicTyping:false});
    const report = runAudit(parsed.data, parsed.meta.fields!, ',');
    const diagnostic = buildDiagnosticReport({report, auditEvidence:null});
    expect(report.columnStats.codigo.nullCount).toBe(missing);
    const nullIssues = report.issues.filter(i => i.column === 'codigo' && i.ruleId === 'rule:null-values');
    expect(nullIssues.map(i => i.count)).toEqual(missing ? [missing] : []);
    const confirmedNulls = diagnostic.findingGroups.confirmedRisks.filter(i => i.sourceIssueIds.includes('integrity-null-codigo'));
    expect(confirmedNulls.length).toBe(missing ? 1 : 0);
    expect(diagnostic.recommendations.some(item => item.id === 'rec-inspect-critical-nulls')).toBe(missing > 0);
    expect(parsed.data.some(row => row.codigo === '999')).toBe(csv.includes('999'));
    expect(report.scoreBreakdown.some(i => i.ruleId === 'rule:toxic-placeholders')).toBe(false);
  });
});
