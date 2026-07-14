// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ExperimentRunDetail from '../components/benchmark/ExperimentRunDetail';
import { createExperimentEvidenceFixture } from './fixtures/experimentEvidenceFixture';

describe('ExperimentRunDetail', () => {
  it('presents a truncated run in plain Spanish and keeps raw identifiers folded', () => {
    const source = createExperimentEvidenceFixture().runs[0];
    const run = {
      ...source,
      status: 'failed' as const,
      diagnosis: source.diagnosis && {
        ...source.diagnosis,
        status: 'failed' as const,
        error: {
          code: 'DIAGNOSIS_RESPONSE_TRUNCATED',
          message: 'Ollama reached its output limit after 1600 tokens before completing the JSON response.',
          path: '$',
          details: {},
          retryable: false,
        },
        validationErrors: [{
          code: 'DIAGNOSIS_RESPONSE_TRUNCATED',
          message: 'Provider reported done_reason=length.',
          path: '$',
        }],
      },
    };

    render(<ExperimentRunDetail run={run} representative={false} />);

    expect(screen.getByText('fallida')).toBeTruthy();
    expect(screen.getByText('Qwen3.5 4B')).toBeTruthy();
    expect(screen.getByText('Respuesta incompleta')).toBeTruthy();
    expect(screen.getByText(/alcanzó el límite de salida/)).toBeTruthy();
    expect(screen.getByText('Trazabilidad técnica')).toBeTruthy();
  });
});
