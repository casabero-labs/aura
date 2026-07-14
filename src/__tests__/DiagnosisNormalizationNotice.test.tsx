// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import DiagnosisStep from '../components/DiagnosisStep';
import type { DiagnosisExecutionResult } from '../contracts/llm';
import type { AuditReport, AIConfig, AIProvider } from '../types';

const makeStructuredDiagnosis = (
  normalizationApplied: boolean,
  normalizedIssueIds: string[],
): DiagnosisExecutionResult => ({
  version: 2,
  diagnosis: {
    contractId: 'aura.diagnosis.v2',
    contractVersion: '2.0.0',
    evidenceEnvelopeRef: 'env:test',
    responseId: 'diag-test',
    issues: [
      { issueId: 'is-1', evidenceRefs: [], hypothesis: 'test', confidence: 0.5, requiresHumanReview: true, limits: [] },
    ],
    diagnosisBlocks: [
      { issueId: 'is-1', ruleId: 'rule:test', columnId: null, scope: 'dataset', observation: 'test', recommendation: 'test' },
    ],
    limitations: [],
    generatedAt: new Date().toISOString(),
  },
  metrics: {
    latencyMs: 100,
    tokensGenerated: 50,
    model: 'test-model',
    provider: 'Ollama',
    isLocal: true,
  },
  promptHash: 'a'.repeat(64),
  evidenceEnvelopeRef: 'env:test',
  promptVersion: '1.6.0',
  rawResponseHash: 'b'.repeat(64),
  normalizationEvidence: {
    applied: normalizationApplied,
    field: 'requiresHumanReview',
    reason: 'AURA_GOVERNANCE_ENFORCED',
    policy: 'aura.human-review-policy.v2',
    policyVersion: '1.0.0',
    normalizedIssueIds,
    originalValuesByIssueId: { 'is-1': false },
    effectiveValuesByIssueId: { 'is-1': true },
  },
});

const emptyReport: AuditReport = {
  score: 100,
  rowCount: 1,
  colCount: 1,
  duplicateRows: 0,
  delimiterDetected: ',',
  columnStats: {},
  issues: [],
  scoreBreakdown: [],
  datasetProfile: {
    totalRows: 1,
    totalColumns: 1,
    columns: [{ name: 'col', inferredType: 'string', cardinality: 'low' as const, uniqueRatio: 1, sparsity: 0, isCandidateForCoalescence: false, pruneRecommendation: 'keep' }],
    coalescencePairs: [],
    pruningCandidates: [],
    generatedAt: '2026-07-01T00:00:00.000Z',
  },
};

const stubAiConfig: AIConfig = {
  providerType: 'ollama',
  model: 'test-model',
  temperature: 0.1,
  autoAnalyze: false,
  ollamaBaseUrl: 'http://localhost:11434',
};

const stubAiProvider: AIProvider = {
  name: 'Ollama',
  type: 'ollama',
  generateText: vi.fn(),
  analyzeStream: vi.fn(),
  generateExecutiveReport: vi.fn(),
  generateExecutiveReportStream: vi.fn(),
  isAvailable: vi.fn().mockResolvedValue(true),
} as AIProvider;

describe('DiagnosisStep — normalization notice', () => {
  it('displays the Spanish normalization notice when normalizationEvidence.applied is true', () => {
    const sd = makeStructuredDiagnosis(true, ['is-1']);

    render(
      <DiagnosisStep
        report={emptyReport}
        auditEvidence={null}
        aiConfig={stubAiConfig}
        aiProvider={stubAiProvider}
        analysisText=""
        onAiConfigChange={vi.fn()}
        onAnalysisComplete={vi.fn()}
        onContinue={vi.fn()}
        initialDiagnosis={sd}
      />,
    );

    const notice = screen.getByTestId('diagnosis-normalization-notice');
    expect(notice).toBeDefined();
    expect(notice.textContent).toContain('AURA aplicó revisión humana obligatoria');
    expect(notice.textContent).toContain('1 hallazgo');
    expect(notice.textContent).not.toContain('1 hallazgos');
    expect(notice.textContent).toContain('política determinista de gobernanza');
    expect(notice.textContent).toContain('La respuesta original del modelo se conserva en la evidencia técnica');
  });

  it('does NOT display the notice when normalizationEvidence.applied is false', () => {
    const sd = makeStructuredDiagnosis(false, []);

    render(
      <DiagnosisStep
        report={emptyReport}
        auditEvidence={null}
        aiConfig={stubAiConfig}
        aiProvider={stubAiProvider}
        analysisText=""
        onAiConfigChange={vi.fn()}
        onAnalysisComplete={vi.fn()}
        onContinue={vi.fn()}
        initialDiagnosis={sd}
      />,
    );

    expect(screen.queryByTestId('diagnosis-normalization-notice')).toBeNull();
  });

  it('does NOT display the notice when normalizationEvidence is absent', () => {
    const sd = makeStructuredDiagnosis(true, ['is-1']);
    (sd as any).normalizationEvidence = undefined;

    render(
      <DiagnosisStep
        report={emptyReport}
        auditEvidence={null}
        aiConfig={stubAiConfig}
        aiProvider={stubAiProvider}
        analysisText=""
        onAiConfigChange={vi.fn()}
        onAnalysisComplete={vi.fn()}
        onContinue={vi.fn()}
        initialDiagnosis={sd}
      />,
    );

    expect(screen.queryByTestId('diagnosis-normalization-notice')).toBeNull();
  });

  it('renders correct plural when multiple findings are normalized', () => {
    const sd = makeStructuredDiagnosis(true, ['is-1', 'is-2', 'is-3']);

    render(
      <DiagnosisStep
        report={emptyReport}
        auditEvidence={null}
        aiConfig={stubAiConfig}
        aiProvider={stubAiProvider}
        analysisText=""
        onAiConfigChange={vi.fn()}
        onAnalysisComplete={vi.fn()}
        onContinue={vi.fn()}
        initialDiagnosis={sd}
      />,
    );

    expect(screen.getByTestId('diagnosis-normalization-notice').textContent).toContain('3 hallazgos');
  });
});
