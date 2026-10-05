/**
 * Golden fixture — a real Gemini Nano run (Chrome 154, titanic.csv, 10 issues).
 *
 * The fragments are the model's verbatim outputs. This test replays them
 * through the current code: envelope → input package → fragment requests →
 * assembly → strict validation. It fails when:
 *   - the evidence or the fragment prompts change (hash drift): the change may
 *     be legitimate, but then the fixture must be re-captured with the real
 *     model (see AGENTS.md § "Invariantes del pipeline" → recapturar Nano);
 *   - the parser/validator starts rejecting what Nano really produces.
 */
import { describe, expect, it } from 'vitest';
import fixture from '../fixtures/nano-titanic-fragments.fixture.json';

(import.meta as any).env = { ...((import.meta as any).env || {}), VITE_CONTRACTS_V2_ENABLED: 'true' };

import {
  buildDiagnosisInputPackageV2,
  buildEvidenceEnvelopeV2,
  processDiagnosisResponseV2,
} from '../../contracts/llm';
import {
  assembleDiagnosisFromFragmentsV2,
  buildDiagnosisFragmentRequestsV2,
} from '../../contracts/llm/diagnosisFragmentsV2';
import type { DiagnosisInputModeV2, DiagnosisInputPackageV2 } from '../../contracts/llm/types';

const RECAPTURE = 'Evidence or fragment prompts changed. If intended, re-capture the Nano fixture with the real model (AGENTS.md § Invariantes del pipeline).';

const rebuild = () => {
  const envelope = buildEvidenceEnvelopeV2(fixture.report as any, fixture.envelopeOptions as any);
  const input = buildDiagnosisInputPackageV2(fixture.report as any, envelope, fixture.inputMode as DiagnosisInputModeV2);
  return { envelope, input };
};

describe('Gemini Nano golden fixture', () => {
  it('the evidence sent to the model is unchanged', () => {
    const { input } = rebuild();
    expect(input.inputHash, RECAPTURE).toBe((fixture.inputSnapshot as DiagnosisInputPackageV2).inputHash);
  });

  it('each fragment request is byte-identical to the one Nano answered', () => {
    const { input } = rebuild();
    const recorded = new Map(fixture.fragments.map((fragment) => [fragment.issueId, fragment.promptHash]));
    for (const request of buildDiagnosisFragmentRequestsV2(input)) {
      expect(request.promptHash, `${request.issueId}: ${RECAPTURE}`).toBe(recorded.get(request.issueId));
    }
  });

  it('the real model outputs still assemble and pass strict validation', () => {
    const { envelope, input } = rebuild();
    const assembly = assembleDiagnosisFromFragmentsV2(input, envelope, fixture.fragments, '2026-10-03T12:35:48.000Z');
    expect(assembly.success, JSON.stringify(assembly)).toBe(true);
    if (!assembly.success) return;
    const outcome = processDiagnosisResponseV2(envelope, assembly.rawResponse, input);
    expect(outcome.success, JSON.stringify((outcome as any).details ?? (outcome as any).message)).toBe(true);
  });
});
