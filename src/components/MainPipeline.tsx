import React, { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import FileUpload from './FileUpload';
import PipelineProgress from './PipelineProgress';
import ScoreBreakdown from './ScoreBreakdown';
import IssueList from './IssueList';
import ExecutionEvidencePanel from './ExecutionEvidencePanel';
import AnalysisStep from './AnalysisStep';
import ReviewStep from './ReviewStep';
import { runAudit } from '../services/auditEngine';
import { parseCsv } from '../services/csvService';
import { buildAuditEvidence, createTraceRecorder, fingerprintDataset } from '../services/executionEvidence';
import { AIConfig, AIProvider, AuditReport, AuditExecutionEvidence, HealthDelta } from '../types';

export type PipelineState = 'upload' | 'diagnostic' | 'analysis' | 'review' | 'export';

export interface PipelineData {
  state: PipelineState;
  file: File | null;
  report: AuditReport | null;
  auditEvidence: AuditExecutionEvidence | null;
  rawData: Record<string, any>[];
  csvFields: string[];
  csvDelimiter: string;
  cleaningScript: string;
  approvedScript: string;
  healthDelta: HealthDelta | null;
  aiAnalysis: string;
  logs: { time: string; msg: string }[];
}

interface MainPipelineProps {
  aiConfig: AIConfig;
  aiProvider: AIProvider;
  onLog?: (stage: string, msg: string) => void;
  onPipelineChange?: (data: PipelineData) => void;
}

const countBySeverity = (report: AuditReport | null, severity: 'critical' | 'warning' | 'info') =>
  report?.issues.filter((issue) => issue.severity === severity).length ?? 0;

const MainPipeline: React.FC<MainPipelineProps> = ({ aiConfig, aiProvider, onLog, onPipelineChange }) => {
  const [state, setState] = useState<PipelineState>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<AuditReport | null>(null);
  const [auditEvidence, setAuditEvidence] = useState<AuditExecutionEvidence | null>(null);
  const [rawData, setRawData] = useState<Record<string, any>[]>([]);
  const [csvFields, setCsvFields] = useState<string[]>([]);
  const [csvDelimiter, setCsvDelimiter] = useState(',');
  const [cleaningScript, setCleaningScript] = useState('');
  const [approvedScript, setApprovedScript] = useState('');
  const [healthDelta, setHealthDelta] = useState<HealthDelta | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState('');
  const [logs, setLogs] = useState<{ time: string; msg: string }[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Sync pipeline data upward to parent
  React.useEffect(() => {
    onPipelineChange?.({
      state, file, report, auditEvidence, rawData, csvFields, csvDelimiter,
      cleaningScript, approvedScript, healthDelta, aiAnalysis, logs,
    });
  }, [state, file, report, auditEvidence, rawData, csvFields, csvDelimiter,
      cleaningScript, approvedScript, healthDelta, aiAnalysis, logs]);

  const addLog = (msg: string) => {
    const time = new Date().toLocaleTimeString('es-CO', {
      hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    const entry = { time, msg };
    setLogs((prev) => [...prev, entry].slice(-18));
    onLog?.('pipeline', msg);
  };

  const processFile = async (uploadedFile: File) => {
    setFile(uploadedFile);
    setIsProcessing(true);
    setReport(null); setRawData([]); setCsvFields([]); setCsvDelimiter(',');
    setAuditEvidence(null); setCleaningScript(''); setApprovedScript('');
    setHealthDelta(null); setAiAnalysis(''); setLogs([]);
    addLog(`Cargando ${uploadedFile.name}...`);

    try {
      const trace = createTraceRecorder();
      const startedAt = new Date().toISOString();
      trace.mark('csv.parse.start', { fileName: uploadedFile.name, fileSize: uploadedFile.size });
      addLog('csv.parse.start :: leyendo archivo en navegador');

      const parseStart = performance.now();
      const { data, meta } = await parseCsv(uploadedFile);
      const parseDurationMs = Math.round(performance.now() - parseStart);
      trace.mark('csv.parse.end', { rows: data.length, columns: meta.fields?.length ?? 0, delimiter: meta.delimiter, truncated: meta.truncated, durationMs: parseDurationMs });
      setRawData(data); setCsvFields(meta.fields); setCsvDelimiter(meta.delimiter);
      addLog(`csv.parse.end :: ${data.length} registros · ${meta.fields?.length ?? 0} columnas · ${parseDurationMs}ms`);

      const datasetFingerprint = fingerprintDataset(data, meta.fields);
      trace.mark('audit.run.start', { datasetFingerprint });
      addLog(`audit.run.start :: fingerprint=${datasetFingerprint}`);

      const auditStart = performance.now();
      const auditResult = runAudit(data, meta.fields, meta.delimiter);
      const auditDurationMs = Math.round(performance.now() - auditStart);
      trace.mark('audit.run.end', { durationMs: auditDurationMs, score: auditResult.score, issues: auditResult.issues.length, duplicateRows: auditResult.duplicateRows });

      const completedAt = new Date().toISOString();
      const evidence = buildAuditEvidence({
        fileName: uploadedFile.name, datasetFingerprint, startedAt, completedAt,
        parseDurationMs, auditDurationMs, rowsProcessed: data.length,
        columnsProcessed: meta.fields.length, delimiter: meta.delimiter,
        truncated: meta.truncated, report: auditResult, trace: trace.events,
      });

      setAuditEvidence(evidence); setReport(auditResult);
      addLog(`audit.run.end :: score=${auditResult.score}/100 · issues=${auditResult.issues.length} · ${auditDurationMs}ms`);
      setState('diagnostic');
    } catch (err: any) {
      addLog(`Error: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const criticalCount = countBySeverity(report, 'critical');
  const warningCount = countBySeverity(report, 'warning');
  const infoCount = countBySeverity(report, 'info');
  const hasData = !!report;

  const terminalRows = logs.length > 0
    ? logs
    : [{ time: '--:--:--', msg: 'Esperando un archivo CSV para analizar' }];

  return (
    <div className="main-pipeline">
      <PipelineProgress
        currentStep={state}
        onStepClick={(step) => {
          // Allow navigation to completed or current steps
          if (step === 'upload' || (hasData && ['diagnostic', 'analysis', 'review', 'export'].includes(step))) {
            setState(step);
          }
        }}
      />

      {/* ── Step 1: Upload ── */}
      {state === 'upload' && (
        <section className="section" id="upload-step">
          <div className="section-header">
            <div>
              <p className="sec-eye">capa 0 · local-first</p>
              <h2 className="sec-title">Cargar dataset.</h2>
            </div>
          </div>
          <FileUpload onFileSelect={processFile} />
        </section>
      )}

      {/* ── Step 2: Diagnostic ── */}
      {state === 'diagnostic' && report && (
        <>
          <section className="stats">
            <div className="stat"><p className="stat-lbl">registros</p><p className="stat-num">{report.rowCount}</p><p className="stat-sub">dataset activo</p></div>
            <div className="stat"><p className="stat-lbl">anomalías</p><p className="stat-num">{report.issues.length}</p><p className="stat-sub">detectadas</p></div>
            <div className="stat"><p className="stat-lbl">score</p><p className="stat-num">{report.score}%</p><p className="stat-sub">motor determinista</p></div>
          </section>

          <section className="term" aria-label="Bitácora de ejecución">
            <div className="term-bar">
              <div className="term-dot" /><div className="term-dot" /><div className="term-dot" />
              <span className="term-label">tail -f aura.pipeline.log</span>
              <code>{auditEvidence?.datasetFingerprint || 'trace.ready()'}</code>
            </div>
            <div className="term-body">
              {terminalRows.map((row, index) => (
                <span className="tl" key={`${row.time}-${index}`}>
                  <span className="ts">{row.time}</span>
                  <span className="pr">→</span>
                  <span className="ok">{row.msg}</span>
                  {index === terminalRows.length - 1 && isProcessing && <span className="cursor" />}
                </span>
              ))}
            </div>
          </section>

          <section className="section" id="diagnostic-results">
            <div className="section-header">
              <div>
                <p className="sec-eye">capa 1 · motor determinista</p>
                <h2 className="sec-title">Diagnóstico completado.</h2>
              </div>
              <button className="btn-p btn-sm" onClick={() => setState('analysis')}>
                Analizar con IA <ArrowRight size={12} />
              </button>
            </div>
            <div className="score-grid">
              <div>
                <h2 className="hero-h1 score-title">{report.score}<em>%</em></h2>
                <p className="section-note">
                  {report.score >= 80 ? 'Dataset consistente para análisis.' : 'Requiere limpieza antes de usar los datos.'}
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

          {auditEvidence && <ExecutionEvidencePanel evidence={auditEvidence} />}

          {report.issues.length > 0 && (
            <section className="section" id="issues-list">
              <div className="section-header">
                <p className="sec-eye">hallazgos</p>
                <h2 className="sec-title">Anomalías detectadas.</h2>
              </div>
              <IssueList issues={report.issues} />
            </section>
          )}
        </>
      )}

      {/* ── Step 3: AI Analysis ── */}
      {state === 'analysis' && report && (
        <>
          <AnalysisStep
            report={report}
            aiConfig={aiConfig}
            aiProvider={aiProvider}
            onAnalysisComplete={(analysis) => setAiAnalysis(analysis)}
            onScriptGenerated={(script) => {
              setCleaningScript(script);
              addLog(`Script generado: ${script.split('\n').length} líneas`);
            }}
            onLog={(stage, msg) => addLog(`${stage} :: ${msg}`)}
          />
          {cleaningScript && (
            <div className="context-guide">
              <span className="guide-icon"><ArrowRight size={14} /></span>
              <div>
                <p className="guide-title">Siguiente paso: revisar y aprobar script</p>
                <p className="guide-desc">El script de limpieza debe ser revisado por un humano antes de simular su ejecución.</p>
              </div>
              <button className="btn-p btn-sm" onClick={() => setState('review')}>
                Ir a revisión <ArrowRight size={12} />
              </button>
            </div>
          )}
        </>
      )}

      {/* ── Step 4: Review & HITL ── */}
      {state === 'review' && report && (
        <ReviewStep
          report={report}
          rawData={rawData}
          csvFields={csvFields}
          csvDelimiter={csvDelimiter}
          cleaningScript={cleaningScript}
          approvedScript={approvedScript}
          auditEvidence={auditEvidence || undefined}
          onScriptApproved={(script) => {
            setApprovedScript(script);
            addLog('Script aprobado por revisión humana');
          }}
          onHealthDelta={(delta) => setHealthDelta(delta)}
          onImprovementRun={() => {}}
          onLog={(stage, msg) => addLog(`${stage} :: ${msg}`)}
        />
      )}
    </div>
  );
};

export default MainPipeline;
