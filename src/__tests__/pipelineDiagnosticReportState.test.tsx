// @vitest-environment jsdom

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import DiagnosticReportGateStep from '../components/DiagnosticReportGateStep';
import PipelineProgress from '../components/PipelineProgress';
import { buildDiagnosticReport } from '../services/diagnosticReport';
import { AuditReport, IssueCategory, IssueSeverity, QualityIssue } from '../types';

const issue = (overrides: Partial<QualityIssue>): QualityIssue => ({
  id: 'issue-default',
  column: 'Age',
  ruleId: 'rule:null-values',
  ruleName: 'Valores nulos',
  category: IssueCategory.INTEGRITY,
  description: 'Valores ausentes detectados.',
  severity: IssueSeverity.WARNING,
  count: 1,
  affectedPercentage: 1,
  sampleValues: [null],
  ...overrides,
});

const buildReport = (): AuditReport => ({
  score: 72,
  rowCount: 891,
  colCount: 12,
  duplicateRows: 0,
  delimiterDetected: ',',
  scoreBreakdown: [],
  issues: [
    issue({
      id: 'issue-null-age',
      column: 'Age',
      severity: IssueSeverity.WARNING,
      count: 177,
      affectedPercentage: 19.87,
    }),
    issue({
      id: 'issue-outlier-fare',
      column: 'Fare',
      ruleId: 'rule:mild-outliers',
      ruleName: 'Outliers leves',
      category: IssueCategory.TYPES,
      description: 'Fare tiene valores altos detectados como outliers leves.',
      severity: IssueSeverity.WARNING,
      count: 9,
      affectedPercentage: 1.01,
      sampleValues: [512.3292],
    }),
  ],
  columnStats: {
    Age: {
      name: 'Age',
      inferredType: 'number',
      semanticType: 'number',
      nullCount: 177,
      uniqueCount: 88,
    },
    Fare: {
      name: 'Fare',
      inferredType: 'number',
      semanticType: 'currency',
      nullCount: 0,
      uniqueCount: 248,
      outlierCount: 9,
      outlierSeverity: 'WARNING',
    },
  },
});

const buildGateReport = () => buildDiagnosticReport({
  report: buildReport(),
  auditEvidence: null,
  aiAnalysis: '',
});

describe('pipeline diagnostic report state', () => {
  it('PipelineProgress acepta diagnostic_report y muestra la rama opcional', () => {
    render(<PipelineProgress currentStep="diagnostic_report" />);

    expect(screen.getByText('Reporte')).toBeTruthy();
    expect(screen.getByText('Script opcional')).toBeTruthy();
    expect(screen.getByText('Revisión opcional')).toBeTruthy();
  });

  it('DiagnosticReportGateStep renderiza score base, conteos y reglas de salida principal', () => {
    render(
      <DiagnosticReportGateStep
        diagnosticReport={buildGateReport()}
        onExportMain={vi.fn()}
        onGenerateScript={vi.fn()}
        onBackToDiagnosis={vi.fn()}
      />,
    );

    const stage = screen.getByTestId('diagnostic-report-stage');
    expect(stage.textContent).toContain('Perfil definitivo del dataset');
    expect(stage.textContent).toContain('AURA consolidó evidencia determinista y diagnóstico disponible.');
    expect(stage.textContent).toContain('72/100');
    expect(stage.textContent).toContain('891 / 12');
    expect(stage.textContent).toContain('deterministic_only');
    expect(stage.textContent).toContain('Riesgos confirmados');
    expect(stage.textContent).toContain('Posibles falsos positivos contextuales');
    expect(stage.textContent).toContain('Recomendaciones');
    expect(stage.textContent).toContain('El score base no fue modificado.');
    expect(stage.textContent).toContain('El script es opcional.');
    expect(stage.textContent).toContain('HITL solo aplica si se entra a remediación con script.');
  });

  it('DiagnosticReportGateStep expone acciones para exportar, remediar opcionalmente y volver', () => {
    const onExportMain = vi.fn();
    const onGenerateScript = vi.fn();
    const onBackToDiagnosis = vi.fn();

    render(
      <DiagnosticReportGateStep
        diagnosticReport={buildGateReport()}
        onExportMain={onExportMain}
        onGenerateScript={onGenerateScript}
        onBackToDiagnosis={onBackToDiagnosis}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Ir a exportación principal/i }));
    fireEvent.click(screen.getByRole('button', { name: /Generar script recomendado, opcional/i }));
    fireEvent.click(screen.getByRole('button', { name: /Volver al diagnóstico/i }));

    expect(onExportMain).toHaveBeenCalledTimes(1);
    expect(onGenerateScript).toHaveBeenCalledTimes(1);
    expect(onBackToDiagnosis).toHaveBeenCalledTimes(1);
  });
});
