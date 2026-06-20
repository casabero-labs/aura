import React from 'react';
import { AIConfig, InputMode } from '../../types';
import { DiagnosisCognitiveContractCanvas } from './DiagnosisCognitiveContractCanvas';

interface DiagnosisContractPanelProps {
  report: any;
  aiConfig: AIConfig;
  onInputModeChange: (mode: InputMode) => void;
  onOpenTechnicalEvidence?: () => void;
}

export const DiagnosisContractPanel: React.FC<DiagnosisContractPanelProps> = ({
  report,
  aiConfig,
  onInputModeChange,
  onOpenTechnicalEvidence,
}) => {
  return (
    <DiagnosisCognitiveContractCanvas
      aiConfig={aiConfig}
      onInputModeChange={onInputModeChange}
      onOpenTechnicalEvidence={onOpenTechnicalEvidence}
    />
  );
};

export default DiagnosisContractPanel;
