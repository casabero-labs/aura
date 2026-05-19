import React from 'react';
import { ArrowRight } from 'lucide-react';
import BoxPlot from './BoxPlot';
import ColumnStatsPanel from './ColumnStatsPanel';
import DatasetProfile from './DatasetProfile';
import DeterministicEngineSummary from './DeterministicEngineSummary';
import FindingsTable from './FindingsTable';
import ProfileEvidencePackage from './ProfileEvidencePackage';
import RuleActivationMatrix from './RuleActivationMatrix';
import ScoreBreakdown from './ScoreBreakdown';
import { AuditExecutionEvidence, AuditReport, IssueSeverity } from '../types';

interface ProfileStepProps {
  report: AuditReport;
  auditEvidence: AuditExecutionEvidence;
  file?: File | null;
  onContinue: () => void;
}

const countBySeverity = (report: AuditReport, severity: IssueSeverity) =>
  report.issues.filter((issue) => issue.severity === severity).length;

const ProfileStep: React.FC<ProfileStepProps> = ({ report, auditEvidence, file, onContinue }) => {
  const criticalCount = countBySeverity(report, IssueSeverity.CRITICAL);
  const warningCount = countBySeverity(report, IssueSeverity.WARNING);
  const infoCount = countBySeverity(report, IssueSeverity.INFO);
  const hasIqrColumns = Object.values(report.columnStats).some((column) => column.inferredType === 'number' && column.iqr && column.iqr > 0);

  return (
    <>
      <DatasetProfile
        report={report}
        fileName={file?.name}
        fileSize={file?.size}
        parseDurationMs={auditEvidence.parseDurationMs}
        auditDurationMs={auditEvidence.auditDurationMs}
        datasetFingerprint={auditEvidence.datasetFingerprint}
      />

      <DeterministicEngineSummary report={report} auditEvidence={auditEvidence} />

      <section className="section" id="score-section">
        <div className="section-header">
          <div>
            <p className="sec-eye">perfil del dataset</p>
            <h2 className="sec-title">Score y reglas de validación.</h2>
          </div>
        </div>
        <div className="score-grid">
          <div>
            <h2 className="hero-h1 score-title">{report.score}<em>%</em></h2>
            <p className="section-note">
              {report.score >= 80
                ? 'Perfil estable según las reglas aplicadas.'
                : 'El perfil activa reglas que requieren revisión antes de usar el dataset.'}
            </p>
            <div className="issue-summary">
              <span className="issue-badge critical">{criticalCount} críticos</span>
              <span className="issue-badge warning">{warningCount} advertencias</span>
              <span className="issue-badge info">{infoCount} info</span>
            </div>
          </div>
          <div className="score-bars">
            <ScoreBreakdown deductions={report.scoreBreakdown} />
          </div>
        </div>
      </section>

      <section className="section" id="column-profile">
        <ColumnStatsPanel columnStats={report.columnStats} />
      </section>

      {hasIqrColumns && (
        <section className="section" id="boxplot">
          <BoxPlot columnStats={report.columnStats} />
        </section>
      )}

      <FindingsTable issues={report.issues} rowCount={report.rowCount} />

      <section className="section" id="rule-matrix">
        <RuleActivationMatrix issues={report.issues} rowCount={report.rowCount} />
      </section>

      <ProfileEvidencePackage report={report} />

      <div className="context-guide">
        <span className="guide-icon"><ArrowRight size={14} /></span>
        <div>
          <p className="guide-title">Perfil listo para interpretar</p>
          <p className="guide-desc">Ya conoces estructura, reglas activadas y evidencia observada. El siguiente paso explica causas probables y prioridades.</p>
        </div>
        <button className="btn-p btn-sm" onClick={onContinue}>
          Abrir diagnóstico <ArrowRight size={12} />
        </button>
      </div>
    </>
  );
};

export default ProfileStep;

