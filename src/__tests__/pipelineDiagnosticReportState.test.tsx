// @vitest-environment jsdom

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import DiagnosticReportStep from '../components/DiagnosticReportStep';
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
  it('PipelineProgress muestra el flujo principal de 5 pasos en diagnostic_report', () => {
    render(<PipelineProgress currentStep="diagnostic_report" />);

    expect(screen.getByText('Carga')).toBeTruthy();
    expect(screen.getByText('Perfil base')).toBeTruthy();
    expect(screen.getByText('Diagnóstico')).toBeTruthy();
    expect(screen.getByText('Reporte diagnóstico')).toBeTruthy();
    expect(screen.getByText('Exportación')).toBeTruthy();
  });

  it('PipelineProgress muestra el badge de rama opcional en estado script', () => {
    render(<PipelineProgress currentStep="script" />);

    expect(screen.getByText('Rama opcional: Remediación')).toBeTruthy();
    expect(screen.queryByText('Script opcional')).toBeNull();
  });

  it('PipelineProgress muestra el badge de Laboratorio en estado calibration', () => {
    render(<PipelineProgress currentStep="calibration" />);

    expect(screen.getByText('Laboratorio / Calibración experimental')).toBeTruthy();
  });

  it('DiagnosticReportStep renderiza score base, conteos y reglas de salida principal', () => {
    render(
      <DiagnosticReportStep
        diagnosticReport={buildGateReport()}
        onExportMain={vi.fn()}
        onGenerateScript={vi.fn()}
        onBackToDiagnosis={vi.fn()}
      />,
    );

    const stage = screen.getByTestId('diagnostic-report-stage');
    expect(stage.textContent).toContain('Informe diagnóstico de calidad del dato');
    expect(stage.textContent).toContain('AURA generó un reporte con evidencia determinista. El diagnóstico asistido no está disponible.');
    expect(stage.textContent).toContain('72/100');
    expect(stage.textContent).toContain('891');
    expect(stage.textContent).toContain('12');
    expect(stage.textContent).toContain('Solo determinista');
    expect(stage.textContent).not.toContain('deterministic_only');
    expect(stage.textContent).toContain('Riesgos confirmados');
    expect(stage.textContent).toContain('Posibles falsos positivos contextuales');
    expect(stage.textContent).toContain('Recomendaciones');
    expect(stage.textContent).toContain('El score base no fue modificado.');
    expect(stage.textContent).toContain('El script es opcional.');
    expect(stage.textContent).toContain('HITL solo aplica si se entra a remediación.');
  });

  it('DiagnosticReportStep expone acciones para exportar, remediar opcionalmente y volver', () => {
    const onExportMain = vi.fn();
    const onGenerateScript = vi.fn();
    const onBackToDiagnosis = vi.fn();

    render(
      <DiagnosticReportStep
        diagnosticReport={buildGateReport()}
        onExportMain={onExportMain}
        onGenerateScript={onGenerateScript}
        onBackToDiagnosis={onBackToDiagnosis}
      />,
    );

    fireEvent.click(screen.getByTestId('diagnostic-report-export-main'));
    fireEvent.click(screen.getByTestId('diagnostic-report-generate-script'));
    fireEvent.click(screen.getByTestId('diagnostic-report-back-diagnosis'));

    expect(onExportMain).toHaveBeenCalledTimes(1);
    expect(onGenerateScript).toHaveBeenCalledTimes(1);
    expect(onBackToDiagnosis).toHaveBeenCalledTimes(1);
  });
});
