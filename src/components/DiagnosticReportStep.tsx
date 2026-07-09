import React, { useMemo, useState } from 'react';
import { ArrowRight, FileCode2, RotateCcw, ShieldCheck, ChevronDown } from 'lucide-react';
import type { DiagnosticReport, DiagnosticFinding, DiagnosticPresentation } from '../services/diagnosticReport';
import {
  buildDiagnosticPresentation,
  formatDiagnosticSourceLabel,
} from '../services/diagnosticReport';
import {
  DiagnosticFindingGroup,
  DiagnosticRecommendationsPanel,
  DiagnosticReportChartPreview,
} from './diagnosticReport';

interface DiagnosticReportStepProps {
  diagnosticReport: DiagnosticReport;
  onExportMain: () => void;
  onGenerateScript: () => void;
  onBackToDiagnosis: () => void;
}

const VISIBLE_FINDING_LIMIT = 3;

const subtitleByStatus: Record<DiagnosticReport['status']['diagnosticStatus'], string> = {
  llm_diagnosis_available: 'AURA integró evidencia determinista y diagnóstico asistido.',
  deterministic_only: 'AURA generó un reporte con evidencia determinista. El diagnóstico asistido no está disponible.',
  llm_diagnosis_unavailable: 'AURA generó el reporte con evidencia determinista y registró la indisponibilidad del diagnóstico asistido.',
};

const severityOrder: Record<DiagnosticFinding['severity'], number> = {
  critical: 0,
  warning: 1,
  info: 2,
  good: 3,
};

const numberFormatter = new Intl.NumberFormat('es-CO');

const sortFindingsByRelevance = (findings: DiagnosticFinding[]) =>
  [...findings].sort((a, b) => {
    const sev = severityOrder[a.severity] - severityOrder[b.severity];
    if (sev !== 0) return sev;
    if (a.requiresHumanReview !== b.requiresHumanReview) {
      return a.requiresHumanReview ? -1 : 1;
    }
    return a.title.localeCompare(b.title, 'es');
  });

const formatTimestamp = (iso: string): string => {
  try {
    return new Date(iso).toLocaleString('es-CO', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
};

const FindingsGroupWithOverflow: React.FC<{
  title: string;
  description: string;
  findings: DiagnosticFinding[];
  testId: string;
  falsePositiveContext?: boolean;
}> = ({ title, description, findings, testId, falsePositiveContext }) => {
  const ordered = useMemo(() => sortFindingsByRelevance(findings), [findings]);
  const visible = ordered.slice(0, VISIBLE_FINDING_LIMIT);
  const overflow = ordered.slice(VISIBLE_FINDING_LIMIT);
  const [showAll, setShowAll] = useState(false);

  if (findings.length === 0) {
    return (
      <DiagnosticFindingGroup
        title={title}
        description={description}
        findings={[]}
        testId={testId}
        falsePositiveContext={falsePositiveContext}
      />
    );
  }

  return (
    <DiagnosticFindingGroup
      title={title}
      description={description}
      findings={showAll ? ordered : visible}
      testId={testId}
      falsePositiveContext={falsePositiveContext}
    >
      {overflow.length > 0 && !showAll && (
        <button
          type="button"
          className="diagnostic-report-overflow-toggle"
          onClick={() => setShowAll(true)}
          data-testid={`${testId}-overflow`}
        >
          Ver {overflow.length} hallazgo{overflow.length === 1 ? '' : 's'} más
        </button>
      )}
      {overflow.length > 0 && showAll && (
        <button
          type="button"
          className="diagnostic-report-overflow-toggle"
          onClick={() => setShowAll(false)}
        >
          Mostrar menos
        </button>
      )}
    </DiagnosticFindingGroup>
  );
};

const DatasetSummaryStrip: React.FC<{ report: DiagnosticReport }> = ({ report }) => {
  const fileName = report.metadata.fileName || 'Archivo sin nombre';
  const rows = report.metadata.rowCount;
  const cols = report.metadata.colCount;
  const findings = report.evidenceBase.totalIssues;
  const score = report.metadata.scoreBase;
  const generatedAt = report.metadata.generatedAt;

  return (
    <div className="diagnostic-report-summary-strip" data-testid="diagnostic-report-summary-strip">
      <div className="diagnostic-report-summary-item">
        <span className="diagnostic-report-summary-value" style={{ fontSize: '15px', wordBreak: 'break-all' }}>
          {fileName}
        </span>
        <span className="diagnostic-report-summary-label">archivo</span>
      </div>
      <div className="diagnostic-report-summary-item">
        <span className="diagnostic-report-summary-value">{numberFormatter.format(rows)}</span>
        <span className="diagnostic-report-summary-label">filas</span>
      </div>
      <div className="diagnostic-report-summary-item">
        <span className="diagnostic-report-summary-value">{numberFormatter.format(cols)}</span>
        <span className="diagnostic-report-summary-label">columnas</span>
      </div>
      <div className="diagnostic-report-summary-item">
        <span className="diagnostic-report-summary-value diagnostic-report-summary-value--critical">
          {numberFormatter.format(findings)}
        </span>
        <span className="diagnostic-report-summary-label">hallazgos</span>
      </div>
      <div className="diagnostic-report-summary-item">
        <span className="diagnostic-report-summary-value">{score}/100</span>
        <span className="diagnostic-report-summary-label">score base</span>
      </div>
      {generatedAt && (
        <div className="diagnostic-report-summary-item">
          <span className="diagnostic-report-summary-value" style={{ fontSize: '14px' }}>
            {formatTimestamp(generatedAt)}
          </span>
          <span className="diagnostic-report-summary-label">generado</span>
        </div>
      )}
    </div>
  );
};

const TechnicalEvidenceDisclosure: React.FC<{ report: DiagnosticReport }> = ({ report }) => {
  const serialized = useMemo(() => JSON.stringify(report, null, 2), [report]);
  return (
    <details className="diagnostic-report-tech-disclosure" data-testid="diagnostic-report-tech-disclosure">
      <summary className="diagnostic-report-tech-summary">
        <ChevronDown size={14} className="diagnostic-report-tech-chevron" />
        <span>Trazabilidad técnica del informe</span>
        <span className="diagnostic-report-tech-hint">
          metadatos, gráficos y payload serializado para auditoría
        </span>
      </summary>
      <div className="diagnostic-report-tech-body">
        <section className="diagnostic-report-tech-section">
          <h4>Metadatos del informe</h4>
          <dl className="diagnostic-report-tech-meta">
            <dt>Identificador</dt>
            <dd><code>{report.metadata.reportId}</code></dd>
            <dt>Versión</dt>
            <dd><code>{report.metadata.version}</code></dd>
            <dt>Generado</dt>
            <dd><code>{report.metadata.generatedAt}</code></dd>
            <dt>Huella del dataset</dt>
            <dd><code>{report.metadata.sourceDatasetFingerprint}</code></dd>
            <dt>Delimitador detectado</dt>
            <dd><code>{report.metadata.delimiter}</code></dd>
            <dt>Score base</dt>
            <dd><code>{report.metadata.scoreBase}/100</code></dd>
            <dt>Score modificado</dt>
            <dd><code>{report.metadata.scoreModified ? 'Sí' : 'No'}</code></dd>
            <dt>Estado del motor</dt>
            <dd><code>{formatDiagnosticSourceLabel(report.diagnosisSummary.source)}</code></dd>
            {report.diagnosisSummary.provider && (
              <>
                <dt>Proveedor del diagnóstico</dt>
                <dd><code>{report.diagnosisSummary.provider} · {report.diagnosisSummary.model}</code></dd>
              </>
            )}
            {report.diagnosisSummary.latencyMs !== undefined && (
              <>
                <dt>Latencia del diagnóstico</dt>
                <dd><code>{report.diagnosisSummary.latencyMs} ms</code></dd>
              </>
            )}
          </dl>
        </section>

        <section className="diagnostic-report-tech-section">
          <h4>Listo para exportar</h4>
          <ul className="diagnostic-report-tech-readiness">
            <li>PDF: {report.exportReadiness.pdfReady ? 'Listo' : 'No listo'}</li>
            <li>JSON: {report.exportReadiness.jsonReady ? 'Listo' : 'No listo'}</li>
            <li>CSV de hallazgos: {report.exportReadiness.issuesCsvReady ? 'Listo' : 'No listo'}</li>
            <li>Script opcional: {report.exportReadiness.scriptExportsReady ? 'Listo' : 'No listo'}</li>
            {report.exportReadiness.missingInputs.length > 0 && (
              <li>Entradas faltantes: {report.exportReadiness.missingInputs.join(', ')}</li>
            )}
          </ul>
        </section>

        <section className="diagnostic-report-tech-section">
          <h4>Especificación de gráficos</h4>
          <pre className="diagnostic-report-tech-pre">
            {JSON.stringify(report.chartSpecs, null, 2)}
          </pre>
        </section>

        <section className="diagnostic-report-tech-section">
          <h4>Payload técnico serializado</h4>
          <p className="diagnostic-report-tech-note">
            Vista orientada a auditoría y desarrollo. No requiere el usuario final para tomar la decisión de exportación.
          </p>
          <pre className="diagnostic-report-tech-pre diagnostic-report-tech-pre--scroll">
            {serialized}
          </pre>
        </section>
      </div>
    </details>
  );
};

const DiagnosticDecisionBrief: React.FC<{ presentation: DiagnosticPresentation }> = ({ presentation }) => (
  <section
    className={`diagnostic-report-decision diagnostic-report-decision--${presentation.decision.tone}`}
    data-testid="diagnostic-report-decision"
  >
    <div>
      <p className="sec-eye">{presentation.decision.eyebrow}</p>
      <h3>{presentation.decision.title}</h3>
      <p>{presentation.decision.body}</p>
    </div>
    <div className="diagnostic-report-decision-aside">
      <span>Siguiente paso</span>
      <strong>Exportar resultados</strong>
      <p>El cierre no exige script de limpieza.</p>
    </div>
  </section>
);

const GovernanceSummary: React.FC<{ presentation: DiagnosticPresentation }> = ({ presentation }) => (
  <div className="diagnostic-report-governance-grid" data-testid="diagnostic-report-governance">
    <section className="diagnostic-report-governance-card">
      <div className="diagnostic-report-governance-head">
        <ShieldCheck size={16} />
        <strong>Soporte del informe</strong>
      </div>
      <ul>
        {presentation.supportedClaims.map((claim) => <li key={claim}>{claim}</li>)}
      </ul>
    </section>
    <section className="diagnostic-report-governance-card diagnostic-report-governance-card--pending">
      <div className="diagnostic-report-governance-head">
        <strong>Pendiente antes de remediar</strong>
      </div>
      <ul>
        {presentation.pendingClaims.map((claim) => <li key={claim}>{claim}</li>)}
      </ul>
    </section>
  </div>
);

const ReportDisclosure: React.FC<{
  title: string;
  hint: string;
  testId?: string;
  children: React.ReactNode;
}> = ({ title, hint, testId, children }) => (
  <details className="diagnostic-report-disclosure" data-testid={testId}>
    <summary className="diagnostic-report-disclosure-summary">
      <ChevronDown size={14} className="diagnostic-report-disclosure-chevron" />
      <span>{title}</span>
      <span className="diagnostic-report-disclosure-hint">{hint}</span>
    </summary>
    <div className="diagnostic-report-disclosure-body">
      {children}
    </div>
  </details>
);

const DiagnosticReportStep: React.FC<DiagnosticReportStepProps> = ({
  diagnosticReport,
  onExportMain,
  onGenerateScript,
  onBackToDiagnosis,
}) => {
  const presentation = useMemo(() => buildDiagnosticPresentation(diagnosticReport), [diagnosticReport]);
  const observations = diagnosticReport.diagnosisSummary.observations.slice(0, 3);

  return (
    <>
      <section className="section diagnostic-report-stage" data-testid="diagnostic-report-stage">
        <div className="diagnostic-report-hero" data-testid="diagnostic-report-header">
          <div>
            <p className="sec-eye">REPORTE DIAGNÓSTICO</p>
            <h2 className="sec-title">Informe diagnóstico de calidad del dato</h2>
            <p className="section-note">{subtitleByStatus[diagnosticReport.status.diagnosticStatus]}</p>
            <p className="section-note diagnostic-report-hero-desc">
              AURA consolida los hallazgos deterministas y la interpretación asistida por IA en un informe legible, trazable y orientado a decisión.
            </p>
          </div>
          <div className="diagnostic-report-actions diagnostic-report-actions--top">
            <button className="btn-p" onClick={onExportMain} data-testid="diagnostic-report-export-main">
              <ArrowRight size={14} /> Ir a la Exportación
            </button>
            <button className="btn-s" onClick={onBackToDiagnosis} data-testid="diagnostic-report-back-diagnosis">
              <RotateCcw size={14} /> Volver al diagnóstico
            </button>
          </div>
        </div>

      <DatasetSummaryStrip report={diagnosticReport} />

      <DiagnosticDecisionBrief presentation={presentation} />

      <section className="diagnostic-report-executive" data-testid="diagnostic-report-executive-summary">
        <div className="diagnostic-report-section-head">
          <div>
            <p className="sec-eye">resumen ejecutivo</p>
            <h3>Resumen ejecutivo</h3>
          </div>
          <span className="diagnostic-report-badge">{presentation.sourceLabel}</span>
        </div>
        {presentation.executiveSummary ? (
          <>
            <p>{presentation.executiveSummary}</p>
            {observations.length > 0 && (
              <div className="diagnostic-report-observations">
                <span>Lecturas relevantes</span>
                <ol>
                  {observations.map((observation) => (
                    <li key={observation.id}>{observation.text}</li>
                  ))}
                </ol>
              </div>
            )}
            {diagnosticReport.diagnosisSummary.limitations.length > 0 && (
              <div className="diagnostic-report-limitations">
                <span>Limitaciones visibles</span>
                <ul>
                  {diagnosticReport.diagnosisSummary.limitations.slice(0, 3).map((limitation) => (
                    <li key={limitation}>{limitation}</li>
                  ))}
                </ul>
              </div>
            )}
          </>
        ) : (
          <p className="diagnostic-report-empty">
            No hay suficiente información asistida para construir un resumen ejecutivo. Puedes volver al diagnóstico o continuar con la evidencia determinista disponible.
          </p>
        )}
      </section>

      <ReportDisclosure
        title="Ver gráficos del informe"
        hint="visualizaciones solo cuando aportan lectura"
        testId="diagnostic-report-chart-disclosure"
      >
        <DiagnosticReportChartPreview chartSpecs={diagnosticReport.chartSpecs} />
      </ReportDisclosure>

      <ReportDisclosure
        title="Ver hallazgos agrupados"
        hint="riesgos, falsos positivos y revisión humana"
        testId="diagnostic-report-findings-disclosure"
      >
        <div className="diagnostic-report-findings-grid">
          <FindingsGroupWithOverflow
            title="Riesgos confirmados"
            description="Hallazgos deterministas que se mantienen como riesgos relevantes del dataset."
            findings={diagnosticReport.findingGroups.confirmedRisks}
            testId="diagnostic-report-confirmed-risks"
          />
          <FindingsGroupWithOverflow
            title="Posibles falsos positivos contextuales"
            description="Candidatos que podrían requerir contexto adicional antes de remediar o descartar."
            findings={diagnosticReport.findingGroups.possibleFalsePositiveCandidates}
            testId="diagnostic-report-false-positive-candidates"
            falsePositiveContext
          />
          <FindingsGroupWithOverflow
            title="Requieren revisión humana"
            description="Elementos donde la decisión de dominio no debe automatizarse."
            findings={diagnosticReport.findingGroups.humanReviewRequired}
            testId="diagnostic-report-human-review"
          />
          <FindingsGroupWithOverflow
            title="Candidatos de remediación opcional"
            description="Hallazgos donde AURA puede ayudar a preparar un script, sin convertirlo en requisito."
            findings={diagnosticReport.findingGroups.optionalRemediationCandidates}
            testId="diagnostic-report-optional-remediation"
          />
        </div>
      </ReportDisclosure>

      <ReportDisclosure
        title="Ver recomendaciones y límites"
        hint="acciones sugeridas y alcance defendible"
        testId="diagnostic-report-recommendations-disclosure"
      >
        <DiagnosticRecommendationsPanel recommendations={diagnosticReport.recommendations} />
        <GovernanceSummary presentation={presentation} />
      </ReportDisclosure>

      <ReportDisclosure
        title="Remediación opcional"
        hint="preparar script solo si decides limpiar después de revisar"
        testId="diagnostic-report-remediation-disclosure"
      >
        <div className="diagnostic-report-remediation-lite">
          <p>La exportación del informe no depende de un script. Usa esta opción solo si quieres preparar una limpieza revisable aparte.</p>
          <button className="btn-s" onClick={onGenerateScript} data-testid="diagnostic-report-generate-script">
            <FileCode2 size={14} /> Preparar script revisable
          </button>
        </div>
      </ReportDisclosure>
    </section>

    <TechnicalEvidenceDisclosure report={diagnosticReport} />
    </>
  );
};

export default DiagnosticReportStep;
