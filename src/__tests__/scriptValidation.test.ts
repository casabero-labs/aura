import { describe, expect, it } from 'vitest';
import { validateCleaningScript } from '../services/scriptValidationService';
import { buildDeterministicCleaningScript } from '../services/deterministicScriptBuilder';
import { runAudit } from '../services/auditEngine';
import { AuditReport, IssueCategory, IssueSeverity } from '../types';

const stubReport: AuditReport = {
  score: 75,
  rowCount: 15,
  colCount: 4,
  duplicateRows: 1,
  delimiterDetected: ',',
  columnStats: {
    nombre: { name: 'nombre', inferredType: 'string', nullCount: 1, uniqueCount: 14 },
    edad: { name: 'edad', inferredType: 'number', nullCount: 1, uniqueCount: 11 },
    email: { name: 'email', inferredType: 'string', nullCount: 2, uniqueCount: 13, semanticType: 'email' },
    estado: { name: 'estado', inferredType: 'string', nullCount: 1, uniqueCount: 3 },
  },
  issues: [
    {
      id: 'integrity-null-nombre',
      column: 'nombre',
      ruleName: 'Valores Nulos / Vacíos',
      category: IssueCategory.INTEGRITY,
      description: '1 nulo en nombre.',
      severity: IssueSeverity.WARNING,
      count: 1,
      affectedPercentage: 6.7,
      sampleValues: [],
    },
    {
      id: 'integrity-dupes',
      ruleName: 'Filas Duplicadas',
      category: IssueCategory.INTEGRITY,
      description: '1 duplicado.',
      severity: IssueSeverity.CRITICAL,
      count: 1,
      affectedPercentage: 6.7,
      sampleValues: [],
    },
    {
      id: 'hygiene-toxic-edad',
      column: 'edad',
      ruleName: 'Placeholders Tóxicos',
      category: IssueCategory.HYGIENE,
      description: 'N/A en edad.',
      severity: IssueSeverity.WARNING,
      count: 1,
      affectedPercentage: 6.7,
      sampleValues: ['N/A'],
    },
  ],
  scoreBreakdown: [],
};

describe('validateCleaningScript — contrato completo', () => {
  it('valida script con columnas reales, Pandas, y cobertura parcial', () => {
    const script = `
import pandas as pd
import numpy as np

def clean_dataset(df):
    df_clean = df.copy()
    # Limpiar nombre: valores nulos
    df_clean['nombre'] = df_clean['nombre'].fillna('')
    # Eliminar filas duplicadas
    df_clean = df_clean.drop_duplicates()
    return df_clean
`;
    const result = validateCleaningScript(stubReport, script, 'model');

    expect(result.hasScript).toBe(true);
    expect(result.hasPandasImport).toBe(true);
    expect(result.invalidColumns).toHaveLength(0);
    expect(result.scriptOrigin).toBe('model');
    // Cobertura: nombre trace + duplicados trace = 2/3 = 66%
    expect(result.coveredIssueIds).toContain('integrity-null-nombre');
    expect(result.coveredIssueIds).toContain('integrity-dupes');
    expect(result.coveragePercentage).toBeGreaterThanOrEqual(60);
    expect(result.safetyScore).toBeGreaterThan(50);
    expect(result.safetyScore).toBeLessThan(100);
  });

  it('detecta columnas fantasma y asigna safetyScore bajo', () => {
    const script = `
import pandas as pd
df_clean = df.copy()
df_clean['salario'] = df_clean['salario'].fillna(0)
df_clean['telefono'] = df_clean['telefono'].str.strip()
`;
    const result = validateCleaningScript(stubReport, script, 'model');

    expect(result.invalidColumns).toContain('salario');
    expect(result.invalidColumns).toContain('telefono');
    expect(result.invalidColumns.length).toBeGreaterThanOrEqual(2);
    // Column score = 30 - 2*10 = 10
    expect(result.safetyScore).toBeLessThan(60);
    expect(result.requiresHumanReview).toBe(true);
  });

  it('detecta operaciones destructivas y las lista', () => {
    const script = `
import pandas as pd
df_clean = df.copy()
df_clean.drop('nombre', axis=1, inplace=True)
`;
    const result = validateCleaningScript(stubReport, script, 'model');

    expect(result.destructiveOperations.length).toBeGreaterThan(0);
    const hasDrop = result.destructiveOperations.some(op => op === 'drop' || op === 'delete_column');
    expect(hasDrop).toBe(true);
    expect(result.requiresHumanReview).toBe(true);
  });

  it('calcula uncoveredIssueIds correctamente', () => {
    const script = `
import pandas as pd
df_clean = df.copy()
df_clean['nombre'] = df_clean['nombre'].fillna('')
`;
    const result = validateCleaningScript(stubReport, script, 'model');

    // Only nombre is covered
    expect(result.coveredIssueIds).toContain('integrity-null-nombre');
    expect(result.uncoveredIssueIds).toContain('integrity-dupes');
    expect(result.uncoveredIssueIds).toContain('hygiene-toxic-edad');
    expect(result.coveragePercentage).toBe(33); // 1/3 = 33%
  });

  it('marca origen determinista y safetyScore apropiado', () => {
    const script = buildDeterministicCleaningScript(stubReport);
    const result = validateCleaningScript(stubReport, script, 'deterministic');

    expect(result.scriptOrigin).toBe('deterministic');
    expect(result.hasScript).toBe(true);
    expect(result.hasPandasImport).toBe(true);
    // Deterministic scripts may have destructive ops (drop_duplicates)
    // but they're well-commented and traceable
    expect(result.warnings.some(w => w.includes('determinista'))).toBe(true);
  });

  it('retorna safetyScore=0 cuando no hay script', () => {
    const result = validateCleaningScript(stubReport, undefined);

    expect(result.hasScript).toBe(false);
    expect(result.safetyScore).toBe(0);
    expect(result.coveragePercentage).toBe(0);
    expect(result.uncoveredIssueIds.length).toBe(stubReport.issues.length);
    expect(result.requiresHumanReview).toBe(true);
  });
});

describe('validateCleaningScript — integración con datos reales', () => {
  it('valida fallback determinista sobre datos con hallazgos reales', () => {
    const data = [
      { id: 1, name: ' Alice  ', status: 'N/A' },
      { id: 1, name: ' Alice  ', status: 'N/A' },
      { id: 2, name: 'bob', status: 'ok' },
    ];
    const report = runAudit(data, ['id', 'name', 'status'], ',');

    const fallbackScript = buildDeterministicCleaningScript(report);
    const result = validateCleaningScript(report, fallbackScript, 'deterministic');

    expect(result.hasScript).toBe(true);
    expect(result.hasPandasImport).toBe(true);
    expect(result.scriptOrigin).toBe('deterministic');
    // Should have some coverage (at least the duplicates issue)
    expect(result.coveredIssueIds.length).toBeGreaterThan(0);
    expect(result.coveragePercentage).toBeGreaterThan(0);
  });

  it('script con todas columnas válidas obtiene safetyScore >= 70', () => {
    const script = `
import pandas as pd
import numpy as np

def clean_dataset(df):
    df_clean = df.copy()
    df_clean['nombre'] = df_clean['nombre'].fillna('')
    df_clean['edad'] = pd.to_numeric(df_clean['edad'], errors='coerce')
    df_clean['email'] = df_clean['email'].fillna('')
    df_clean['estado'] = df_clean['estado'].str.strip()
    return df_clean
`;
    const result = validateCleaningScript(stubReport, script, 'model');

    expect(result.invalidColumns).toHaveLength(0);
    expect(result.destructiveOperations).toHaveLength(0);
    expect(result.safetyScore).toBeGreaterThanOrEqual(70);
    expect(result.requiresHumanReview).toBe(false);
  });
});
