import { describe, expect, it } from 'vitest';
import { uploadCopy } from '../components/FileUpload';
import { buildProfileStageModel } from '../components/ProfileStageHeader';
import {
  buildDiagnosisInputSummary,
  diagnosisPromptTraceCopy,
  isDiagnosisResponseContractFailure,
} from '../components/DiagnosisStep';
import { AuditReport, IssueCategory, IssueSeverity } from '../types';

const report: AuditReport = {
  score: 82,
  rowCount: 100,
  colCount: 4,
  duplicateRows: 1,
  delimiterDetected: ',',
  columnStats: {
    id: { name: 'id', inferredType: 'number', nullCount: 0, uniqueCount: 100 },
    email: { name: 'email', inferredType: 'string', semanticType: 'email', nullCount: 3, uniqueCount: 97 },
  },
  issues: [
    {
      id: 'logic-email-email',
      column: 'email',
      ruleName: 'Formato Email Inválido',
      category: IssueCategory.LOGIC,
      description: 'Cadenas sin estructura de correo.',
      severity: IssueSeverity.CRITICAL,
      count: 2,
      affectedPercentage: 2,
      sampleValues: ['bad-email'],
      ruleId: 'rule:test',
    },
  ],
  scoreBreakdown: [],
};

describe('AURA UI flow contracts', () => {
  it('explains local-first upload before profiling', () => {
    expect(uploadCopy.title).toContain('Cargar CSV');
    expect(uploadCopy.privacy).toContain('navegador');
    expect(uploadCopy.privacy).toContain('envía');
  });

  it('describes profiling as deterministic evidence without AI language', () => {
    const model = buildProfileStageModel(report);
    const visibleText = Object.values(model).flat().join(' ');

    expect(model.stage).toBe('Perfil del dataset');
    expect(model.output).toContain('hallazgos reproducibles');
    expect(model.engine).toContain('Expresiones regulares');
    expect(visibleText).not.toMatch(/\bIA\b/i);
    expect(visibleText).not.toMatch(/\bLLM\b/i);
  });

  it('states that diagnosis receives structured findings only', () => {
    const summary = buildDiagnosisInputSummary(report);
    const visibleText = Object.values(summary).flat().join(' ');

    expect(summary.findings).toBe(1);
    expect(summary.critical).toBe(1);
    expect(summary.warning).toBe(0);
    expect(summary.affectedColumns).toBe(1);
    expect(visibleText).not.toMatch(/dataset crudo/i);
  });

  it('distinguishes an invalid model response from a provider connection error', () => {
    expect(isDiagnosisResponseContractFailure('DIAGNOSIS_REFERENCE_INVALID')).toBe(true);
    expect(isDiagnosisResponseContractFailure('DIAGNOSIS_SCHEMA_INVALID')).toBe(true);
    expect(isDiagnosisResponseContractFailure('DIAGNOSIS_ADAPTER_ERROR')).toBe(false);
  });

  it('explains that the bilingual prompt trace is one provider request', () => {
    const visibleText = Object.values(diagnosisPromptTraceCopy).join(' ');

    expect(diagnosisPromptTraceCopy.title).toContain('Una sola solicitud');
    expect(diagnosisPromptTraceCopy.system).toContain('inglés técnico');
    expect(diagnosisPromptTraceCopy.system).toContain('no es un segundo diagnóstico');
    expect(diagnosisPromptTraceCopy.exact).toContain('única composición');
    expect(diagnosisPromptTraceCopy.legacy).toContain('sesiones antiguas');
    expect(diagnosisPromptTraceCopy.legacy).toContain('No se mezcla');
    expect(visibleText).toContain('promptHash');
  });
});
