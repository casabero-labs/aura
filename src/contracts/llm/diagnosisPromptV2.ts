/**
 * Diagnosis Prompt v2 compatibility facade.
 *
 * Canonical input construction lives exclusively in diagnosisInputPackageV2.
 * This module keeps the historical public function names temporarily so older
 * call sites do not bypass the input-mode snapshot architecture.
 */

import {
  buildDiagnosisInputPackageV2,
  diagnosisInputReportFromEnvelope,
  toDiagnosisPromptPackageV2,
} from './diagnosisInputPackageV2';
import type {
  DiagnosisInputModeV2,
  DiagnosisPromptOptionsV2,
  DiagnosisPromptPackageV2,
  EvidenceEnvelopeV2,
} from './types';

export * from './diagnosisPromptCoreV2';

const buildCompatibilityPromptPackage = (
  envelope: EvidenceEnvelopeV2,
  inputMode: DiagnosisInputModeV2,
  options?: DiagnosisPromptOptionsV2,
): DiagnosisPromptPackageV2 => {
  const report = diagnosisInputReportFromEnvelope(envelope);
  const input = buildDiagnosisInputPackageV2(report, envelope, inputMode, options);
  return toDiagnosisPromptPackageV2(input);
};

/**
 * @deprecated Use buildDiagnosisInputPackageV2(report, envelope, inputMode)
 * followed by exactDiagnosisPromptV2 or toDiagnosisPromptPackageV2.
 *
 * This compatibility wrapper now delegates to the canonical smart_sample mode.
 * It no longer owns a parallel payload architecture.
 */
export function buildDiagnosisPromptV2(
  envelope: EvidenceEnvelopeV2,
  options?: DiagnosisPromptOptionsV2,
): DiagnosisPromptPackageV2 {
  return buildCompatibilityPromptPackage(envelope, 'smart_sample', options);
}

/**
 * @deprecated The manual compact prompt was structurally unsafe because it
 * could show fewer issues than the response schema required. Use the canonical
 * prompt_libre mode or reduce the EvidenceEnvelopeV2 token budget instead.
 *
 * This compatibility wrapper delegates to prompt_libre and preserves exact
 * coverage for every issue in the envelope.
 */
export function buildCompactDiagnosisPromptV2(
  envelope: EvidenceEnvelopeV2,
  options?: DiagnosisPromptOptionsV2,
): DiagnosisPromptPackageV2 {
  return buildCompatibilityPromptPackage(envelope, 'prompt_libre', options);
}
