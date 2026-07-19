import { describe, expect, it } from 'vitest';
import {
  _buildEvidenceEnvelopeV2,
  type AuditReportInput,
} from '../contracts/llm/evidenceEnvelopeV2';
import { buildDiagnosisV2_5Comparison } from '../services/benchmark/diagnosisV2_5Comparison';

const report: AuditReportInput = {
  score: 90,
  rowCount: 6,
  colCount: 2,
  duplicateRows: 0,
  delimiterDetected: ',',
  issues: [
    {
      id: 'comparison:trim',
      column: 'Name',
      ruleName: 'Whitespace',
      ruleId: 'rule:trim-whitespace',
      category: 'Higiene',
      description: 'Whitespace detected',
      severity: 'info',
      count: 2,
      affectedPercentage: 33.33,
      sampleValues: [' Alice ', ' Bob '],
      automaticAuthorization: {
        actionType: 'trim_whitespace',
        authorized: true,
        conditionsMet: ['string-column'],
        reason: 'Lossless normalization',
      },
    },
    {
      id: 'comparison:null',
      column: 'Age',
      ruleName: 'Null values',
      ruleId: 'rule:null-values',
      category: 'Integridad',
      description: 'Null detected',
      severity: 'warning',
      count: 1,
      affectedPercentage: 16.67,
      sampleValues: [null],
    },
  ],
  columnStats: {
    Name: {
      inferredType: 'string', semanticType: 'name', distinctCount: 5,
      nullCount: 0, nullPercentage: 0, topValues: [], stats: {},
    },
    Age: {
      inferredType: 'number', semanticType: 'age', distinctCount: 5,
      nullCount: 1, nullPercentage: 16.67, topValues: [], stats: {},
    },
  },
  datasetProfile: { columns: [{ name: 'Name' }, { name: 'Age' }] },
};
const envelope = _buildEvidenceEnvelopeV2(report, {
  privacyLevel: 'local_full',
  datasetSha256: '6'.repeat(64),
  delimiter: ',',
});

describe('Diagnosis V2.5-C structural comparison', () => {
  it('compares every input mode over the same fixture', () => {
    const comparison = buildDiagnosisV2_5Comparison(report, envelope);

    expect(comparison.contractId).toBe('aura.diagnosis-v2.5-comparison.v1');
    expect(comparison.modes.map((entry) => entry.inputMode)).toEqual([
      'prompt_libre', 'smart_sample', 'recommended',
    ]);
    expect(comparison.methodology).toEqual(expect.objectContaining({
      comparison: 'same_report_same_envelope_same_input_mode',
      tokenizerStatus: 'structural_proxy_not_provider_tokenizer',
      modelCalls: 0,
    }));
  });

  it('keeps aliases absent from prompt_libre and present in visible modes', () => {
    const comparison = buildDiagnosisV2_5Comparison(report, envelope);
    const promptLibre = comparison.modes.find((entry) => entry.inputMode === 'prompt_libre')!;
    const smartSample = comparison.modes.find((entry) => entry.inputMode === 'smart_sample')!;
    const recommended = comparison.modes.find((entry) => entry.inputMode === 'recommended')!;

    expect(promptLibre.v2_5_c.aliasCount).toBe(0);
    expect(smartSample.v2_5_c.aliasCount).toBeGreaterThan(0);
    expect(recommended.v2_5_c.aliasCount).toBeGreaterThan(0);
    expect(smartSample.v2_5_c.internalAliasMapCharacters).toBeGreaterThan(0);
  });

  it('reports arithmetic totals without claiming provider measurements', () => {
    const comparison = buildDiagnosisV2_5Comparison(report, envelope);
    expect(comparison.totals.promptCharacterDelta).toBe(
      comparison.totals.v2_5_cPromptCharacters
      - comparison.totals.legacyPromptCharacters,
    );
    expect(comparison.totals.estimatedPromptTokenDelta).toBe(
      comparison.totals.v2_5_cEstimatedPromptTokens
      - comparison.totals.legacyEstimatedPromptTokens,
    );
    expect(comparison.conclusions.join(' ')).toContain('does not replace a model campaign');
  });
});
