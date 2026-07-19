import {
  buildDiagnosisSystemInstructionV2,
  buildDiagnosisResponseSchemaV2,
  buildEnvelopeRef,
  canonicalJson,
  composeExactDiagnosisPromptV2,
  DIAGNOSIS_PROMPT_VERSION_V2,
} from './diagnosisPromptV2';
import {
  buildDiagnosisInputPackageCoreV2,
  DIAGNOSIS_INCLUDED_SECTIONS_BY_MODE,
  type DiagnosisInputReport,
} from './diagnosisInputPackageCoreV2';
import type {
  DiagnosisInputModeV2,
  DiagnosisInputPackageV2,
  DiagnosisPromptOptionsV2,
  EvidenceEnvelopeV2,
} from './types';

const dependencies = {
  buildDiagnosisSystemInstructionV2,
  buildDiagnosisResponseSchemaV2,
  buildEnvelopeRef,
  canonicalJson,
  composeExactDiagnosisPromptV2,
  promptVersion: DIAGNOSIS_PROMPT_VERSION_V2,
};

export { DIAGNOSIS_INCLUDED_SECTIONS_BY_MODE };
export type { DiagnosisInputReport };

export const exactDiagnosisPromptV2 = (
  input: Pick<DiagnosisInputPackageV2, 'systemInstruction' | 'userPayload' | 'responseSchema'>,
): string => composeExactDiagnosisPromptV2(
  input.systemInstruction,
  input.userPayload,
  input.responseSchema,
);

export const buildDiagnosisInputPackageV2 = (
  report: DiagnosisInputReport,
  envelope: EvidenceEnvelopeV2,
  inputMode: DiagnosisInputModeV2,
  options?: DiagnosisPromptOptionsV2,
): DiagnosisInputPackageV2 => buildDiagnosisInputPackageCoreV2(
  report,
  envelope,
  inputMode,
  dependencies,
  options,
);
