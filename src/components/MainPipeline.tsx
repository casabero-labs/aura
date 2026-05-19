import React, { useState } from 'react';
import { ArrowRight, Scissors } from 'lucide-react';
import FileUpload from './FileUpload';
import PipelineProgress from './PipelineProgress';
import ScoreBreakdown from './ScoreBreakdown';
import IssueList from './IssueList';
import ExecutionEvidencePanel from './ExecutionEvidencePanel';
import PipelineChecklist, {
  buildCsvParsingStep,
  buildDeterministicAuditStep,
  buildLLMAnalysisStep,
  ChecklistStep,
} from './PipelineChecklist';
import BoxPlot from './BoxPlot';
import ColumnStatsPanel from './ColumnStatsPanel';
import AnalysisStep from './AnalysisStep';
import ReviewStep from './ReviewStep';
import { runAudit } from '../services/auditEngine';
import { parseCsv } from '../services/csvService';
import { buildAuditEvidence, createTraceRecorder, fingerprintDataset } from '../services/executionEvidence';
import { buildSmartSample } from '../services/providers/prompts';
import { AIConfig, AIProvider, AuditReport, AuditExecutionEvidence, HealthDelta, ProviderMetrics, ScriptValidationResult } from '../types';
import DatasetProfile from './DatasetProfile';
import RuleActivationMatrix from './RuleActivationMatrix';
import SmartSampleViewer from './SmartSampleViewer';
import DiagnosticTerminal from './DiagnosticTerminal';

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

  // ── Pipeline checklist state (transparency panel) ──
  const [checklistSteps, setChecklistSteps] = useState<ChecklistStep[]>([]);
  const [llmMetrics, setLlmMetrics] = useState<ProviderMetrics | null>(null);
  const [scriptValidation, setScriptValidation] = useState<ScriptValidationResult | null>(null);

  const updateChecklistStep = (id: string, updates: Partial<ChecklistStep>) => {
    setChecklistSteps(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  // Simple heuristic: flag column names mentioned in analysis that don't exist in dataset
  const detectHallucinatedColumns = (analysisText: string, report: AuditReport): string[] => {
    const knownCols = new Set(Object.keys(report.columnStats));
    const wordPattern = /\b([A-Z_a-z][A-Z_a-z0-9_]{2,})\b/g;
    const mentioned = new Set<string>();
    let m;
    while ((m = wordPattern.exec(analysisText)) !== null) {
      const col = m[1];
      if (!knownCols.has(col) && !['column', 'row', 'dataset', 'null', 'value', 'string', 'number', 'count', 'mean', 'median'].includes(col.toLowerCase())) {
        mentioned.add(col);
      }
    }
    return [...mentioned].slice(0, 5); // cap at 5 to avoid noise
  };

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
    setChecklistSteps([]); // reset checklist on new file
    setLlmMetrics(null); setScriptValidation(null);
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

      // ── Pipeline Checklist: CSV parsing ──
      setChecklistSteps(prev => [...prev, buildCsvParsingStep(
        uploadedFile.name, uploadedFile.size, data.length,
        meta.fields?.length ?? 0, meta.delimiter, parseDurationMs, meta.truncated
      )]);

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

      // ── Pipeline Checklist: Deterministic audit ──
      setChecklistSteps(prev => [...prev, buildDeterministicAuditStep(auditResult, evidence, auditDurationMs)]);

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

      {/* ── Step 2: Diagnostic — TRANSPARENCIA TOTAL ── */}
      {state === 'diagnostic' && report && auditEvidence && (
        <>
          {/* 1. Perfil completo del dataset */}
          <DatasetProfile
            report={report}
            fileName={file?.name}
            fileSize={file?.size}
            parseDurationMs={auditEvidence.parseDurationMs}
            auditDurationMs={auditEvidence.auditDurationMs}
            datasetFingerprint={auditEvidence.datasetFingerprint}
          />

          {/* 2. Perfil estadístico completo por columna (expandible) */}
          <section className="section" id="column-profile">
            <ColumnStatsPanel columnStats={report.columnStats} />
          </section>

          {/* 3. BoxPlot IQR por columna numérica */}
          {Object.values(report.columnStats).some(c => c.inferredType === 'number' && c.iqr && c.iqr > 0) && (
            <section className="section" id="boxplot">
              <BoxPlot columnStats={report.columnStats} />
            </section>
          )}

          {/* 4. Score global con breakdown */}
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

          {/* 5. Matriz de activación de reglas (completa, expandible) */}
          <section className="section" id="rule-matrix">
            <RuleActivationMatrix issues={report.issues} rowCount={report.rowCount} />
          </section>

          {/* 6. Lista de issues por categoría */}
          {report.issues.length > 0 && (
            <section className="section" id="issues-list">
              <div className="section-header">
                <p className="sec-eye">hallazgos</p>
                <h2 className="sec-title">Anomalías detectadas.</h2>
              </div>
              <IssueList issues={report.issues} />
            </section>
          )}

          {/* 7. Terminal de diagnóstico rule-by-rule */}
          <DiagnosticTerminal
            report={report}
            auditDurationMs={auditEvidence.auditDurationMs}
          />

          {/* 8. Smart Sample — JSON exacto enviado a Capa 2 */}
          <section className="section" id="smart-sample">
            <SmartSampleViewer report={report} />
          </section>

          {/* 9. Bitácora de ejecución en vivo */}
          <ExecutionEvidencePanel evidence={auditEvidence} />

          {/* 10. Pipeline Checklist — carta abierta */}
          {checklistSteps.length > 0 && (
            <PipelineChecklist steps={checklistSteps} />
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
            onChecklistLLMStart={(config) => {
              const step = buildLLMAnalysisStep(config, null, 'smart_sample', [], 0, false, 'running');
              setChecklistSteps(prev => [...prev, step]);
              updateChecklistStep('llm-analysis', { status: 'running', input: [
                { label: 'modo', detail: 'Smart Sample — JSON anclado a datos reales' },
                { label: 'proveedor', detail: config.cloudProvider ?? config.providerType },
                { label: 'modelo', detail: config.model },
                { label: 'temperatura', detail: String(config.temperature) },
              ]});
            }}
            onChecklistLLMDone={(metrics, analysisText) => {
              const hallucinated = detectHallucinatedColumns(analysisText, report);
              setLlmMetrics(metrics);
              updateChecklistStep('llm-analysis', {
                status: hallucinated.length > 0 ? 'warning' : 'done',
                durationMs: metrics.latencyMs,
                metrics: [
                  { label: 'latencia', value: `${metrics.latencyMs}ms` },
                  { label: 'tokens', value: String(metrics.tokensGenerated) },
                  { label: 'tokens/s', value: `${(metrics.tokensGenerated / (metrics.latencyMs / 1000)).toFixed(1)}` },
                ],
                output: [
                  { label: 'tokens generados', detail: String(metrics.tokensGenerated) },
                  ...(hallucinated.length > 0 ? [{ label: '⚠ columnas alucinadas', detail: hallucinated.join(', ') }] : []),
                ],
                technicalDetail: [{
                  title: '📄 Smart Sample — JSON exacto enviado al LLM (muestra)',
                  content: JSON.stringify(buildSmartSample(report), null, 2).slice(0, 2000) + '\n…',
                }],
              });
            }}
            onChecklistScriptStart={() => {
              const step: ChecklistStep = {
                id: 'script-generation',
                layer: 'capa 2',
                label: 'Generación de script Python/Pandas',
                status: 'running',
                icon: <Scissors size={14} />,
              };
              setChecklistSteps(prev => [...prev, step]);
            }}
            onChecklistScriptDone={(script, metrics) => {
              setScriptValidation(null); // TODO: call scriptValidationService
              setLlmMetrics(metrics);
              updateChecklistStep('script-generation', {
                status: 'done',
                durationMs: metrics.latencyMs,
                metrics: [
                  { label: 'líneas', value: String(script.split('\n').length) },
                  { label: 'tokens', value: String(metrics.tokensGenerated) },
                ],
                output: [
                  { label: 'script Pandas', detail: `${script.split('\n').length} líneas` },
                ],
                technicalDetail: [{
                  title: '🐍 Script Python generado (muestra)',
                  content: script.length > 1500 ? script.slice(0, 1500) + '\n…' : script,
                }],
              });
            }}
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
