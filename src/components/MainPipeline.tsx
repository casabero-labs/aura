import React, { useState } from 'react';
import FileUpload from './FileUpload';
import PipelineProgress from './PipelineProgress';
import DiagnosisStep from './DiagnosisStep';
import ProfileStep from './ProfileStep';
import ReviewStep from './ReviewStep';
import ScriptGenerationStep from './ScriptGenerationStep';
import { runAudit } from '../services/auditEngine';
import { parseCsv } from '../services/csvService';
import { buildAuditEvidence, createTraceRecorder, fingerprintDataset } from '../services/executionEvidence';
import { validateCleaningScript } from '../services/scriptValidationService';
import { AIConfig, AIProvider, AuditReport, AuditExecutionEvidence, BenchmarkResult, HealthDelta, ImprovementRun, ProviderMetrics, ScriptValidationResult } from '../types';

export type PipelineState = 'upload' | 'profile' | 'diagnosis' | 'script' | 'review' | 'export';

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
  benchmarkResults: BenchmarkResult[];
  improvementRun: ImprovementRun | null;
  scriptValidation: ScriptValidationResult | null;
  logs: { time: string; msg: string }[];
}

interface MainPipelineProps {
  aiConfig: AIConfig;
  aiProvider: AIProvider;
  onLog?: (stage: string, msg: string) => void;
  onPipelineChange?: (data: PipelineData) => void;
  onAiConfigChange?: (config: AIConfig) => void;
  onOpenLab?: () => void;
}

const MainPipeline: React.FC<MainPipelineProps> = ({ aiConfig, aiProvider, onLog, onPipelineChange, onAiConfigChange, onOpenLab }) => {
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
  const [benchmarkResults, setBenchmarkResults] = useState<BenchmarkResult[]>([]);
  const [improvementRun, setImprovementRun] = useState<ImprovementRun | null>(null);
  const [logs, setLogs] = useState<{ time: string; msg: string }[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const [scriptValidation, setScriptValidation] = useState<ScriptValidationResult | null>(null);

  // Sync pipeline data upward to parent
  React.useEffect(() => {
    onPipelineChange?.({
      state, file, report, auditEvidence, rawData, csvFields, csvDelimiter,
      cleaningScript, approvedScript, healthDelta, aiAnalysis,
      benchmarkResults, improvementRun, scriptValidation, logs,
    });
  }, [state, file, report, auditEvidence, rawData, csvFields, csvDelimiter,
      cleaningScript, approvedScript, healthDelta, aiAnalysis,
      benchmarkResults, improvementRun, scriptValidation, logs]);

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
    setScriptValidation(null);
    setBenchmarkResults([]); setImprovementRun(null);
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

      setState('profile');
    } catch (err: any) {
      addLog(`Error: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

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
          if (step === 'upload' || (hasData && ['profile', 'diagnosis', 'script', 'review', 'export'].includes(step))) {
            setState(step);
          }
        }}
      />

      {/* ── Step 1: Upload ── */}
      {state === 'upload' && (
        <section className="section" id="upload-step">
          <div className="section-header">
            <div>
              <p className="sec-eye">entrada local</p>
              <h2 className="sec-title">Cargar dataset.</h2>
            </div>
          </div>
          <FileUpload onFileSelect={processFile} />
        </section>
      )}

      {/* ── Step 2: Dataset profile ── */}
      {state === 'profile' && report && auditEvidence && (
        <ProfileStep
          report={report}
          auditEvidence={auditEvidence}
          file={file}
          onContinue={() => setState('diagnosis')}
        />
      )}

      {/* ── Step 3: Diagnosis ── */}
      {state === 'diagnosis' && report && (
        <DiagnosisStep
          report={report}
          auditEvidence={auditEvidence}
          aiConfig={aiConfig}
          aiProvider={aiProvider}
          analysisText={aiAnalysis}
          onAiConfigChange={onAiConfigChange || (() => {})}
          onAnalysisComplete={(analysis) => setAiAnalysis(analysis)}
          onLog={(stage, msg) => addLog(`${stage} :: ${msg}`)}
          onContinue={() => setState('script')}
          onOpenLab={onOpenLab}
        />
      )}

      {/* ── Step 4: Script generation ── */}
      {state === 'script' && report && (
        <ScriptGenerationStep
          report={report}
          aiProvider={aiProvider}
          cleaningScript={cleaningScript}
          scriptValidation={scriptValidation}
          onScriptGenerated={(script, metrics: ProviderMetrics) => {
            setCleaningScript(script);
            const validation = validateCleaningScript(report, script);
            setScriptValidation(validation);
            addLog(`script.generado :: ${script.split('\n').length} líneas · ${metrics.latencyMs}ms`);
          }}
          onLog={(stage, msg) => addLog(`${stage} :: ${msg}`)}
          onContinue={() => setState('review')}
        />
      )}

      {/* ── Step 5: Review & HITL ── */}
      {state === 'review' && report && (
        <ReviewStep
          report={report}
          rawData={rawData}
          csvFields={csvFields}
          csvDelimiter={csvDelimiter}
          cleaningScript={cleaningScript}
          approvedScript={approvedScript}
          auditEvidence={auditEvidence || undefined}
          benchmarkResults={benchmarkResults}
          scriptValidation={scriptValidation}
          onScriptApproved={(script) => {
            setApprovedScript(script);
            addLog('Script aprobado por revisión humana');
          }}
          onHealthDelta={(delta) => setHealthDelta(delta)}
          onImprovementRun={(run) => setImprovementRun(run)}
          onLog={(stage, msg) => addLog(`${stage} :: ${msg}`)}
          onContinue={() => setState('export')}
        />
      )}
    </div>
  );
};

export default MainPipeline;
