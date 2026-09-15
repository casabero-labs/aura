import React, { useMemo, useState } from 'react';
import { ArrowRight, ChevronDown, FileCode2, RotateCcw, ShieldCheck } from 'lucide-react';
import type { DiagnosticFinding, DiagnosticPresentation, DiagnosticReport } from '../services/diagnosticReport';
import {
  buildDiagnosticPresentation,
  formatDiagnosticSourceLabel,
} from '../services/diagnosticReport';
import {
  DiagnosticFindingGroup,
  DiagnosticRecommendationsPanel,
  DiagnosticReportChartPreview,
} from './diagnosticReport';
import SyntaxDisplay from './SyntaxDisplay';

interface DiagnosticReportEvaluationSummary {
  contractErrorsCount?: number | null;
  unsupportedClaimsCount?: number | null;
  anchoredBadSampleRefsCount?: number | null;
  syntaxValid?: boolean | null;
  pythonExecutionStatus?: string | null;
  reauditSummary?: string | null;
  repetition?: number | null;
}

interface DiagnosticReportStepProps {
  diagnosticReport: DiagnosticReport;
  evaluationSummary?: DiagnosticReportEvaluationSummary | null;
  onExportMain: () => void;
  onGenerateScript: () => void;
  onBackToDiagnosis: () => void;
  remediationAvailable?: boolean;
}

const VISIBLE_FINDING_LIMIT = 4;

const subtitleByStatus: Record<DiagnosticReport['status']['diagnosticStatus'], string> = {
  llm_diagnosis_available: 'AURA integró evidencia determinista y diagnóstico asistido.',
  deterministic_only: 'AURA generó un informe basado en evidencia determinista.',
  llm_diagnosis_unavailable: 'AURA conservó la evidencia determinista y registró que el diagnóstico asistido no estuvo disponible.',
};

const numberFormatter = new Intl.NumberFormat('es-CO');

const findingGroupDefinitions = [
  { key: 'confirmedRisks', label: 'Hallazgo determinista' },
  { key: 'possibleFalsePositiveCandidates', label: 'Señal pendiente de contexto' },
  { key: 'humanReviewRequired', label: 'Decisión humana' },
  { key: 'optionalRemediationCandidates', label: 'Remediación opcional' },
] as const;

interface PrimaryFindingsView {
  findings: DiagnosticFinding[];
  attributes: Record<string, string[]>;
  falsePositiveFindingIds: string[];
}

const stableUnique = (values: string[]): string[] => [...new Set(values)];

const buildPrimaryFindingsView = (report: DiagnosticReport): PrimaryFindingsView => {
  const findingsById = new Map<string, DiagnosticFinding>();
  const attributes: Record<string, string[]> = {};
  const falsePositiveFindingIds: string[] = [];

  findingGroupDefinitions.forEach(({ key, label }) => {
    report.findingGroups[key].forEach((finding) => {
      const existing = findingsById.get(finding.id);
      const requiresHumanReview = key === 'humanReviewRequired'
        || finding.requiresHumanReview
        || existing?.requiresHumanReview === true;

      findingsById.set(finding.id, existing
        ? {
            ...existing,
            sourceIssueIds: stableUnique([...existing.sourceIssueIds, ...finding.sourceIssueIds]),
            columns: stableUnique([...existing.columns, ...finding.columns]),
            requiresHumanReview,
            canGenerateScript: existing.canGenerateScript || finding.canGenerateScript,
          }
        : {
            ...finding,
            sourceIssueIds: [...finding.sourceIssueIds],
            columns: [...finding.columns],
            requiresHumanReview,
          });

      attributes[finding.id] = stableUnique([...(attributes[finding.id] ?? []), label]);
      if (key === 'possibleFalsePositiveCandidates' && !falsePositiveFindingIds.includes(finding.id)) {
        falsePositiveFindingIds.push(finding.id);
      }
    });
  });

  return {
    findings: [...findingsById.values()],
    attributes,
    falsePositiveFindingIds,
  };
};

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
  findingAttributes?: Readonly<Record<string, readonly string[]>>;
  falsePositiveFindingIds?: readonly string[];
}> = ({
  title,
  description,
  findings,
  testId,
  falsePositiveContext,
  findingAttributes,
  falsePositiveFindingIds,
}) => {
  const ordered = useMemo(() => [...findings], [findings]);
  const visible = ordered.slice(0, VISIBLE_FINDING_LIMIT);
  const overflow = ordered.slice(VISIBLE_FINDING_LIMIT);
  const [showAll, setShowAll] = useState(false);

  return (
    <DiagnosticFindingGroup
      title={title}
      description={description}
      findings={showAll ? ordered : visible}
      testId={testId}
      falsePositiveContext={falsePositiveContext}
      findingAttributes={findingAttributes}
      falsePositiveFindingIds={falsePositiveFindingIds}
    >
      {overflow.length > 0 && (
        <button
          type="button"
          className="diagnostic-report-overflow-toggle"
          onClick={() => setShowAll((current) => !current)}
          data-testid={`${testId}-overflow`}
        >
          {showAll
            ? 'Mostrar menos'
            : `Ver ${overflow.length} hallazgo${overflow.length === 1 ? '' : 's'} más`}
        </button>
      )}
    </DiagnosticFindingGroup>
  );
};

const DatasetSummaryStrip: React.FC<{ report: DiagnosticReport; findingCount: number }> = ({ report, findingCount }) => (
  <div className="diagnostic-report-summary-strip" data-testid="diagnostic-report-summary-strip">
    <div className="diagnostic-report-summary-item">
      <span className="diagnostic-report-summary-value" style={{ fontSize: '15px', wordBreak: 'break-all' }}>
        {report.metadata.fileName || 'Archivo sin nombre'}
      </span>
      <span className="diagnostic-report-summary-label">archivo</span>
    </div>
    <div className="diagnostic-report-summary-item">
      <span className="diagnostic-report-summary-value">{numberFormatter.format(report.metadata.rowCount)}</span>
      <span className="diagnostic-report-summary-label">filas</span>
    </div>
    <div className="diagnostic-report-summary-item">
      <span className="diagnostic-report-summary-value">{numberFormatter.format(report.metadata.colCount)}</span>
      <span className="diagnostic-report-summary-label">columnas</span>
    </div>
    <div className="diagnostic-report-summary-item">
      <span
        className="diagnostic-report-summary-value diagnostic-report-summary-value--critical"
        data-testid="diagnostic-report-findings-count"
      >
        {numberFormatter.format(findingCount)}
      </span>
      <span className="diagnostic-report-summary-label">hallazgos únicos</span>
    </div>
    <div className="diagnostic-report-summary-item">
      <span className="diagnostic-report-summary-value">{report.metadata.scoreBase}/100</span>
      <span className="diagnostic-report-summary-label">score base</span>
    </div>
    {report.metadata.generatedAt && (
      <div className="diagnostic-report-summary-item">
        <span className="diagnostic-report-summary-value" style={{ fontSize: '14px' }}>
          {formatTimestamp(report.metadata.generatedAt)}
        </span>
        <span className="diagnostic-report-summary-label">generado</span>
      </div>
    )}
  </div>
);

const DiagnosticInvocationSummary: React.FC<{
  report: DiagnosticReport;
  evaluation?: DiagnosticReportEvaluationSummary | null;
}> = ({ report, evaluation }) => {
  const receipt = report.diagnosisSummary.executionReceipt;
  const hasRealInvocation = Boolean(
    receipt
    || report.diagnosisSummary.provider
    || report.diagnosisSummary.model
    || report.diagnosisSummary.inputMode
    || report.diagnosisSummary.latencyMs !== undefined,
  );

  if (!hasRealInvocation) return null;

  const requestedModel = receipt?.requestedModel ?? report.diagnosisSummary.model ?? 'No registrado';
  const observedModel = receipt?.observedModel ?? 'No observado';
  const latency = report.diagnosisSummary.latencyMs;

  return (
    <section className="diagnostic-invocation-summary" data-testid="diagnostic-invocation-summary">
      <div className="diagnostic-report-section-head">
        <div>
          <p className="sec-eye">diagnóstico asistido</p>
          <h3>Ejecución del modelo</h3>
        </div>
      </div>
      <div className="diagnostic-invocation-grid">
        <div className="diagnostic-invocation-item">
          <span className="diagnostic-invocation-label">Modelo solicitado</span>
          <span className="diagnostic-invocation-value">{requestedModel}</span>
        </div>
        <div className="diagnostic-invocation-item">
          <span className="diagnostic-invocation-label">Modelo observado</span>
          <span className="diagnostic-invocation-value">{observedModel}</span>
        </div>
        <div className="diagnostic-invocation-item">
          <span className="diagnostic-invocation-label">Método</span>
          <span className="diagnostic-invocation-value">{report.diagnosisSummary.inputMode ?? 'No registrado'}</span>
        </div>
        <div className="diagnostic-invocation-item">
          <span className="diagnostic-invocation-label">Latencia</span>
          <span className="diagnostic-invocation-value">
            {latency !== undefined ? `${(latency / 1000).toFixed(1)} s` : 'No registrada'}
          </span>
        </div>
        <div className="diagnostic-invocation-item">
          <span className="diagnostic-invocation-label">Contrato</span>
          <span className="diagnostic-invocation-value">
            {receipt
              ? (receipt.validationStatus === 'valid' ? 'Válido' : 'No válido')
              : 'No evaluado'}
          </span>
        </div>
      </div>
      {evaluation && (
        <div className="diagnostic-invocation-grid" data-testid="diagnostic-invocation-evaluation">
          <div className="diagnostic-invocation-item">
            <span className="diagnostic-invocation-label">Errores del contrato</span>
            <span className="diagnostic-invocation-value">
              {evaluation.contractErrorsCount == null
                ? 'No medido'
                : `${evaluation.contractErrorsCount} error${evaluation.contractErrorsCount === 1 ? '' : 'es'}`}
            </span>
          </div>
          <div className="diagnostic-invocation-item">
            <span className="diagnostic-invocation-label">Claims sin soporte</span>
            <span className="diagnostic-invocation-value">
              {evaluation.unsupportedClaimsCount == null
                ? 'No medido'
                : `${evaluation.unsupportedClaimsCount} claim${evaluation.unsupportedClaimsCount === 1 ? '' : 's'}`}
            </span>
          </div>
          <div className="diagnostic-invocation-item">
            <span className="diagnostic-invocation-label">Muestras problemáticas ancladas</span>
            <span className="diagnostic-invocation-value">
              {evaluation.anchoredBadSampleRefsCount == null
                ? 'No medido'
                : `${evaluation.anchoredBadSampleRefsCount} referencia${evaluation.anchoredBadSampleRefsCount === 1 ? '' : 's'}`}
            </span>
          </div>
          <div className="diagnostic-invocation-item">
            <span className="diagnostic-invocation-label">Sintaxis del script</span>
            <span className="diagnostic-invocation-value">
              {evaluation.syntaxValid == null ? 'No medido' : evaluation.syntaxValid ? 'Verificada' : 'Fallida'}
            </span>
          </div>
          <div className="diagnostic-invocation-item">
            <span className="diagnostic-invocation-label">Ejecución Python</span>
            <span className="diagnostic-invocation-value">{evaluation.pythonExecutionStatus ?? 'No medido'}</span>
          </div>
          <div className="diagnostic-invocation-item">
            <span className="diagnostic-invocation-label">Reauditoría</span>
            <span className="diagnostic-invocation-value">{evaluation.reauditSummary ?? 'No medido'}</span>
          </div>
        </div>
      )}
    </section>
  );
};

const DiagnosticDecisionBrief: React.FC<{ presentation: DiagnosticPresentation }> = ({ presentation }) => (
  <section
    className={`diagnostic-report-decision diagnostic-report-decision--${presentation.decision.tone}`}
    data-testid="diagnostic-report-decision"
  >
    <div>
      <p className="sec-eye">lectura principal</p>
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
        <strong>Qué está respaldado</strong>
      </div>
      <ul>{presentation.supportedClaims.map((claim) => <li key={claim}>{claim}</li>)}</ul>
    </section>
    <section className="diagnostic-report-governance-card diagnostic-report-governance-card--pending">
      <div className="diagnostic-report-governance-head"><strong>Qué sigue pendiente</strong></div>
      <ul>{presentation.pendingClaims.map((claim) => <li key={claim}>{claim}</li>)}</ul>
    </section>
  </div>
);

const ReportDisclosure: React.FC<{
  title: string;
  hint: string;
  testId: string;
  children: React.ReactNode;
}> = ({ title, hint, testId, children }) => (
  <details className="diagnostic-report-disclosure" data-testid={testId}>
    <summary className="diagnostic-report-disclosure-summary">
      <ChevronDown size={14} className="diagnostic-report-disclosure-chevron" />
      <span>{title}</span>
      <span className="diagnostic-report-disclosure-hint">{hint}</span>
    </summary>
    <div className="diagnostic-report-disclosure-body">{children}</div>
  </details>
);

const TechnicalEvidenceDisclosure: React.FC<{ report: DiagnosticReport }> = ({ report }) => {
  const serialized = useMemo(() => JSON.stringify(report, null, 2), [report]);

  return (
    <details className="diagnostic-report-tech-disclosure" data-testid="diagnostic-report-tech-disclosure">
      <summary className="diagnostic-report-tech-summary">
        <ChevronDown size={14} className="diagnostic-report-tech-chevron" />
        <span>Ver evidencia técnica</span>
        <span className="diagnostic-report-tech-hint">metadatos y expediente serializado para auditoría</span>
      </summary>
      <div className="diagnostic-report-tech-body">
        <section className="diagnostic-report-tech-section">
          <h4>Metadatos del informe</h4>
          <dl className="diagnostic-report-tech-meta">
            <dt>Identificador</dt>
            <dd><code>{report.metadata.reportId}</code></dd>
            <dt>Versión</dt>
            <dd><code>{report.metadata.version}</code></dd>
            <dt>Huella del dataset</dt>
            <dd><code>{report.metadata.sourceDatasetFingerprint}</code></dd>
            <dt>Delimitador</dt>
            <dd><code>{report.metadata.delimiter}</code></dd>
            <dt>Fuente del diagnóstico</dt>
            <dd><code>{formatDiagnosticSourceLabel(report.diagnosisSummary.source)}</code></dd>
          </dl>
        </section>
        <section className="diagnostic-report-tech-section">
          <SyntaxDisplay filename="diagnostic-report.json" content={serialized} maxHeight={360} />
        </section>
      </div>
    </details>
  );
};

const DiagnosticReportStep: React.FC<DiagnosticReportStepProps> = ({
  diagnosticReport,
  evaluationSummary,
  onExportMain,
  onGenerateScript,
  onBackToDiagnosis,
  remediationAvailable = true,
}) => {
  const presentation = useMemo(
    () => buildDiagnosticPresentation(diagnosticReport),
    [diagnosticReport],
  );
  const observations = diagnosticReport.diagnosisSummary.observations.slice(0, 3);
  const primaryFindings = useMemo(
    () => buildPrimaryFindingsView(diagnosticReport),
    [diagnosticReport],
  );
  const hasPrimaryFindings = primaryFindings.findings.length > 0;

  return (
    <>
      <section className="section diagnostic-report-stage" data-testid="diagnostic-report-stage">
        <div className="diagnostic-report-hero" data-testid="diagnostic-report-header">
          <div>
            <p className="sec-eye">REPORTE DIAGNÓSTICO</p>
            <h2 className="sec-title">Qué encontró AURA y qué puedes hacer</h2>
            <p className="section-note">{subtitleByStatus[diagnosticReport.status.diagnosticStatus]}</p>
          </div>
          <div className="diagnostic-report-actions diagnostic-report-actions--top">
            <button className="btn-p" onClick={onExportMain} data-testid="diagnostic-report-export-main">
              <ArrowRight size={14} /> Exportar informe
            </button>
            <button className="btn-s" onClick={onGenerateScript} disabled={!remediationAvailable} aria-describedby={!remediationAvailable ? 'remediation-availability' : undefined} data-testid="diagnostic-report-generate-script-top">
              <FileCode2 size={14} /> Corregir una copia
            </button>
            <button className="btn-s" onClick={onBackToDiagnosis} data-testid="diagnostic-report-back-diagnosis">
              <RotateCcw size={14} /> Volver al diagnóstico
            </button>
          </div>
        </div>

        {!remediationAvailable && (
          <p id="remediation-availability" className="diagnostic-report-governance-card" role="status">
            Este informe permite revisar y exportar los hallazgos. La corrección con ejecución verificada requiere un diagnóstico compatible; todavía no está disponible en la ruta determinista.
            {' '}Puedes exportar el informe o volver al diagnóstico para configurar un proveedor.
          </p>
        )}
        <section className="diagnostic-report-executive" data-testid="diagnostic-report-executive-summary">
          <div className="diagnostic-report-section-head">
            <div>
              <p className="sec-eye">en pocas palabras</p>
              <h3>Conclusión del análisis</h3>
            </div>
            <span className="diagnostic-report-badge">{presentation.sourceLabel}</span>
          </div>
          {presentation.executiveSummary ? (
            <>
              <p>{presentation.executiveSummary}</p>
              {observations.length > 0 && (
                <div className="diagnostic-report-observations">
                  <span>Puntos importantes</span>
                  <ol>
                    {observations.map((observation) => (
                      <li key={observation.id}>{observation.text}</li>
                    ))}
                  </ol>
                </div>
              )}
            </>
          ) : (
            <p className="diagnostic-report-empty">
              El informe se basa en los hallazgos deterministas disponibles. Puedes revisarlos y preparar una corrección sobre una copia.
            </p>
          )}
        </section>

        <DiagnosticDecisionBrief presentation={presentation} />
        <DatasetSummaryStrip report={diagnosticReport} findingCount={primaryFindings.findings.length} />

        <ReportDisclosure
          title="Ver gráficos del informe"
          hint="visualizaciones reproducibles de la evidencia"
          testId="diagnostic-report-chart-disclosure"
        >
          <DiagnosticReportChartPreview chartSpecs={diagnosticReport.chartSpecs} />
        </ReportDisclosure>

        <section className="diagnostic-report-executive" data-testid="diagnostic-report-findings">
          <div className="diagnostic-report-section-head">
            <div>
              <p className="sec-eye">hallazgos</p>
              <h3>Problemas que requieren atención</h3>
            </div>
          </div>
          {hasPrimaryFindings ? (
            <div>
              <FindingsGroupWithOverflow
                title="Hallazgos únicos"
                description="Una entidad por identificador, con sus señales de riesgo, revisión humana y remediación como atributos."
                findings={primaryFindings.findings}
                testId="diagnostic-report-primary-findings"
                findingAttributes={primaryFindings.attributes}
                falsePositiveFindingIds={primaryFindings.falsePositiveFindingIds}
              />
            </div>
          ) : (
            <p className="diagnostic-report-empty">No hay hallazgos prioritarios para mostrar.</p>
          )}
        </section>

        <section className="diagnostic-report-executive" data-testid="diagnostic-report-recommendations-section">
          <div className="diagnostic-report-section-head">
            <div>
              <p className="sec-eye">acciones sugeridas</p>
              <h3>Qué conviene hacer</h3>
            </div>
          </div>
          <DiagnosticRecommendationsPanel recommendations={diagnosticReport.recommendations} />
        </section>

        <GovernanceSummary presentation={presentation} />

        <ReportDisclosure
          title="Remediación opcional"
          hint="solo si decides corregir una copia después de revisar"
          testId="diagnostic-report-remediation-disclosure"
        >
          <section className="diagnostic-report-remediation-lite" data-testid="diagnostic-report-remediation">
            <div>
              <p className="sec-eye">rama opcional</p>
              <h3>Corregir una copia del dataset</h3>
              <p>
                {remediationAvailable
                  ? 'La exportación del informe no depende de un script. Puedes revisar cada propuesta antes de aprobar una ejecución externa sobre una copia.'
                  : 'Este informe puede exportarse. La corrección verificada no está disponible en esta ruta; vuelve al diagnóstico si necesitas preparar una propuesta compatible.'}
              </p>
            </div>
            <button className="btn-s" onClick={onGenerateScript} disabled={!remediationAvailable} data-testid="diagnostic-report-generate-script">
              <FileCode2 size={14} /> Preparar script revisable
            </button>
          </section>
        </ReportDisclosure>

        <section className="diagnostic-report-governance-card" data-testid="diagnostic-report-export-choice">
          <div className="diagnostic-report-governance-head">
            <ShieldCheck size={16} />
            <strong>¿Solo necesitas el informe?</strong>
          </div>
          <p>Puedes exportar los resultados sin generar ni ejecutar un script.</p>
          <button className="btn-s" onClick={onExportMain}>
            <ArrowRight size={14} /> Ir a exportación
          </button>
        </section>
      </section>

      <details className="diagnostic-report-tech-disclosure" data-testid="diagnostic-invocation-disclosure">
        <summary className="diagnostic-report-tech-summary">Cómo se obtuvo este resultado</summary>
        <DiagnosticInvocationSummary report={diagnosticReport} evaluation={evaluationSummary} />
      </details>

      <TechnicalEvidenceDisclosure report={diagnosticReport} />
    </>
  );
};

export default DiagnosticReportStep;
