// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
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

  it('offers the technical failure archive for a failed diagnosis', async () => {
    const user = userEvent.setup();
    const source = createExperimentEvidenceFixture().runs[0];
    const onDownloadFailurePackage = vi.fn();
    const run = {
      ...source,
      status: 'failed' as const,
      diagnosis: source.diagnosis && {
        ...source.diagnosis,
        status: 'failed' as const,
        error: {
          code: 'DIAGNOSIS_CONTRACT_INVALID',
          message: 'The diagnosis failed validation.',
          retryable: false,
        },
        validationErrors: [{
          code: 'DIAGNOSIS_REVIEW_DOWNGRADE',
          message: 'Must be true.',
          path: '$.issues[0].requiresHumanReview',
        }],
      },
    };

    render(
      <ExperimentRunDetail
        run={run}
        representative={false}
        onDownloadFailurePackage={onDownloadFailurePackage}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Descargar expediente del fallo (.zip)' }));
    expect(onDownloadFailurePackage).toHaveBeenCalledOnce();
  });
});
