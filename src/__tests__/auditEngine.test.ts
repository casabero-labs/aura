import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';
import { runAudit } from '../services/auditEngine';
import { IssueSeverity, IssueCategory } from '../types';

const TITANIC_PATH = path.resolve(__dirname, '../experiments/datasets/titanic.csv');

function loadTitanic() {
  const csvData = fs.readFileSync(TITANIC_PATH, 'utf-8');
  const parsed = Papa.parse(csvData, {
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true,
  });
  return { data: parsed.data as Record<string, any>[], fields: parsed.meta.fields as string[] };
}

// Per-rule TP/FP/FN tracker
interface RuleResult { tp: number; fp: number; fn: number; }

function scoreRule(label: string, tp: number, fp: number, fn: number): RuleResult {
  const p = tp + fp > 0 ? tp / (tp + fp) : 1;
  const r = tp + fn > 0 ? tp / (tp + fn) : 1;
  const f1 = p + r > 0 ? 2 * p * r / (p + r) : 0;
  console.log(`  ${label}: TP=${tp} FP=${fp} FN=${fn}  P=${p.toFixed(3)} R=${r.toFixed(3)} F1=${f1.toFixed(3)}`);
  return { tp, fp, fn };
}

describe('AuditEngine - Deterministic Rules', () => {
  describe('Dataset situations from UNIR cleaning activity', () => {
    it('classifies dates and IPv4 values without confusing them with phones', () => {
      const data = [
        { fecha_ingreso: '2023-01-15', ip_acceso: '192.168.1.10' },
        { fecha_ingreso: '2023-02-01', ip_acceso: '10.0.0.5' },
        { fecha_ingreso: '01/15/2023', ip_acceso: '172.16.0.100' },
      ];

      const result = runAudit(data, ['fecha_ingreso', 'ip_acceso'], ',');

      expect(result.columnStats.fecha_ingreso.semanticType).toBe('date');
      expect(result.columnStats.ip_acceso.semanticType).toBe('ip');
      expect(result.issues.find((issue) => issue.id === 'semantic-burned-range-fecha_ingreso')).toBeUndefined();
      expect(result.issues.find((issue) => issue.id === 'logic-mixed-date-fecha_ingreso')?.sampleValues)
        .toContain('01/15/2023');
    });

    it('detects survey-question headers as metadata/schema friction', () => {
      const field = '8_¿Cuál es su grupo de edad?';
      const data = Array.from({ length: 12 }, (_, i) => ({
        [field]: i % 2 === 0 ? 'De 41 a 65 años' : 'Menos de 18 años',
      }));

      const result = runAudit(data, [field], ',');
      const issue = result.issues.find(i => i.id === `semantic-header-${field}`);

      expect(issue).toBeDefined();
      expect(issue!.ruleName).toBe('Cabecera como Pregunta / Metadato Verbal');
      expect(issue!.severity).toBe(IssueSeverity.INFO);
    });

    it('detects burned demographic ranges that block dynamic segmentation', () => {
      const data = Array.from({ length: 20 }, (_, i) => ({
        rango_edad: i % 3 === 0 ? 'De 41 a 65 años' : i % 3 === 1 ? 'Menos de 18 años' : '18-30',
      }));

      const result = runAudit(data, ['rango_edad'], ',');
      const issue = result.issues.find(i => i.id === 'semantic-burned-range-rango_edad');

      expect(issue).toBeDefined();
      expect(issue!.ruleName).toBe('Rangos Demográficos Quemados');
      expect(issue!.severity).toBe(IssueSeverity.WARNING);
    });

    it('detects controlled-vocabulary variants in categorical columns', () => {
      const data = Array.from({ length: 20 }, (_, i) => ({
        sexo: i % 4 === 0 ? 'Hombre' : i % 4 === 1 ? 'Masculino' : i % 4 === 2 ? 'Mujer' : 'Femenino',
      }));

      const result = runAudit(data, ['sexo'], ',');
      const masculineIssue = result.issues.find(i => i.id === 'semantic-category-variants-sexo-masculino');
      const feminineIssue = result.issues.find(i => i.id === 'semantic-category-variants-sexo-femenino');

      expect(masculineIssue).toBeDefined();
      expect(feminineIssue).toBeDefined();
      expect(masculineIssue!.ruleName).toBe('Consistencia Categórica Semántica');
    });

    it('detects semantically duplicated columns with different labels', () => {
      const data = Array.from({ length: 20 }, (_, i) => ({
        TIPO: i % 2 === 0 ? 'MAYORES' : 'INFANTIL',
        DESC_CLASIFICACION: i % 2 === 0 ? 'Área de mayores' : 'Área infantil',
      }));

      const result = runAudit(data, ['TIPO', 'DESC_CLASIFICACION'], ',');
      const issue = result.issues.find(i => i.id === 'semantic-duplicate-columns-TIPO-DESC_CLASIFICACION');

      expect(issue).toBeDefined();
      expect(issue!.ruleName).toBe('Duplicidad Semántica de Columnas');
      expect(issue!.severity).toBe(IssueSeverity.INFO);
    });

    it('detects categorical long tails that need macro-category review', () => {
      const data = Array.from({ length: 60 }, (_, i) => ({
        OriginalCrimeTypeName: i % 2 === 0 ? `Crime variant ${i}` : `Administrative code ${i}`,
      }));

      const result = runAudit(data, ['OriginalCrimeTypeName'], ',');
      const issue = result.issues.find(i => i.id === 'semantic-long-tail-OriginalCrimeTypeName');

      expect(issue).toBeDefined();
      expect(issue!.ruleName).toBe('Cola Larga Categórica');
    });
  });

  describe('R4 Fix: Mixed Types Skip for Code Columns', () => {
    it('should NOT report integrity-mixed-Ticket on Titanic dataset', () => {
      const { data, fields } = loadTitanic();
      const result = runAudit(data, fields, ',');
      const mixedTicketIssues = result.issues.filter(i => i.id === 'integrity-mixed-Ticket');
      expect(mixedTicketIssues).toHaveLength(0);
    });

    it('should still detect null values in Age column on Titanic dataset', () => {
      const { data, fields } = loadTitanic();
      const result = runAudit(data, fields, ',');
      const ageNullIssues = result.issues.filter(i => i.id === 'integrity-null-Age');
      expect(ageNullIssues).toHaveLength(1);
      expect(ageNullIssues[0].ruleName).toBe('Valores Nulos / Vacíos');
    });
  });

  describe('Null Detection', () => {
    it('should report Age column with nulls on Titanic dataset', () => {
      const { data, fields } = loadTitanic();
      const result = runAudit(data, fields, ',');

      const ageNullIssue = result.issues.find(i => i.id === 'integrity-null-Age');
      expect(ageNullIssue).toBeDefined();
      expect(ageNullIssue!.affectedPercentage).toBeGreaterThan(0);
      expect(ageNullIssue!.affectedPercentage).toBeLessThan(100);
    });
  });

  describe('Constant Column', () => {
    it('should detect a column where all values are identical', () => {
      const data = Array.from({ length: 20 }, (_, i) => ({
        id: i,
        constant: 'same_value',
        name: `name_${i}`,
      }));
      const fields = ['id', 'constant', 'name'];

      const result = runAudit(data, fields, ',');

      const constIssue = result.issues.find(i => i.id === 'integrity-constant-constant');
      expect(constIssue).toBeDefined();
      expect(constIssue!.ruleName).toBe('Columna Constante');
      expect(constIssue!.severity).toBe(IssueSeverity.WARNING);
    });
  });

  describe('Score Range', () => {
    it('should return a score between 0 and 100 for Titanic dataset', () => {
      const { data, fields } = loadTitanic();
      const result = runAudit(data, fields, ',');

      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });
  });

  describe('Future Dates (Freshness)', () => {
    it('should detect future dates beyond threshold in datetime columns', () => {
      const futureDate = '2099-12-31 00:00:00';
      const validDate = '2023-01-15 00:00:00';
      const data = Array.from({ length: 20 }, (_, i) => ({
        id: i,
        fecha_hora: i < 10 ? futureDate : validDate,
      }));
      const fields = ['id', 'fecha_hora'];

      const result = runAudit(data, fields, ',');

      const freshnessIssue = result.issues.find(i => i.id === 'logic-freshness-fecha_hora');
      expect(freshnessIssue).toBeDefined();
      expect(freshnessIssue!.ruleName).toBe('Fechas Futuras (Freshness)');
      expect(freshnessIssue!.severity).toBe(IssueSeverity.CRITICAL);
    });
  });

  describe('R07 Caos de Capitalización', () => {
    it('detects Bogotá/BOGOTÁ/bogotá with grouped evidence', () => {
      const data = [
        { ciudad: 'Bogotá' },
        { ciudad: 'BOGOTÁ' },
        { ciudad: 'bogotá' },
        { ciudad: 'Medellín' },
        { ciudad: 'Cali' },
      ];

      const result = runAudit(data, ['ciudad'], ',');
      const issue = result.issues.find(i => i.id === 'hygiene-case-ciudad');

      expect(issue).toBeDefined();
      expect(issue!.ruleName).toBe('Caos de Capitalización');
      expect(issue!.count).toBe(3);
      expect(issue!.affectedPercentage).toBeGreaterThan(0);
      expect(issue!.sampleValues).toContain('bogota: Bogotá | BOGOTÁ | bogotá');
    });

    it('does not detect AM/am variants in datetime columns', () => {
      const data = [
        { CallDateTime: '2024-01-01 08:00 AM' },
        { CallDateTime: '2024-01-01 08:00 am' },
        { CallDateTime: '2024-01-02 09:30 AM' },
        { CallDateTime: '2024-01-02 09:30 am' },
      ];

      const result = runAudit(data, ['CallDateTime'], ',');
      const issue = result.issues.find(i => i.id === 'hygiene-case-CallDateTime');

      expect(issue).toBeUndefined();
    });

    it('does not detect differences caused only by spaces', () => {
      const data = [
        { ciudad: 'Bogotá' },
        { ciudad: ' Bogotá ' },
        { ciudad: 'Bogotá  ' },
        { ciudad: 'Medellín' },
      ];

      const result = runAudit(data, ['ciudad'], ',');
      const issue = result.issues.find(i => i.id === 'hygiene-case-ciudad');

      expect(issue).toBeUndefined();
    });

    it('reports a non-zero affectedPercentage whenever count is greater than zero', () => {
      const data = [
        { ciudad: 'Lima' },
        { ciudad: 'LIMA' },
        { ciudad: 'Quito' },
        { ciudad: 'Quito' },
      ];

      const result = runAudit(data, ['ciudad'], ',');
      const issue = result.issues.find(i => i.id === 'hygiene-case-ciudad');

      expect(issue).toBeDefined();
      expect(issue!.count).toBeGreaterThan(0);
      expect(issue!.affectedPercentage).toBeGreaterThan(0);
    });
  });

  // ── Loop 2: Semantic ID Contamination & False Positive Gates ──

  describe('Contaminación Semántica de ID', () => {
    it('detects ID column contamination by neighboring categorical vocabulary', () => {
      const rows = [
        { City: '160920001', CrimeId: 'Handled/Advised', Disposition: 'Handled/Advised', OriginalCrimeTypeName: '' },
        { City: 'San Francisco', CrimeId: 160903280, Disposition: 'Report Taken', OriginalCrimeTypeName: 'Violent Crime/Assault' },
        { City: 'San Francisco', CrimeId: 'Not Recorded', Disposition: 'Not Recorded', OriginalCrimeTypeName: 'Homeless Related' },
        { City: '160920002', CrimeId: 'Arrest/Citation', Disposition: 'Arrest/Citation', OriginalCrimeTypeName: '' },
        { City: '160920003', CrimeId: 160903300, Disposition: 'Report Taken', OriginalCrimeTypeName: '' },
        { City: '160920004', CrimeId: 160912801, Disposition: 'Handled/Advised', OriginalCrimeTypeName: 'Service/Report/Admin' },
        { City: '160920005', CrimeId: 160912811, Disposition: 'Report Taken', OriginalCrimeTypeName: 'Vandalism' },
        { City: 'San Francisco', CrimeId: 'Gone/Unable to Locate', Disposition: 'Gone/Unable to Locate', OriginalCrimeTypeName: 'Homeless Related' },
      ];

      const report = runAudit(rows, ['City', 'CrimeId', 'Disposition', 'OriginalCrimeTypeName'], ',');
      expect(report.issues.some(issue =>
        issue.ruleName === 'Contaminación Semántica de ID' &&
        issue.column === 'CrimeId'
      )).toBe(true);
    });
  });

  describe('False Positive: Números Disfrazados on CallDateTime', () => {
    it('does NOT flag CallDateTime ISO timestamps as disguised numbers', () => {
      const rows = Array.from({ length: 10 }, (_, i) => ({
        CallDateTime: `2016-03-3${i}T23:42:00Z`,
        City: 'San Francisco',
        CrimeId: 160903280 + i,
      }));

      const report = runAudit(rows, ['CallDateTime', 'City', 'CrimeId'], ',');
      const disguised = report.issues.filter(i => i.ruleName === 'Números Disfrazados' && i.column === 'CallDateTime');
      expect(disguised).toHaveLength(0);
    });
  });

  describe('False Positive: URL Detection on Disposition', () => {
    it('does NOT flag Disposition as URL just for containing substring "sitio"', () => {
      const rows = Array.from({ length: 12 }, (_, i) => ({
        Disposition: i % 3 === 0 ? 'Report Taken' : i % 3 === 1 ? 'Gone/Unable to Locate' : 'Suspicious Activity',
        City: 'San Francisco',
      }));

      const report = runAudit(rows, ['Disposition', 'City'], ',');
      const urlIssues = report.issues.filter(i => i.id.startsWith('logic-url-Disposition'));
      expect(urlIssues).toHaveLength(0);
    });
  });

  describe('False Positive: Symbol Chaos on Categorical Taxonomy', () => {
    it('does NOT flag OriginalCrimeTypeName as symbols when column is categorical with slashes', () => {
      const rows = [
        { OriginalCrimeTypeName: 'Violent Crime/Assault', City: 'San Francisco' },
        { OriginalCrimeTypeName: 'Service/Report/Admin', City: 'San Francisco' },
        { OriginalCrimeTypeName: 'Traffic/Parking/Sidewalk', City: 'San Francisco' },
        { OriginalCrimeTypeName: 'Homeless Related', City: 'San Francisco' },
        { OriginalCrimeTypeName: 'Vandalism', City: 'San Francisco' },
        { OriginalCrimeTypeName: 'Violent Crime/Assault', City: 'San Francisco' },
        { OriginalCrimeTypeName: 'Suspicious Activity', City: 'San Francisco' },
        { OriginalCrimeTypeName: 'Service/Report/Admin', City: 'San Francisco' },
      ];

      const report = runAudit(rows, ['OriginalCrimeTypeName', 'City'], ',');
      const symbolIssues = report.issues.filter(i =>
        i.ruleName === 'Símbolos Sospechosos' && i.column === 'OriginalCrimeTypeName'
      );
      expect(symbolIssues).toHaveLength(0);
    });
  });
});

describe('Per-Rule TP/FP/FN on Titanic dataset', () => {
  it('R01–R23: all rules fired on Titanic with known ground truth', () => {
    const { data, fields } = loadTitanic();
    const result = runAudit(data, fields, ',');

    const groundTruth: Array<{ ruleId: string; etp: number; efp: number; efn: number; label: string }> = [
      { ruleId: 'integrity-duplicates',    etp: 0, efp: 0, efn: 0, label: 'R01 Duplicated Rows' },
      { ruleId: 'integrity-null-Age',      etp: 1, efp: 0, efn: 0, label: 'R02 Age nulls' },
      { ruleId: 'integrity-null-Cabin',    etp: 1, efp: 0, efn: 0, label: 'R02 Cabin nulls' },
      { ruleId: 'integrity-constant-',     etp: 0, efp: 0, efn: 0, label: 'R03 Constant Column' },
      { ruleId: 'integrity-mixed-Ticket',  etp: 0, efp: 0, efn: 0, label: 'R04 Ticket mixed (skipped)' },
      { ruleId: 'hygiene-ghost-',          etp: 0, efp: 0, efn: 0, label: 'R05 Ghost Spaces' },
      { ruleId: 'hygiene-moji-',           etp: 0, efp: 0, efn: 0, label: 'R06 Mojibake' },
      { ruleId: 'hygiene-case-',           etp: 0, efp: 0, efn: 0, label: 'R07 Cap Chaos' },
      { ruleId: 'hygiene-toxic-',          etp: 0, efp: 0, efn: 0, label: 'R08 Toxic Placeholders' },
      { ruleId: 'logic-mixed-date-',       etp: 0, efp: 0, efn: 0, label: 'R09 Mixed Date Formats' },
      { ruleId: 'hygiene-space-',          etp: 0, efp: 0, efn: 0, label: 'R10 Double Spaces' },
      { ruleId: 'logic-url-',              etp: 0, efp: 0, efn: 0, label: 'R12 URL Format' },
      { ruleId: 'hygiene-over-',           etp: 0, efp: 0, efn: 0, label: 'R13 Text Overflow' },
      { ruleId: 'type-disguised-',         etp: 0, efp: 0, efn: 0, label: 'R14 Disguised Numbers' },
      { ruleId: 'type-date-',              etp: 0, efp: 0, efn: 0, label: 'R15 Hidden Dates' },
      { ruleId: 'type-corrupt-',           etp: 0, efp: 0, efn: 0, label: 'R16 Corrupt IDs' },
      { ruleId: 'type-time-',               etp: 0, efp: 0, efn: 0, label: 'R17 Redundant Time' },
      { ruleId: 'logic-neg-',              etp: 0, efp: 0, efn: 0, label: 'R18 Negative Values' },
      { ruleId: 'logic-email-',            etp: 0, efp: 0, efn: 0, label: 'R20 Invalid Email' },
      { ruleId: 'logic-phone-',            etp: 0, efp: 0, efn: 0, label: 'R21 Phone Variance' },
      { ruleId: 'sec-pii-',                 etp: 0, efp: 0, efn: 0, label: 'R22 PII Detection' },
      { ruleId: 'logic-freshness-',        etp: 0, efp: 0, efn: 0, label: 'R23 Future Dates' },
      { ruleId: 'logic-outlier-tukey-',   etp: 1, efp: 0, efn: 0, label: 'R-Tukey Mild Outliers (Fare has mild outliers)' },
    ];

    console.log('\n=== Per-Rule Evaluation on Titanic ===');
    for (const gt of groundTruth) {
      const issues = result.issues.filter(i => i.id.startsWith(gt.ruleId));
      const actualTP = issues.length > 0 ? 1 : 0;
      const fp = actualTP > gt.etp ? actualTP - gt.etp : 0;
      const fn = gt.etp > actualTP ? gt.etp - actualTP : 0;
      scoreRule(gt.label, gt.etp, fp, fn);
      expect(fp, `${gt.label}: unexpected FP`).toBe(0);
    }

    const ageNullIssue = result.issues.find(i => i.id === 'integrity-null-Age');
    expect(ageNullIssue).toBeDefined();
    const cabinNullIssue = result.issues.find(i => i.id === 'integrity-null-Cabin');
    expect(cabinNullIssue).toBeDefined();
  });
});
