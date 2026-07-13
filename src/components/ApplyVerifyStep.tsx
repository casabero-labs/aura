import React, { useCallback, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Download, FileJson, FileText, Terminal, Upload, ShieldCheck, ShieldAlert, Loader2, CheckCircle2 } from 'lucide-react';
import { buildPythonExecutionBundle, parsePythonExecutionReceipt, validatePythonExecutionReceipt } from '../services/remediationExecution/pythonExecutionContract';
import type { PythonExecutionReceiptV1 } from '../services/remediationExecution/pythonExecutionContract';
import { sha256hex } from '../contracts/llm/hash';
import { computeExactCsvFingerprint } from '../services/reauditService';
import type { AuditReport, AuditExecutionEvidence } from '../types';
import type { DiagnosisExecutionResult, ScriptContractV2, ScriptValidationResultV2 } from '../contracts/llm';
import type { ApplyVerifyState } from './MainPipeline';

interface ApplyVerifyStepProps {
  state: ApplyVerifyState;
  report: AuditReport;
  auditEvidence?: AuditExecutionEvidence | null;
  structuredDiagnosis?: DiagnosisExecutionResult | null;
  scriptContractV2?: ScriptContractV2 | null;
  scriptContractVerificationV2?: ScriptValidationResultV2 | null;
  approvedScript?: string;
  sourceFile: File | null;
  sourceDatasetFingerprint?: string | null;
  executionValidationError?: string;
  onStateChange: (state: ApplyVerifyState) => void;
  onReceiptChange: (receipt?: PythonExecutionReceiptV1) => void;
  onErrorChange: (error: string) => void;
  onBundleJsonChange: (json: string) => void;
  executionReceipt?: PythonExecutionReceiptV1;
  executionBundleJson?: string;
  onLog: (stage: string, msg: string) => void;
  onContinue: () => void;
  onBack: () => void;
}

const RUNNER = 'npx experiments/runners/run-aura-remediation.mjs';

const formatHashShort = (hash?: string | null) => hash ? `${hash.slice(0, 8)}…${hash.slice(-6)}` : '—';

const fileToText = (f: File): Promise<string> => f.text();

const ApplyVerifyStep: React.FC<ApplyVerifyStepProps> = ({
  state,
  report,
  auditEvidence,
  structuredDiagnosis,
  scriptContractV2,
  scriptContractVerificationV2,
  approvedScript,
  sourceFile,
  sourceDatasetFingerprint,
  executionValidationError,
  executionReceipt,
  executionBundleJson,
  onStateChange,
  onReceiptChange,
  onErrorChange,
  onBundleJsonChange,
  onLog,
  onContinue,
  onBack,
}) => {
  const [afterFile, setAfterFile] = useState<File | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [validating, setValidating] = useState(false);
  const [storedBundleJson, setStoredBundleJson] = useState(executionBundleJson ?? '');

  const preconditions = useMemo(() => {
    const errors: string[] = [];
    const fingerprint = sourceDatasetFingerprint ?? auditEvidence?.datasetSha256 ?? null;
    if (!fingerprint || fingerprint.length !== 64) errors.push('El SHA-256 del CSV fuente no es válido.');
    if (!scriptContractV2) errors.push('No hay contrato de script V2.');
    if (!scriptContractVerificationV2 || scriptContractVerificationV2.pythonSyntax.state !== 'passed') {
      errors.push('La validación del script V2 no está completa o falló.');
    }
    if (!scriptContractV2) return { ok: false, errors };
    const currentScript = approvedScript ?? '';
    if (currentScript !== scriptContractV2.scriptText) {
      errors.push('El script aprobado difiere del contrato V2.');
    }
    if ((scriptContractV2.acceptedActionIds ?? []).length === 0) {
      errors.push('No hay acciones aceptadas en el plan.');
    }
    return { ok: errors.length === 0, errors, fingerprint };
  }, [sourceDatasetFingerprint, auditEvidence, scriptContractV2, scriptContractVerificationV2, approvedScript]);

  const prepareBundle = useCallback(() => {
    if (!preconditions.ok || !preconditions.fingerprint || !scriptContractV2) return;
    try {
      const fingerprint = preconditions.fingerprint;
      const bundle = buildPythonExecutionBundle({
        generatedAt: new Date().toISOString(),
        executionId: `exec:${fingerprint.slice(0, 12)}`,
        approvedScriptHash: scriptContractV2.scriptHash,
        beforeDatasetSha256: fingerprint,
        scriptText: scriptContractV2.scriptText,
        scriptHashPayload: { scriptText: scriptContractV2.scriptText },
        inputReceiptRef: structuredDiagnosis?.executionReceipt?.receiptHash,
        evidenceEnvelopeRef: structuredDiagnosis?.evidenceEnvelopeRef,
      });
      const json = JSON.stringify(bundle, null, 2);
      onBundleJsonChange(json);
      setStoredBundleJson(json);
      onStateChange('ready');
      onLog('execution.prepare', `bundle generated hash=${bundle.bundleHash?.slice(0, 12) ?? '?'}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      onErrorChange(msg);
      onLog('execution.prepare.error', msg);
    }
  }, [preconditions, structuredDiagnosis, scriptContractV2, onBundleJsonChange, onStateChange, onErrorChange, onLog]);

  const downloadBlob = (content: string, filename: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadBundle = () => {
    if (storedBundleJson) downloadBlob(storedBundleJson, 'execution-bundle.json', 'application/json');
  };

  const downloadSourceCsv = async () => {
    if (!sourceFile) return;
    const text = await sourceFile.text();
    downloadBlob(text, 'source.csv', 'text/csv');
  };

  const cliCommand = `${RUNNER} --bundle ./execution-bundle.json --input ./source.csv --output ./corrected.csv --receipt ./receipt.json`;

  const startAwaitingFiles = () => {
    onStateChange('awaiting_external_output');
  };

  const reuploadSourceFile = async (f: File) => {
    const text = await f.text();
    const hash = sha256hex(text);
    if (preconditions.fingerprint && hash !== preconditions.fingerprint) {
      onErrorChange('El SHA-256 del archivo seleccionado no coincide con el dataset congelado.');
      return;
    }
    onLog('execution.source', `re-selected source SHA256=${hash.slice(0, 12)}`);
  };

  const handleValidate = async () => {
    if (!afterFile || !receiptFile || !sourceFile) return;
    setValidating(true);
    onStateChange('validating');
    onReceiptChange(undefined);
    onErrorChange('');
    try {
      const [sourceCsv, afterCsv, receiptText] = await Promise.all([
        sourceFile.text(),
        afterFile.text(),
        receiptFile.text(),
      ]);
      const receipt = parsePythonExecutionReceipt(receiptText);
      const beforeHash = computeExactCsvFingerprint(sourceCsv);
      if (preconditions.fingerprint && beforeHash !== preconditions.fingerprint) {
        throw new Error('El CSV fuente no coincide byte a byte con el dataset congelado.');
      }
      const errors = validatePythonExecutionReceipt(receipt, {
        runId: receipt.runId,
        approvedScriptHash: scriptContractV2?.scriptHash ?? '',
        scriptText: scriptContractV2?.scriptText ?? '',
        beforeDatasetSha256: beforeHash,
        bundleHash: null,
        inputReceiptRef: null,
        evidenceEnvelopeRef: null,
        afterCsv,
      });
      if (errors.length > 0) {
        throw new Error(`Recibo inválido: ${errors.join('; ')}`);
      }
      if (receipt.syntax.status !== 'passed' || receipt.execution.status !== 'passed') {
        throw new Error(`Ejecución no exitosa: syntax=${receipt.syntax.status} execution=${receipt.execution.status}`);
      }
      if (!afterCsv || !afterCsv.trim()) {
        throw new Error('El CSV corregido está vacío.');
      }
      onReceiptChange(receipt);
      onStateChange('verified');
      onLog('execution.verified', `receipt=${receipt.receiptHash.slice(0, 12)} rows=${receipt.output?.rowCount} cols=${receipt.output?.columnCount}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      onErrorChange(msg);
      onStateChange('invalid');
      onLog('execution.invalid', msg);
    } finally {
      setValidating(false);
    }
  };

  return (
    <div className="step-card" data-testid="apply-verify-step">
      <div className="step-header">
        <h2 className="step-heading">Aplicar y verificar</h2>
        <p className="step-subtitle">
          Descarga el bundle y el CSV fuente, ejecuta el script de remediación en tu entorno Python local y sube el resultado junto con el recibo.
        </p>
      </div>

      {preconditions.errors.length > 0 && (
        <div className="evidence-options" data-testid="apply-verify-preconditions">
          <ShieldAlert size={16} />
          <div>
            <strong>Precondiciones no cumplidas</strong>
            <ul style={{ margin: 'var(--space-xs) 0 0 var(--space-lg)', fontSize: '14px' }}>
              {preconditions.errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {state === 'not_prepared' && preconditions.ok && (
        <button className="btn-p" onClick={prepareBundle} data-testid="apply-verify-prepare">
          <Terminal size={16} /> Preparar ejecución
        </button>
      )}

      {state === 'ready' && storedBundleJson && (
        <div data-testid="apply-verify-ready">
          <div
            data-execution-bundle-json={storedBundleJson}
            style={{ display: 'none' }}
          />
          <div className="evidence-options" style={{ marginBottom: 'var(--space-md)' }}>
            <ShieldCheck size={16} />
            <div>
              <strong>Ejecución preparada.</strong> Descarga los dos archivos y ejecutá el comando abajo en tu terminal.
            </div>
          </div>
          <div className="btn-row">
            <button className="btn-p btn-sm" onClick={downloadBundle} data-testid="apply-verify-download-bundle">
              <FileJson size={14} /> execution-bundle.json
            </button>
            <button className="btn-p btn-sm" onClick={downloadSourceCsv} data-testid="apply-verify-download-source">
              <FileText size={14} /> source.csv
            </button>
          </div>
          <div className="mono-block" style={{ marginTop: 'var(--space-md)' }} data-testid="apply-verify-command">
            <code>{cliCommand}</code>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--ink-muted)', marginTop: 'var(--space-xs)' }}>
            Ejecutá el comando en tu terminal. AURA no ejecuta Python. Cuando termine, arrastrá o seleccioná los dos archivos de salida.
          </p>
          <div className="btn-row" style={{ marginTop: 'var(--space-md)' }}>
            <button className="btn-s btn-sm" onClick={startAwaitingFiles} data-testid="apply-verify-await-files">
              <Upload size={14} /> Ya ejecuté, subir archivos
            </button>
          </div>
        </div>
      )}

      {(state === 'awaiting_external_output' || state === 'validating' || state === 'invalid') && (
        <div data-testid="apply-verify-import">
          <div className="evidence-options">
            <Upload size={16} />
            <div>
              <strong>{state === 'validating' ? 'Validando…' : 'Importar archivos de salida'}</strong>
              <p style={{ fontSize: '14px', marginTop: 'var(--space-xxs)' }}>
                Seleccioná corrected.csv y receipt.json juntos.
              </p>
            </div>
          </div>
          <div className="btn-row">
            <label className="btn-p btn-sm" style={{ cursor: 'pointer' }}>
              <FileText size={14} /> corrected.csv
              <input
                type="file"
                accept=".csv"
                style={{ display: 'none' }}
                onChange={(e) => setAfterFile(e.target.files?.[0] ?? null)}
                data-testid="apply-verify-after-file"
              />
            </label>
            <label className="btn-p btn-sm" style={{ cursor: 'pointer' }}>
              <FileJson size={14} /> receipt.json
              <input
                type="file"
                accept=".json"
                style={{ display: 'none' }}
                onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
                data-testid="apply-verify-receipt-file"
              />
            </label>
          </div>
          {afterFile && <p style={{ fontSize: '13px', marginTop: 'var(--space-xs)' }}>CSV: {afterFile.name} ({afterFile.size} bytes)</p>}
          {receiptFile && <p style={{ fontSize: '13px' }}>Recibo: {receiptFile.name} ({receiptFile.size} bytes)</p>}

          {!validating && state === 'invalid' && executionValidationError && (
            <div className="evidence-options" style={{ marginTop: 'var(--space-md)' }} data-testid="apply-verify-error">
              <ShieldAlert size={16} />
              <div>
                <strong>Error de validación</strong>
                <p style={{ fontSize: '14px', marginTop: 'var(--space-xxs)' }}>{executionValidationError}</p>
              </div>
            </div>
          )}

          <div className="btn-row" style={{ marginTop: 'var(--space-md)' }}>
            <button
              className="btn-p"
              disabled={!afterFile || !receiptFile || validating}
              onClick={handleValidate}
              data-testid="apply-verify-validate"
            >
              {validating ? <Loader2 size={16} className="spin" /> : <ShieldCheck size={16} />}
              Validar ejecución
            </button>
          </div>
        </div>
      )}

      {state === 'verified' && executionReceipt && (
        <div data-testid="apply-verify-verified">
          <div className="evidence-options" style={{ marginBottom: 'var(--space-md)' }}>
            <CheckCircle2 size={16} />
            <div>
              <strong>Ejecución verificada.</strong>
            </div>
          </div>
          <div className="info-grid">
            <div className="info-item">
              <span className="info-label">Python</span>
              <span className="info-value">{executionReceipt.pythonVersion}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Pandas</span>
              <span className="info-value">{executionReceipt.pandasVersion ?? '—'}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Plataforma</span>
              <span className="info-value">{executionReceipt.platform}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Duración</span>
              <span className="info-value">{executionReceipt.execution.durationMs} ms</span>
            </div>
            <div className="info-item">
              <span className="info-label">Filas</span>
              <span className="info-value">{executionReceipt.output?.rowCount ?? '—'}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Columnas</span>
              <span className="info-value">{executionReceipt.output?.columnCount ?? '—'}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Hash salida</span>
              <span className="info-value mono">{formatHashShort(executionReceipt.afterDatasetSha256)}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Hash recibo</span>
              <span className="info-value mono">{formatHashShort(executionReceipt.receiptHash)}</span>
            </div>
          </div>
          <div className="btn-row" style={{ marginTop: 'var(--space-md)' }}>
            <button className="btn-p" onClick={onContinue} data-testid="apply-verify-continue">
              <ArrowRight size={16} /> Ir a Exportación
            </button>
          </div>
        </div>
      )}

      {state !== 'verified' && (
        <div className="btn-row" style={{ marginTop: 'var(--space-lg)' }}>
          <button className="btn-s btn-sm" onClick={onBack} data-testid="apply-verify-back">
            <ArrowLeft size={14} /> Volver a Revisión
          </button>
        </div>
      )}
    </div>
  );
};

export default ApplyVerifyStep;
