// @vitest-environment jsdom
/**
 * Regression: without a validated V2 diagnosis the script step must not reach
 * a model. The removed V1 path sent raw sample values to generateText.
 */
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ScriptGenerationStep, { scriptRequiresV2DiagnosisCopy } from '../components/ScriptGenerationStep';
import type { AIProvider, AuditReport } from '../types';

const report = {
  rowCount: 3,
  colCount: 1,
  score: 70,
  delimiterDetected: ',',
  duplicateRows: 0,
  columnStats: {
    email: { name: 'email', inferredType: 'string', nullCount: 0, uniqueCount: 3, sampleValues: ['ana@example.com'], topFreq: [{ value: 'ana@example.com', count: 1 }] },
  },
  issues: [{ id: 'i1', ruleName: 'PII', category: 'privacy', column: 'email', severity: 'critical', count: 1, affectedPercentage: 33, description: 'PII', sampleValues: ['ana@example.com'] }],
} as unknown as AuditReport;

const makeProvider = () => {
  const generateText = vi.fn().mockResolvedValue({ text: '```python\nprint(1)\n```', metrics: {} });
  const generateTextWithProgress = vi.fn();
  const analyzeStream = vi.fn();
  const provider = { name: 'spy', type: 'ollama', generateText, generateTextWithProgress, analyzeStream } as unknown as AIProvider;
  return { provider, generateText, generateTextWithProgress, analyzeStream };
};

describe('ScriptGenerationStep without a structured diagnosis', () => {
  afterEach(() => cleanup());

  it.each([null, undefined])('structuredDiagnosis=%s never calls the model and explains why', async (structuredDiagnosis) => {
    const { provider, generateText, generateTextWithProgress, analyzeStream } = makeProvider();
    const onScriptGenerated = vi.fn();
    render(
      <ScriptGenerationStep
        report={report}
        aiProvider={provider}
        diagnosisText="Diagnóstico libre con ana@example.com"
        cleaningScript=""
        scriptValidation={null}
        structuredDiagnosis={structuredDiagnosis}
        onScriptGenerated={onScriptGenerated}
        onContinue={() => {}}
      />,
    );

    expect(screen.getByTestId('script-requires-v2-diagnosis')).toBeTruthy();
    expect(screen.getByText(scriptRequiresV2DiagnosisCopy.title)).toBeTruthy();
    // No button can trigger a free-text generation.
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    await new Promise((r) => setTimeout(r, 0));
    expect(generateText).not.toHaveBeenCalled();
    expect(generateTextWithProgress).not.toHaveBeenCalled();
    expect(analyzeStream).not.toHaveBeenCalled();
    expect(onScriptGenerated).not.toHaveBeenCalled();
  });

  it('the legacy V1 component and its free-text summary prompt are gone', async () => {
    expect(existsSync(resolve(__dirname, '../components/LegacyScriptGenerationStepV1.tsx'))).toBe(false);
    const source = readFileSync(resolve(__dirname, '../components/ScriptGenerationStep.tsx'), 'utf8');
    expect(source).not.toMatch(/^import .*LegacyScriptGenerationStepV1/m);
    expect(source).not.toMatch(/generateText\(/);
    const prompts = await import('../services/providers/prompts');
    expect('buildDiagnosisSummaryPrompt' in prompts).toBe(false);
  });
});
