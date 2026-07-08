import React from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';

interface RemediationBranchActionsProps {
  onBackToDiagnosticReport: () => void;
  onExportMain: () => void;
  showExportMain?: boolean;
  showBack?: boolean;
}

const RemediationBranchActions: React.FC<RemediationBranchActionsProps> = ({
  onBackToDiagnosticReport,
  onExportMain,
  showExportMain = true,
  showBack = true,
}) => (
  <div
    className="evidence-options"
    style={{ marginBottom: 'var(--space-md)' }}
    data-testid="remediation-branch-actions"
  >
    {showBack && (
      <button
        className="btn-s btn-sm"
        onClick={onBackToDiagnosticReport}
        data-testid="remediation-back-diagnostic-report"
      >
        <ArrowLeft size={14} /> Volver al reporte diagnóstico
      </button>
    )}
    {showExportMain && (
      <button
        className="btn-p btn-sm"
        onClick={onExportMain}
        data-testid="remediation-export-main"
      >
        <ArrowRight size={14} /> Ir a Exportación
      </button>
    )}
  </div>
);

export default RemediationBranchActions;
