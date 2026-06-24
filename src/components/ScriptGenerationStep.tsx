/**
 * Script Generation Step — Thin router between v1 and v2.
 *
 * This file only imports isContractsV2Enabled from contracts/llm.
 * All other imports are delegated to the appropriate component:
 * - v2: RemediationPlanStepV2 (NO AI imports)
 * - v1: LegacyScriptGenerationStepV1 (full AI imports)
 *
 * IMPORTANT: v2 component path must NEVER import:
 * - buildScriptPrompt
 * - buildDiagnosisSummaryPrompt
 * - extractPythonScript
 * - buildDeterministicCleaningScript
 * - aiProvider.generateText
 */
import React from 'react';
import { isContractsV2Enabled } from '../contracts/llm';
import LegacyScriptGenerationStepV1 from './LegacyScriptGenerationStepV1';
import RemediationPlanStepV2 from './RemediationPlanStepV2';
import type { AuditReport, AIProvider, ProviderMetrics, ScriptValidationResult } from '../types';
import type { DiagnosisExecutionResult, RemediationPlanV2 } from '../contracts/llm';

interface ScriptGenerationStepProps {
  report: AuditReport;
  aiProvider: AIProvider;
  diagnosisText: string;
  cleaningScript: string;
  scriptValidation: ScriptValidationResult | null;
  structuredDiagnosis?: DiagnosisExecutionResult | null;
  remediationPlan?: RemediationPlanV2 | null;
  onRemediationPlanChange?: (plan: RemediationPlanV2) => void;
  onScriptGenerated: (script: string, metrics: ProviderMetrics) => void;
  onLog?: (stage: string, msg: string) => void;
  onContinue: () => void;
}

const ScriptGenerationStep: React.FC<ScriptGenerationStepProps> = (props) => {
  const isV2 = isContractsV2Enabled() && !!props.structuredDiagnosis;

  if (isV2) {
    return (
      <RemediationPlanStepV2
        report={props.report}
        structuredDiagnosis={props.structuredDiagnosis}
        remediationPlan={props.remediationPlan}
        onRemediationPlanChange={props.onRemediationPlanChange}
        onContinue={props.onContinue}
      />
    );
  }

  return (
    <LegacyScriptGenerationStepV1
      report={props.report}
      aiProvider={props.aiProvider}
      diagnosisText={props.diagnosisText}
      cleaningScript={props.cleaningScript}
      scriptValidation={props.scriptValidation}
      onScriptGenerated={props.onScriptGenerated}
      onLog={props.onLog}
      onContinue={props.onContinue}
    />
  );
};

export default ScriptGenerationStep;
