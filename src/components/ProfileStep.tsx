import React from 'react';
import { ArrowRight } from 'lucide-react';
import BoxPlot from './BoxPlot';
import ColumnStatsPanel from './ColumnStatsPanel';
import DatasetProfile from './DatasetProfile';
import DeterministicEngineSummary from './DeterministicEngineSummary';
import FindingsTable from './FindingsTable';
import ProfileEvidencePackage from './ProfileEvidencePackage';
import ProfileStageHeader from './ProfileStageHeader';
import RuleActivationMatrix from './RuleActivationMatrix';
import { AuditExecutionEvidence, AuditReport } from '../types';

interface ProfileStepProps {
  report: AuditReport;
  auditEvidence: AuditExecutionEvidence;
  file?: File | null;
  onContinue: () => void;
}

const ProfileStep: React.FC<ProfileStepProps> = ({ report, auditEvidence, file, onContinue }) => {
  const hasIqrColumns = Object.values(report.columnStats).some((column) => column.inferredType === 'number' && column.iqr && column.iqr > 0);

  return (
    <>
      <ProfileStageHeader report={report} />

      <section className="profile-block" aria-labelledby="profile-characterization-title">
        <div className="profile-block-header">
          <span className="profile-block-index">01</span>
          <div>
            <p className="sec-eye">caracterización</p>
            <h2 id="profile-characterization-title" className="sec-title">Estructura y perfil estadístico del dataset.</h2>
          </div>
        </div>
        <DatasetProfile
          report={report}
          fileName={file?.name}
          fileSize={file?.size}
          parseDurationMs={auditEvidence.parseDurationMs}
          auditDurationMs={auditEvidence.auditDurationMs}
          datasetFingerprint={auditEvidence.datasetFingerprint}
        />

        <section className="section section-nested profile-statistics-group" id="column-profile">
          <ColumnStatsPanel columnStats={report.columnStats} totalRows={report.rowCount} />
        </section>

        {hasIqrColumns && (
          <section className="section section-nested profile-statistics-group" id="boxplot">
            <BoxPlot columnStats={report.columnStats} />
          </section>
        )}
      </section>

      <section className="profile-block" aria-labelledby="profile-validation-title">
        <div className="profile-block-header">
          <span className="profile-block-index">02</span>
          <div>
            <p className="sec-eye">validación determinista</p>
            <h2 id="profile-validation-title" className="sec-title">Reglas aplicadas y score reproducible.</h2>
          </div>
        </div>

        <DeterministicEngineSummary report={report} auditEvidence={auditEvidence} />

        <section className="section section-nested" id="rule-matrix">
          <RuleActivationMatrix issues={report.issues} />
        </section>
      </section>

      <section className="profile-block" aria-labelledby="profile-findings-title">
        <div className="profile-block-header">
          <span className="profile-block-index">03</span>
          <div>
            <p className="sec-eye">hallazgos y evidencia</p>
            <h2 id="profile-findings-title" className="sec-title">Problemas observados y paquete estructurado.</h2>
          </div>
        </div>

        <FindingsTable issues={report.issues} rowCount={report.rowCount} />

        <ProfileEvidencePackage report={report} />
      </section>

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
