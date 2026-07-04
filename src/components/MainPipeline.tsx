import React, { useRef, useState, useEffect } from 'react';
import FileUpload from './FileUpload';
import PipelineProgress from './PipelineProgress';
import ProgressDisclosure from './ProgressDisclosure';
import DiagnosisStep from './DiagnosisStep';
import ProfileStep from './ProfileStep';
import ReviewStep from './ReviewStep';
import ScriptGenerationStep from './ScriptGenerationStep';
import ScriptGenerationStepV2 from './ScriptGenerationStepV2';
import CalibrationOptInExplainer from './calibration/CalibrationOptInExplainer';
import { runAudit } from '../services/auditEngine';
import { parseCsv } from '../services/csvService';
import { buildAuditEvidence, buildIngestionEvidence, createTraceRecorder, fingerprintDataset } from '../services/executionEvidence';
import { matchGroundTruth, buildDeterministicValidationReport } from '../services/deterministicValidation';
import { validateCleaningScript } from '../services/scriptValidationService';
import { buildScriptContractInputKey, buildUiScriptContext } from '../services/scriptContractUiContext';
import { AIConfig, AIProvider, AuditReport, AuditExecutionEvidence, BenchmarkResult, DeterministicValidationReport, HealthDelta, ImprovementRun, ProviderMetrics, ScriptValidationResult, ProgressDisclosureStatus } from '../types';
import type { DiagnosisExecutionResult, RemediationPlanV2, ScriptContractV2, ScriptValidationResultV2 } from '../contracts/llm';
import { validateRemediationPlanV2, isContractsV2Enabled, verifyScriptContractV2 } from '../contracts/llm';

export type PipelineState = 'upload' | 'profile' | 'calibration' | 'diagnosis' | 'script' | 'review' | 'export';

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
  structuredDiagnosis: DiagnosisExecutionResult | null;
  remediationPlan: RemediationPlanV2 | null;
  scriptContractV2: ScriptContractV2 | null;
  scriptContractVerificationV2: ScriptValidationResultV2 | null;
  benchmarkResults: BenchmarkResult[];
  improvementRun: ImprovementRun | null;
  scriptValidation: ScriptValidationResult | null;
  deterministicValidation: DeterministicValidationReport | null;
  logs: { time: string; msg: string }[];
}

interface MainPipelineProps {
  aiConfig: AIConfig;
  aiProvider: AIProvider;
  initialData?: PipelineData | null;
  onLog?: (stage: string, msg: string) => void;
  onPipelineChange?: (data: PipelineData) => void;
  onAiConfigChange?: (config: AIConfig) => void;
  onOpenLab?: () => void;
  onOpenSettings?: () => void;
}

const MainPipeline: React.FC<MainPipelineProps> = ({ aiConfig, aiProvider, initialData, onLog, onPipelineChange, onAiConfigChange, onOpenLab, onOpenSettings }) => {

  const deriveDiagnosisIdentity = (diagnosis: DiagnosisExecutionResult | null) => {
    if (!diagnosis) return { diagRef: null, envelopeRef: null };
    return {
      diagRef: diagnosis.diagnosis?.issues
        ? `diag:${diagnosis.diagnosis.evidenceEnvelopeRef}`
        : null,
      envelopeRef: diagnosis.evidenceEnvelopeRef ?? null,
    };
  };

  // Initialize prevContractKeyRef from restored session
  const getInitialContractKey = () => {
    if (!initialData?.scriptContractV2) return null;
    const fp = initialData.auditEvidence?.datasetFingerprint ?? null;
    return buildScriptContractInputKey({
      fingerprint: fp,
      envelopeRef: initialData.structuredDiagnosis?.evidenceEnvelopeRef ?? null,
      planId: initialData.remediationPlan?.planId ?? null,
      plan: initialData.remediationPlan?.plan ?? null,
      csvFields: initialData.csvFields ?? [],
    });
  };
  const [state, setState] = useState<PipelineState>(() => initialData?.state ?? 'upload');
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<AuditReport | null>(() => initialData?.report ?? null);
  const [auditEvidence, setAuditEvidence] = useState<AuditExecutionEvidence | null>(() => initialData?.auditEvidence ?? null);
  const [rawData, setRawData] = useState<Record<string, any>[]>(() => initialData?.rawData ?? []);
  const [csvFields, setCsvFields] = useState<string[]>(() => initialData?.csvFields ?? []);
  const [csvDelimiter, setCsvDelimiter] = useState(() => initialData?.csvDelimiter ?? ',');
  const [cleaningScript, setCleaningScript] = useState(() => initialData?.cleaningScript ?? '');
  const [approvedScript, setApprovedScript] = useState(() => initialData?.approvedScript ?? '');
  const [healthDelta, setHealthDelta] = useState<HealthDelta | null>(() => initialData?.healthDelta ?? null);
  const [aiAnalysis, setAiAnalysis] = useState(() => initialData?.aiAnalysis ?? '');
  const [structuredDiagnosis, setStructuredDiagnosis] = useState<DiagnosisExecutionResult | null>(() => initialData?.structuredDiagnosis ?? null);
  const [remediationPlan, setRemediationPlan] = useState<RemediationPlanV2 | null>(() => initialData?.remediationPlan ?? null);
  const [benchmarkResults, setBenchmarkResults] = useState<BenchmarkResult[]>(() => initialData?.benchmarkResults ?? []);
  const [improvementRun, setImprovementRun] = useState<ImprovementRun | null>(() => initialData?.improvementRun ?? null);
  const [logs, setLogs] = useState<{ time: string; msg: string }[]>(() => initialData?.logs ?? []);
  const [isProcessing, setIsProcessing] = useState(false);

  const [scriptValidation, setScriptValidation] = useState<ScriptValidationResult | null>(() => initialData?.scriptValidation ?? null);
  const [deterministicValidation, setDeterministicValidation] = useState<DeterministicValidationReport | null>(() => initialData?.deterministicValidation ?? null);
  const [processProgressStatus, setProcessProgressStatus] = useState<ProgressDisclosureStatus>('idle');
  const [processProgressStep, setProcessProgressStep] = useState('');
  const [scriptContractV2, setScriptContractV2] = useState<ScriptContractV2 | null>(() => initialData?.scriptContractV2 ?? null);
  const [scriptContractVerificationV2, setScriptContractVerificationV2] = useState<ScriptValidationResultV2 | null>(() => initialData?.scriptContractVerificationV2 ?? null);

  // Sync pipeline data upward to parent (deferred to avoid overwriting App's session restore)
  const mountCountRef = useRef(0);
  React.useEffect(() => {
    if (mountCountRef.current < 2) {
      mountCountRef.current += 1;
      return;
    }
    const pipelineData: PipelineData = {
      state, file, report, auditEvidence, rawData, csvFields, csvDelimiter,
      cleaningScript, approvedScript, healthDelta, aiAnalysis,
      structuredDiagnosis,
      remediationPlan,
      scriptContractV2,
      scriptContractVerificationV2,
      benchmarkResults, improvementRun, scriptValidation, deterministicValidation, logs,
    };
    onPipelineChange?.(pipelineData);
  }, [state, file, report, auditEvidence, rawData, csvFields, csvDelimiter,
      cleaningScript, approvedScript, healthDelta, aiAnalysis,
      structuredDiagnosis,
      remediationPlan,
      scriptContractV2,
      scriptContractVerificationV2,
      benchmarkResults, improvementRun, scriptValidation, deterministicValidation, logs]);

  // ── Phase 3 E2E Harness: expose injection callbacks on window ──
  useEffect(() => {
    const isDev = import.meta.env.DEV;
    const harnessEnabled =
      import.meta.env.VITE_PHASE3_E2E_HARNESS === 'true';

    if (!isDev || !harnessEnabled) return;

    (window as any).__PHASE3_INJECT__ = (diagnosis: DiagnosisExecutionResult, plan: RemediationPlanV2, opts?: { analysisText?: string }) => {
      setStructuredDiagnosis(diagnosis);
      if (plan) setRemediationPlan(plan);
      if (opts?.analysisText) setAiAnalysis(opts.analysisText);
    };
    (window as any).__PHASE3_SET_STATE__ = (state: PipelineState) => {
      setState(state);
    };

    return () => {
      delete (window as any).__PHASE3_INJECT__;
      delete (window as any).__PHASE3_SET_STATE__;
    };
  }, []);

  // ── Phase 4 live-state ref (kept in sync on every render) ──
  const phase4StateRef = useRef({
    pipelineState: 'upload' as PipelineState,
    hasReport: false,
    hasContract: false,
    hasPlan: false,
    hasDiagnosis: false,
    fingerprint: null as string | null,
    contractHash: null as string | null,
    planId: null as string | null,
  });
  phase4StateRef.current = {
    pipelineState: state,
    hasReport: !!report,
    hasContract: !!scriptContractV2,
    hasPlan: !!remediationPlan,
    hasDiagnosis: !!structuredDiagnosis,
    fingerprint: auditEvidence?.datasetFingerprint ?? null,
    contractHash: scriptContractV2?.scriptHash ?? null,
    planId: remediationPlan?.planId ?? null,
  };

  // ── Phase 4 E2E Harness: expose injection + tamper callbacks on window ──
  useEffect(() => {
    const isDev = import.meta.env.DEV;
    const harnessEnabled =
      import.meta.env.VITE_PHASE4_E2E_HARNESS === 'true';

    if (!isDev || !harnessEnabled) return;

    (window as any).__PHASE4_INJECT__ = (diagnosis: DiagnosisExecutionResult, plan: RemediationPlanV2 | null, opts?: { analysisText?: string }) => {
      setStructuredDiagnosis(diagnosis);
      if (plan) setRemediationPlan(plan);
      if (opts?.analysisText) setAiAnalysis(opts.analysisText);
    };
    (window as any).__PHASE4_SET_STATE__ = (state: PipelineState) => {
      setState(state);
    };
    (window as any).__PHASE4_TAMPER_CONTRACT__ = (patch: Partial<ScriptContractV2>) => {
      setScriptContractV2((prev) => {
        if (!prev) return prev;
        return { ...prev, ...patch };
      });
    };
    (window as any).__PHASE4_GET_STATE__ = () => ({ ...phase4StateRef.current });

    return () => {
      delete (window as any).__PHASE4_INJECT__;
      delete (window as any).__PHASE4_SET_STATE__;
      delete (window as any).__PHASE4_TAMPER_CONTRACT__;
      delete (window as any).__PHASE4_GET_STATE__;
    };
  }, []);

  // ── Script Contract v2 invalidation ──
  const prevContractKeyRef = useRef<string | null>(getInitialContractKey());
  useEffect(() => {
    if (!isContractsV2Enabled()) return;
    const fingerprint = auditEvidence?.datasetFingerprint ?? null;
    const key = buildScriptContractInputKey({
      fingerprint,
      envelopeRef: structuredDiagnosis?.evidenceEnvelopeRef ?? null,
      planId: remediationPlan?.planId ?? null,
      plan: remediationPlan?.plan ?? null,
      csvFields,
    });
    if (prevContractKeyRef.current !== null && key !== prevContractKeyRef.current) {
      setScriptContractV2(null);
      setScriptContractVerificationV2(null);
      setCleaningScript('');
      setApprovedScript('');
      addLog('script.contract.v2.invalidated :: inputs changed');
    }
    prevContractKeyRef.current = key;
  }, [auditEvidence, structuredDiagnosis, remediationPlan, csvFields]);

  // ── Plan lifecycle: clear on new diagnosis, validate restored plan ──
  const initialDiagnosisIdentity = deriveDiagnosisIdentity(initialData?.structuredDiagnosis ?? null);
  const prevDiagnosisRef = useRef<string | null>(initialDiagnosisIdentity.diagRef);
  const prevEnvelopeRef = useRef<string | null>(initialDiagnosisIdentity.envelopeRef);
  useEffect(() => {
    const { diagRef: currentDiagRef, envelopeRef: currentEnvelopeRef } = deriveDiagnosisIdentity(structuredDiagnosis);

    if (!structuredDiagnosis) {
      // No diagnosis — clear plan
      if (remediationPlan !== null) {
        setRemediationPlan(null);
      }
      prevDiagnosisRef.current = null;
      prevEnvelopeRef.current = null;
      return;
    }

    const isV2 = isContractsV2Enabled();
    if (!isV2) return;

    // Check if this is a new diagnosis (different envelopeRef or diagnosisRef)
    const isNewDiagnosis =
      prevEnvelopeRef.current !== currentEnvelopeRef ||
      prevDiagnosisRef.current !== currentDiagRef;

    if (isNewDiagnosis) {
      // New diagnosis — clear old remediationPlan
      if (remediationPlan !== null) {
        setRemediationPlan(null);
        addLog('remediation.plan.cleared :: new structuredDiagnosis arrived');
      }
      prevDiagnosisRef.current = currentDiagRef;
      prevEnvelopeRef.current = currentEnvelopeRef;
      return;
    }

    // Same diagnosis: validate restored plan
    if (remediationPlan && structuredDiagnosis) {
      if (!structuredDiagnosis.remediationContext) {
        // Old session without context — cannot restore v2 plan
        setRemediationPlan(null);
        addLog('remediation.plan.migration :: session without remediationContext — plan discarded, please regenerate');
        return;
      }
      const validation = validateRemediationPlanV2(remediationPlan, structuredDiagnosis);
      if (!validation.valid) {
        setRemediationPlan(null);
        addLog(`remediation.plan.invalid :: ${validation.errors.map(e => e.message).join('; ')}`);
      }
    }
  }, [structuredDiagnosis]);

  // ── Fresh verification of restored script contract on mount ──
  useEffect(() => {
    if (!initialData?.scriptContractV2 || !isContractsV2Enabled()) return;
    const { diagRef: currentDiagRef, envelopeRef: currentEnvelopeRef } = deriveDiagnosisIdentity(initialData.structuredDiagnosis);
    const restoredKey = buildScriptContractInputKey({
      fingerprint: initialData.auditEvidence?.datasetFingerprint ?? null,
      envelopeRef: currentEnvelopeRef,
      planId: initialData.remediationPlan?.planId ?? null,
      plan: initialData.remediationPlan?.plan ?? null,
      csvFields: initialData.csvFields ?? [],
    });

    // Only verify if the restored contract key matches what we'd compute now
    const currentFp = auditEvidence?.datasetFingerprint ?? null;
    const currentKey = buildScriptContractInputKey({
      fingerprint: currentFp,
      envelopeRef: structuredDiagnosis?.evidenceEnvelopeRef ?? null,
      planId: remediationPlan?.planId ?? null,
      plan: remediationPlan?.plan ?? null,
      csvFields,
    });

    if (restoredKey !== currentKey) {
      setScriptContractV2(null);
      setScriptContractVerificationV2(null);
      setCleaningScript('');
      setApprovedScript('');
      addLog('script.contract.v2.restored.mismatch :: restored key does not match current state — contract cleared');
      return;
    }

    const context = buildUiScriptContext({
      structuredDiagnosis: initialData.structuredDiagnosis ?? null,
      csvFields: initialData.csvFields ?? [],
      sourceDatasetFingerprint: initialData.auditEvidence?.datasetFingerprint ?? null,
    });
    if (!context.ok) {
      setScriptContractV2(null);
      setScriptContractVerificationV2(null);
      setCleaningScript('');
      setApprovedScript('');
      addLog('script.contract.v2.restored.invalid :: context build failed — contract cleared');
      return;
    }
    if (!initialData.remediationPlan) {
      setScriptContractV2(null);
      setScriptContractVerificationV2(null);
      setCleaningScript('');
      setApprovedScript('');
      addLog('script.contract.v2.restored.invalid :: no remediationPlan — contract cleared');
      return;
    }
    const verification = verifyScriptContractV2(
      initialData.scriptContractV2,
      initialData.remediationPlan,
      context.buildContext,
    );
    if (!verification.valid) {
      setScriptContractV2(null);
      setScriptContractVerificationV2(null);
      setCleaningScript('');
      setApprovedScript('');
      addLog(`script.contract.v2.restored.invalid :: verification failed — contract cleared`);
      return;
    }
    // Contract is valid — restore all states explicitly (do not trust persisted verification)
    setScriptContractV2(initialData.scriptContractV2);
    setScriptContractVerificationV2(verification);
    setCleaningScript(initialData.scriptContractV2.scriptText);
    // Preserve approvedScript only if empty or matches contract.scriptText exactly
    const restoredApproved = initialData.approvedScript ?? '';
    if (restoredApproved && restoredApproved !== initialData.scriptContractV2.scriptText) {
      setApprovedScript('');
    }
    addLog('script.contract.v2.restored.valid :: fresh verification passed on mount');
  }, []); // Run once on mount

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
    setHealthDelta(null); setAiAnalysis(''); setStructuredDiagnosis(null); setRemediationPlan(null); setLogs([]);
    setScriptValidation(null);
    setScriptContractV2(null);
    setScriptContractVerificationV2(null);
    setBenchmarkResults([]); setImprovementRun(null);
    setProcessProgressStatus('running');
    setProcessProgressStep('Leyendo archivo CSV');
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
      setProcessProgressStep('Ejecutando auditoría determinista');

      const auditStart = performance.now();
      const auditResult = runAudit(data, meta.fields, meta.delimiter);
      const auditDurationMs = Math.round(performance.now() - auditStart);
      trace.mark('audit.run.end', { durationMs: auditDurationMs, score: auditResult.score, issues: auditResult.issues.length, duplicateRows: auditResult.duplicateRows });

      const completedAt = new Date().toISOString();
      const evidence = buildAuditEvidence({
        fileName: uploadedFile.name, fileSize: uploadedFile.size,
        datasetFingerprint, startedAt, completedAt,
        parseDurationMs, auditDurationMs, rowsProcessed: data.length,
        columnsProcessed: meta.fields.length, delimiter: meta.delimiter,
        truncated: meta.truncated, ingestionStatus: 'success',
        report: auditResult, trace: trace.events,
      });

      setAuditEvidence(evidence); setReport(auditResult);
      addLog(`audit.run.end :: score=${auditResult.score}/100 · issues=${auditResult.issues.length} · ${auditDurationMs}ms`);

      const groundTruth = matchGroundTruth(meta.fields);
      const validationReport = buildDeterministicValidationReport(auditResult, groundTruth);
      setDeterministicValidation(validationReport);
      if (groundTruth) {
        addLog(`deterministic.validation :: ground truth "${groundTruth.datasetName}" · macro F1=${(validationReport.summary.macroF1 * 100).toFixed(1)}%`);
      }

      setState('profile');
      setProcessProgressStatus('success');
      setProcessProgressStep('Perfil listo');
    } catch (err: any) {
      const completedAt = new Date().toISOString();
      const errorEvidence = buildIngestionEvidence({
        fileName: uploadedFile.name, fileSize: uploadedFile.size,
        datasetFingerprint: 'error',
        startedAt: new Date().toISOString(), completedAt,
        parseDurationMs: 0, rowsProcessed: 0, columnsProcessed: 0,
        delimiter: ',', truncated: false,
        ingestionStatus: 'error', ingestionError: err.message,
      });
      setAuditEvidence(errorEvidence as any);
      setState('profile');
      setProcessProgressStatus('warning');
      setProcessProgressStep(`Error: ${err.message}`);
      addLog(`Error: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const hasData = !!report;
  const hasStructuredDiagnosis = !!structuredDiagnosis;
  const hasDiagnosis = hasData && (aiAnalysis.trim().length > 0 || hasStructuredDiagnosis);

  const terminalRows = logs.length > 0
    ? logs
    : [{ time: '--:--:--', msg: 'Esperando un archivo CSV para analizar' }];

  return (
    <div className="main-pipeline">
      <PipelineProgress
        currentStep={state}
        onStepClick={(step) => {
          // Allow navigation to completed or current steps
          if (step === 'upload' || (hasData && ['profile', 'calibration', 'diagnosis', 'script', 'review', 'export'].includes(step))) {
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
          {isProcessing && (
            <div style={{ marginTop: 'var(--space-md)' }}>
              <ProgressDisclosure
                title="Procesando archivo"
                description="AURA está leyendo el CSV y ejecutando la auditoría determinista en tu navegador."
                indeterminate
                status="running"
                currentStep={processProgressStep}
                compact
              />
            </div>
          )}
          {processProgressStatus === 'success' && !isProcessing && file && (
            <div style={{ marginTop: 'var(--space-md)' }}>
              <ProgressDisclosure
                title="Archivo procesado"
                status="success"
                currentStep={processProgressStep}
                compact
              />
            </div>
          )}
        </section>
      )}

      {/* ── Step 2: Dataset profile ── */}
      {state === 'profile' && auditEvidence && (
        <ProfileStep
          report={report}
          auditEvidence={auditEvidence}
          deterministicValidation={deterministicValidation}
          file={file}
          onContinue={() => setState('calibration')}
        />
      )}

      {/* ── Step 3: Calibration opt-in ── */}
      {state === 'calibration' && report && (
        <CalibrationOptInExplainer
          benchmarkCount={benchmarkResults.length}
          onContinueStandardFlow={() => {
            addLog('calibration.skip :: user continued standard diagnosis flow');
            setState('diagnosis');
          }}
          onStartCalibration={() => {
            addLog('calibration.opt_in :: user opened experimental comparison');
            onOpenLab?.();
          }}
        />
      )}

      {/* ── Step 4: Diagnosis ── */}
      {state === 'diagnosis' && report && (
        <DiagnosisStep
          report={report}
          auditEvidence={auditEvidence}
          aiConfig={aiConfig}
          aiProvider={aiProvider}
          analysisText={aiAnalysis}
          onAiConfigChange={onAiConfigChange || (() => {})}
          onAnalysisComplete={(analysis) => setAiAnalysis(analysis)}
          onStructuredDiagnosisComplete={setStructuredDiagnosis}
          onLog={(stage, msg) => addLog(`${stage} :: ${msg}`)}
          onContinue={() => setState('script')}
          onOpenLab={onOpenLab}
          onOpenSettings={onOpenSettings}
          initialDiagnosis={structuredDiagnosis}
        />
      )}

      {/* ── Step 5: Script generation ── */}
      {state === 'script' && report && isContractsV2Enabled() && !!structuredDiagnosis?.remediationContext && (
        <ScriptGenerationStepV2
          report={report}
          csvFields={csvFields}
          sourceDatasetFingerprint={auditEvidence?.datasetFingerprint ?? null}
          structuredDiagnosis={structuredDiagnosis}
          remediationPlan={remediationPlan}
          scriptContractV2={scriptContractV2}
          scriptContractVerificationV2={scriptContractVerificationV2}
          onRemediationPlanChange={setRemediationPlan}
          onScriptContractChange={(contract, verification) => {
            setScriptContractV2(contract);
            setScriptContractVerificationV2(verification);
            if (contract) {
              setCleaningScript(contract.scriptText);
            }
            addLog(contract ? `script.contract.v2 :: hash=${contract.scriptHash.slice(0, 12)}` : 'script.contract.v2.cleared');
          }}
          onLog={(stage, msg) => addLog(`${stage} :: ${msg}`)}
          onContinue={() => setState('review')}
        />
      )}

      {/* ── Step 5: Script generation (legacy) ── */}
      {state === 'script' && report && (!isContractsV2Enabled() || !structuredDiagnosis?.remediationContext) && (
        <ScriptGenerationStep
          report={report}
          aiProvider={aiProvider}
          diagnosisText={aiAnalysis}
          cleaningScript={cleaningScript}
          scriptValidation={scriptValidation}
          structuredDiagnosis={structuredDiagnosis}
          remediationPlan={remediationPlan}
          onRemediationPlanChange={setRemediationPlan}
            onScriptGenerated={(script, metrics: ProviderMetrics) => {
            setCleaningScript(script);
            const origin = metrics.provider === 'AURA' ? 'deterministic' : 'model';
            const validation = validateCleaningScript(report, script, origin);
            setScriptValidation(validation);
            addLog(`script.generado :: ${script.split('\n').length} líneas · ${metrics.latencyMs}ms · origen=${origin}`);
          }}
          onLog={(stage, msg) => addLog(`${stage} :: ${msg}`)}
          onContinue={() => setState('review')}
        />
      )}

      {/* ── Step 6: Review & HITL ── */}
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
          scriptContractV2={scriptContractV2}
          remediationPlanV2={remediationPlan}
          structuredDiagnosis={structuredDiagnosis}
          sourceDatasetFingerprint={auditEvidence?.datasetFingerprint ?? null}
        />
      )}
    </div>
  );
};

export default MainPipeline;
